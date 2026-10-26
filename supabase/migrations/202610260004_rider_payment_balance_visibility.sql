begin;

-- Keep paidAmount available to staff even when payment details are hidden.
-- Assigned riders retain their own delivery payment details so they cannot
-- be prompted to collect a balance already received by another channel.
create or replace function public.read_operations(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_member public.business_memberships%rowtype; v_state public.workspace_state%rowtype;
  v_data jsonb; v_orders jsonb;
begin
  select * into v_member from public.business_memberships
    where business_id=p_business_id and user_id=auth.uid() and active;
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  if public.staff_password_change_required() then raise exception 'Password change required' using errcode='42501'; end if;
  select * into v_state from public.workspace_state where business_id=p_business_id;
  if not found then raise exception 'Workspace not found'; end if;
  v_data:=v_state.data;
  if v_member.role<>'owner' then
    select coalesce(jsonb_agg(
      case
        when v_member.role in (select value from jsonb_array_elements_text(
          coalesce(v_state.data#>'{settings,dayControlRoles}','[]'::jsonb))) then o.snapshot
        when v_member.role='rider' and o.order_type='delivery' and o.rider_employee_id=v_member.employee_id then
          jsonb_set(jsonb_set(o.snapshot,'{paidAmount}',to_jsonb(coalesce((
            select sum(case when p.kind='refund' then -p.amount_centavos else p.amount_centavos end)
            from public.order_payment_index p where p.business_id=o.business_id and p.order_id=o.order_id),0)),true),
            '{payments}',coalesce(o.snapshot->'payments','[]'::jsonb),true)
        else jsonb_set(jsonb_set(o.snapshot,'{payments}','[]'::jsonb,true),'{paidAmount}',
          to_jsonb(coalesce((select sum(case when p.kind='refund' then -p.amount_centavos else p.amount_centavos end)
            from public.order_payment_index p where p.business_id=o.business_id and p.order_id=o.order_id),0)),true)
      end order by o.created_at desc),'[]'::jsonb) into v_orders
    from public.order_index o where o.business_id=p_business_id and
      (v_member.role<>'rider' or
       (o.order_type='delivery' and o.rider_employee_id=v_member.employee_id) or
       o.snapshot->>'createdByEmployeeId'=v_member.employee_id);
    v_data:=jsonb_build_object(
      'orders',v_orders,
      'categories',coalesce(v_state.data->'categories','[]'::jsonb),
      'items',coalesce(v_state.data->'items','[]'::jsonb),
      'team',(select coalesce(jsonb_agg(jsonb_build_object('id',m.employee_id,'name',m.display_name,
        'role',m.role,'active',m.active,'rates','[]'::jsonb)),'[]'::jsonb)
        from public.business_memberships m where m.business_id=p_business_id and m.active),
      'attendance','[]'::jsonb,'adjustments','[]'::jsonb,'payrollRuns','[]'::jsonb,
      'payrollBatches','[]'::jsonb,'payrollDraft',null,
      'deliveryAreas',coalesce(v_state.data->'deliveryAreas','[]'::jsonb),
      'workShifts','[]'::jsonb,'activity','[]'::jsonb,
      'businessDays',coalesce(v_state.data->'businessDays','[]'::jsonb),
      'cashMovements',case when v_member.role in (select value from jsonb_array_elements_text(
        coalesce(v_state.data#>'{settings,dayControlRoles}','[]'::jsonb))) then
        coalesce(v_state.data->'cashMovements','[]'::jsonb) else '[]'::jsonb end,
      'locations',coalesce(v_state.data->'locations','[]'::jsonb),
      'registers',coalesce(v_state.data->'registers','[]'::jsonb),
      'settings',jsonb_build_object('businessName',v_data#>>'{settings,businessName}',
        'currency',v_data#>>'{settings,currency}','timezone',v_data#>>'{settings,timezone}',
        'theme',v_data#>>'{settings,theme}','accent',v_data#>>'{settings,accent}',
        'newOrderDisplay',v_data#>'{settings,newOrderDisplay}',
        'paymentMethods',v_data#>'{settings,paymentMethods}',
        'modules',v_data#>'{settings,modules}',
        'businessDayCutoff',v_data#>>'{settings,businessDayCutoff}',
        'dayControlRoles',v_data#>'{settings,dayControlRoles}',
        'cashVarianceThreshold',v_data#>'{settings,cashVarianceThreshold}',
        'dataMode','live'),
      'nextTicket',coalesce(v_state.data->'nextTicket','1001'::jsonb));
  end if;
  return jsonb_build_object('data',v_data,'revision',v_state.revision,'role',v_member.role,
    'employeeId',v_member.employee_id,'displayName',v_member.display_name);
end $$;
revoke all on function public.read_operations(uuid) from public,anon;
grant execute on function public.read_operations(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
