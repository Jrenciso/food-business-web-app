begin;

-- Recalculate drawer cash from immutable payments and movements before a
-- close snapshot is accepted. Seed-tagged tickets never fund a real drawer.
create function public.register_expected_cash(p_data jsonb,p_day jsonb)
returns bigint language sql stable set search_path='' as $$
  with cash_payments as (
    select coalesce(sum(case when payment.value->>'kind'='refund' then -1 else 1 end *
      (payment.value->>'amount')::bigint),0) amount
    from jsonb_array_elements(coalesce(p_data->'orders','[]'::jsonb)) ticket
    cross join lateral jsonb_array_elements(coalesce(ticket.value->'payments','[]'::jsonb)) payment
    where coalesce(ticket.value->>'sample','false')<>'true'
      and coalesce(ticket.value->>'testDataSeed','')=''
      and coalesce(payment.value->>'isTest','false')<>'true'
      and payment.value->>'method'='cash' and payment.value->>'custody'='register'
      and coalesce(payment.value->>'businessDate',
        public.business_operating_date(p_data->'settings',(payment.value->>'at')::timestamptz)::text)=p_day->>'businessDate'
      and (payment.value->>'registerSessionId'=p_day->>'registerSessionId' or
        (payment.value->>'registerSessionId' is null and
         (payment.value->>'at')::timestamptz>=(p_day->>'openedAt')::timestamptz and
         (p_day->>'closedAt' is null or
          (payment.value->>'at')::timestamptz<=(p_day->>'closedAt')::timestamptz)))
  ), cash_moves as (
    select coalesce(sum((case when movement.value->>'toCustody'='register' then 1 else 0 end -
      case when movement.value->>'fromCustody'='register' then 1 else 0 end) *
      (movement.value->>'amount')::bigint),0) amount
    from jsonb_array_elements(coalesce(p_data->'cashMovements','[]'::jsonb)) movement
    where movement.value->>'businessDate'=p_day->>'businessDate'
      and coalesce(movement.value->>'isTest','false')<>'true'
  )
  select coalesce((p_day->>'openingFloat')::bigint,0)+cash_payments.amount+cash_moves.amount
  from cash_payments cross join cash_moves
$$;
revoke all on function public.register_expected_cash(jsonb,jsonb) from public,anon,authenticated;

alter function public.validate_operations_change(uuid,jsonb,jsonb,text,text,text)
  rename to validate_operations_change_before_close_cash_guard;

create function public.validate_operations_change(
  p_business_id uuid,p_old jsonb,p_new jsonb,p_action text,p_role text,p_employee_id text)
returns void language plpgsql security definer set search_path='' as $$
declare v_day jsonb; v_prior jsonb; v_snapshot jsonb; v_expected bigint; v_counted bigint;
begin
  perform public.validate_operations_change_before_close_cash_guard(
    p_business_id,p_old,p_new,p_action,p_role,p_employee_id);
  if p_action<>'register' then return; end if;
  for v_day in select value from jsonb_array_elements(coalesce(p_new->'businessDays','[]'::jsonb)) loop
    select value into v_prior from jsonb_array_elements(coalesce(p_old->'businessDays','[]'::jsonb)) prior
      where prior.value->>'id'=v_day->>'id';
    if v_prior is null then continue; end if;
    if jsonb_array_length(coalesce(v_day->'closeSnapshots','[]'::jsonb))=
       jsonb_array_length(coalesce(v_prior->'closeSnapshots','[]'::jsonb)) then continue; end if;
    v_snapshot:=v_day->'closeSnapshots'->(jsonb_array_length(v_day->'closeSnapshots')-1);
    v_expected:=public.register_expected_cash(p_new,v_day);
    if v_snapshot->>'businessDate' is distinct from v_day->>'businessDate' or
       v_snapshot->>'actorId' is distinct from coalesce(p_employee_id,'') or
       (v_snapshot->>'expectedCash')::bigint is distinct from v_expected then
      raise exception 'Close report cash does not match saved payment and movement records';
    end if;
    if v_snapshot ? 'countedCash' then
      v_counted:=(v_snapshot->>'countedCash')::bigint;
      if v_counted<0 or (v_snapshot->>'variance')::bigint is distinct from v_counted-v_expected then
        raise exception 'Counted cash and variance do not reconcile';
      end if;
    elsif v_snapshot ? 'variance' then
      raise exception 'A variance needs a physical cash count';
    end if;
  end loop;
end $$;
revoke all on function public.validate_operations_change(uuid,jsonb,jsonb,text,text,text)
  from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
