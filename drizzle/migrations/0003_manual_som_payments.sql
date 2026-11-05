CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_id text NOT NULL,
  price_som integer NOT NULL,
  payer_note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.payment_requests TO authenticated;
GRANT ALL ON public.payment_requests TO service_role;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own requests readable" ON public.payment_requests FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Own requests insert" ON public.payment_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pending' AND NOT public.is_banned(auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_resolve_payment(_id uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.payment_requests;
BEGIN
  PERFORM public.assert_admin();
  SELECT * INTO r FROM public.payment_requests WHERE id = _id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Заявка не найдена'; END IF;
  UPDATE public.payment_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END WHERE id = _id;
  IF _approve THEN
    INSERT INTO public.item_grants (user_id, item_id, source) VALUES (r.user_id, r.item_id, 'som-payment');
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_resolve_payment(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_payment(uuid, boolean) TO authenticated;