CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.bans (
  user_id uuid PRIMARY KEY,
  reason text NOT NULL DEFAULT '',
  banned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bans TO authenticated;
GRANT ALL ON public.bans TO service_role;
ALTER TABLE public.bans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own ban readable" ON public.bans FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_banned(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.bans WHERE user_id = _user_id)
$$;

ALTER TABLE public.item_grants ADD COLUMN amount bigint;

-- Banned players cannot chat, trade, or update rating/save
DROP POLICY "Chat insert own" ON public.chat_messages;
CREATE POLICY "Chat insert own" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_banned(auth.uid()));

DROP POLICY "Seller creates listing" ON public.market_listings;
CREATE POLICY "Seller creates listing" ON public.market_listings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = seller_id AND status = 'active' AND buyer_id IS NULL AND NOT public.is_banned(auth.uid()));

DROP POLICY "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id AND NOT public.is_banned(auth.uid()));

DROP POLICY "Own save update" ON public.game_saves;
CREATE POLICY "Own save update" ON public.game_saves FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND NOT public.is_banned(auth.uid()));

-- Admin helpers
CREATE OR REPLACE FUNCTION public.assert_admin()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_players(_search text DEFAULT '')
RETURNS TABLE (id uuid, nickname text, email text, net_worth bigint, level int, banned boolean, ban_reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT p.id, p.nickname, u.email::text, p.net_worth, p.level, (b.user_id IS NOT NULL), b.reason
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN public.bans b ON b.user_id = p.id
  WHERE coalesce(_search, '') = '' OR p.nickname ILIKE '%' || _search || '%' OR u.email ILIKE '%' || _search || '%'
  ORDER BY p.net_worth DESC
  LIMIT 100;
END $$;

CREATE OR REPLACE FUNCTION public.admin_give_money(_user_id uuid, _amount bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  INSERT INTO public.item_grants (user_id, item_id, source, amount) VALUES (_user_id, 'admin-money', 'admin', _amount);
END $$;

CREATE OR REPLACE FUNCTION public.admin_give_money_all(_amount bigint)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  PERFORM public.assert_admin();
  INSERT INTO public.item_grants (user_id, item_id, source, amount)
  SELECT p.id, 'admin-money', 'admin', _amount FROM public.profiles p
  WHERE NOT public.is_banned(p.id);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.admin_grant_item(_user_id uuid, _item_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  INSERT INTO public.item_grants (user_id, item_id, source) VALUES (_user_id, _item_id, 'admin');
END $$;

CREATE OR REPLACE FUNCTION public.admin_reset_player(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  INSERT INTO public.item_grants (user_id, item_id, source) VALUES (_user_id, 'admin-reset', 'admin');
  UPDATE public.profiles SET net_worth = 0, level = 1, updated_at = now() WHERE id = _user_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_ban(_user_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'cannot ban yourself'; END IF;
  INSERT INTO public.bans (user_id, reason, banned_by) VALUES (_user_id, coalesce(_reason, ''), auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET reason = excluded.reason, banned_by = excluded.banned_by, created_at = now();
  UPDATE public.market_listings SET status = 'removed' WHERE seller_id = _user_id AND status = 'active';
END $$;

CREATE OR REPLACE FUNCTION public.admin_unban(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  DELETE FROM public.bans WHERE user_id = _user_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_nickname(_user_id uuid, _nickname text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  IF length(trim(coalesce(_nickname, ''))) = 0 THEN RAISE EXCEPTION 'empty nickname'; END IF;
  UPDATE public.profiles SET nickname = left(trim(_nickname), 20), updated_at = now() WHERE id = _user_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_message(_message_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  DELETE FROM public.chat_messages WHERE id = _message_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_remove_listing(_listing_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  UPDATE public.market_listings SET status = 'removed' WHERE id = _listing_id AND status = 'active';
END $$;

CREATE OR REPLACE FUNCTION public.admin_broadcast(_text text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  IF length(trim(coalesce(_text, ''))) = 0 THEN RAISE EXCEPTION 'empty'; END IF;
  INSERT INTO public.chat_messages (user_id, nickname, body) VALUES (auth.uid(), '📢 Администрация', left(trim(_text), 300));
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'assert_admin()', 'admin_list_players(text)', 'admin_give_money(uuid,bigint)', 'admin_give_money_all(bigint)',
    'admin_grant_item(uuid,text)', 'admin_reset_player(uuid)', 'admin_ban(uuid,text)', 'admin_unban(uuid)',
    'admin_set_nickname(uuid,text)', 'admin_delete_message(uuid)', 'admin_remove_listing(uuid)', 'admin_broadcast(text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- Make chat deletions visible in realtime
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;