ALTER TABLE public.bans ADD COLUMN expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.is_banned(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.bans WHERE user_id = _user_id AND (expires_at IS NULL OR expires_at > now()))
$$;

CREATE TABLE public.mutes (
  user_id uuid PRIMARY KEY,
  until timestamptz NOT NULL,
  muted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mutes TO authenticated;
GRANT ALL ON public.mutes TO service_role;
ALTER TABLE public.mutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own mute readable" ON public.mutes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_muted(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.mutes WHERE user_id = _user_id AND until > now())
$$;

DROP POLICY "Chat insert own" ON public.chat_messages;
CREATE POLICY "Chat insert own" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_banned(auth.uid()) AND NOT public.is_muted(auth.uid()));

CREATE TABLE public.promo_codes (
  code text PRIMARY KEY,
  item_id text NOT NULL,
  amount bigint,
  uses_left int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.promo_redemptions (
  code text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (code, user_id)
);
GRANT SELECT ON public.promo_redemptions TO authenticated;
GRANT ALL ON public.promo_redemptions TO service_role;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own redemptions readable" ON public.promo_redemptions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.redeem_promo(_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.promo_codes; c text := upper(trim(coalesce(_code, '')));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Нужно войти'; END IF;
  IF public.is_banned(auth.uid()) THEN RAISE EXCEPTION 'Аккаунт заблокирован'; END IF;
  SELECT * INTO p FROM public.promo_codes WHERE code = c FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Промокод не найден'; END IF;
  IF p.uses_left <= 0 THEN RAISE EXCEPTION 'Промокод закончился'; END IF;
  IF EXISTS (SELECT 1 FROM public.promo_redemptions WHERE code = c AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Ты уже активировал этот промокод';
  END IF;
  INSERT INTO public.promo_redemptions (code, user_id) VALUES (c, auth.uid());
  UPDATE public.promo_codes SET uses_left = uses_left - 1 WHERE code = c;
  INSERT INTO public.item_grants (user_id, item_id, source, amount) VALUES (auth.uid(), p.item_id, 'promo', p.amount);
  RETURN p.item_id;
END $$;

DROP FUNCTION public.admin_list_players(text);
CREATE FUNCTION public.admin_list_players(_search text DEFAULT '')
RETURNS TABLE (id uuid, nickname text, email text, net_worth bigint, level int, banned boolean, ban_reason text, ban_until timestamptz, muted_until timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT p.id, p.nickname, u.email::text, p.net_worth, p.level,
    (b.user_id IS NOT NULL AND (b.expires_at IS NULL OR b.expires_at > now())), b.reason, b.expires_at,
    CASE WHEN m.until > now() THEN m.until END
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.bans b ON b.user_id = p.id
  LEFT JOIN public.mutes m ON m.user_id = p.id
  WHERE coalesce(_search, '') = '' OR p.nickname ILIKE '%' || _search || '%' OR u.email ILIKE '%' || _search || '%'
  ORDER BY p.net_worth DESC
  LIMIT 100;
END $$;

CREATE OR REPLACE FUNCTION public.admin_ban_timed(_user_id uuid, _reason text, _hours int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'Нельзя забанить себя'; END IF;
  INSERT INTO public.bans (user_id, reason, banned_by, expires_at)
  VALUES (_user_id, coalesce(_reason, ''), auth.uid(), CASE WHEN coalesce(_hours, 0) > 0 THEN now() + make_interval(hours => _hours) END)
  ON CONFLICT (user_id) DO UPDATE SET reason = excluded.reason, banned_by = excluded.banned_by, created_at = now(), expires_at = excluded.expires_at;
  UPDATE public.market_listings SET status = 'removed' WHERE seller_id = _user_id AND status = 'active';
END $$;

CREATE OR REPLACE FUNCTION public.admin_give_money_by_email(_email text, _amount bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid; nick text;
BEGIN
  PERFORM public.assert_admin();
  SELECT u.id INTO uid FROM auth.users u WHERE lower(u.email) = lower(trim(_email));
  IF uid IS NULL THEN RAISE EXCEPTION 'Игрок с такой почтой не найден'; END IF;
  INSERT INTO public.item_grants (user_id, item_id, source, amount) VALUES (uid, 'admin-money', 'admin', _amount);
  SELECT nickname INTO nick FROM public.profiles WHERE id = uid;
  RETURN coalesce(nick, _email);
END $$;

CREATE OR REPLACE FUNCTION public.admin_grant(_user_id uuid, _item_id text, _amount bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  INSERT INTO public.item_grants (user_id, item_id, source, amount) VALUES (_user_id, _item_id, 'admin', _amount);
END $$;

CREATE OR REPLACE FUNCTION public.admin_mute(_user_id uuid, _minutes int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  INSERT INTO public.mutes (user_id, until, muted_by) VALUES (_user_id, now() + make_interval(mins => greatest(1, _minutes)), auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET until = excluded.until, muted_by = excluded.muted_by, created_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.admin_unmute(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  UPDATE public.mutes SET until = now() WHERE user_id = _user_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_create_promo(_code text, _item_id text, _amount bigint, _uses int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  IF length(trim(coalesce(_code, ''))) = 0 THEN RAISE EXCEPTION 'Пустой код'; END IF;
  INSERT INTO public.promo_codes (code, item_id, amount, uses_left)
  VALUES (upper(trim(_code)), _item_id, _amount, greatest(1, coalesce(_uses, 1)))
  ON CONFLICT (code) DO UPDATE SET item_id = excluded.item_id, amount = excluded.amount, uses_left = excluded.uses_left;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_promos()
RETURNS TABLE (code text, item_id text, amount bigint, uses_left int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY SELECT p.code, p.item_id, p.amount, p.uses_left FROM public.promo_codes p ORDER BY p.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_promo(_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  UPDATE public.promo_codes SET uses_left = 0 WHERE code = upper(trim(_code));
END $$;

CREATE OR REPLACE FUNCTION public.admin_clear_chat()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  PERFORM public.assert_admin();
  DELETE FROM public.chat_messages WHERE created_at <= now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.admin_server_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN jsonb_build_object(
    'players', (SELECT count(*) FROM public.profiles),
    'banned', (SELECT count(*) FROM public.bans WHERE expires_at IS NULL OR expires_at > now()),
    'muted', (SELECT count(*) FROM public.mutes WHERE until > now()),
    'messages', (SELECT count(*) FROM public.chat_messages),
    'listings', (SELECT count(*) FROM public.market_listings WHERE status = 'active'),
    'grants', (SELECT count(*) FROM public.item_grants),
    'total_worth', (SELECT coalesce(sum(net_worth), 0) FROM public.profiles)
  );
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'admin_list_players(text)', 'admin_ban_timed(uuid,text,int)', 'admin_give_money_by_email(text,bigint)',
    'admin_grant(uuid,text,bigint)', 'admin_mute(uuid,int)', 'admin_unmute(uuid)', 'admin_create_promo(text,text,bigint,int)',
    'admin_list_promos()', 'admin_delete_promo(text)', 'admin_clear_chat()', 'admin_server_stats()', 'redeem_promo(text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;