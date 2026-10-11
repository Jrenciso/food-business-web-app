-- Include business branding in staff snapshots while retaining restricted
-- order payments, payroll, employee pay, and settings.
create or replace function public.read_operations(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_member public.business_memberships%rowtype; v_state public.workspace_state%rowtype;
        v_data jsonb; v_orders jsonb;
begin
  select * into v_member from public.business_memberships
   where business_id=p_business_id and user_id=auth.uid() and active;
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  select * into v_state from public.workspace_state where business_id=p_business_id;
  if not found then raise exception 'Workspace not found'; end if;
  v_data:=v_state.data;
  if v_member.role <> 'owner' then
    select coalesce(jsonb_agg(jsonb_set(o.snapshot,'{payments}','[]'::jsonb,true)
      order by o.created_at desc),'[]'::jsonb) into v_orders
    from public.order_index o where o.business_id=p_business_id
      and (v_member.role <> 'rider' or
           (o.order_type='delivery' and o.rider_employee_id=v_member.employee_id));
    v_data:=jsonb_build_object(
      'orders',v_orders,'categories','[]'::jsonb,'items','[]'::jsonb,
      'team',(select coalesce(jsonb_agg(jsonb_build_object('id',m.employee_id,
               'name',m.display_name,'role',m.role,'active',m.active,
               'rates','[]'::jsonb)),'[]'::jsonb)
              from public.business_memberships m
              where m.business_id=p_business_id and m.active),
      'attendance','[]'::jsonb,'adjustments','[]'::jsonb,
      'payrollRuns','[]'::jsonb,'payrollBatches','[]'::jsonb,
      'payrollDraft',null,'deliveryAreas','[]'::jsonb,
      'workShifts','[]'::jsonb,'activity','[]'::jsonb,
      'settings',jsonb_build_object(
         'businessName',v_data#>>'{settings,businessName}',
         'tagline',coalesce(v_data#>>'{settings,tagline}',''),
         'logo',coalesce(v_data#>>'{settings,logo}',''),
         'currency',v_data#>>'{settings,currency}',
         'timezone',v_data#>>'{settings,timezone}',
         'theme',v_data#>>'{settings,theme}',
         'accent',v_data#>>'{settings,accent}',
         'dataMode','live'),'nextTicket',0);
  end if;
  return jsonb_build_object('data',v_data,'revision',v_state.revision,
    'role',v_member.role,'employeeId',v_member.employee_id,
    'displayName',v_member.display_name);
end $$;
revoke all on function public.read_operations(uuid) from public,anon;
grant execute on function public.read_operations(uuid) to authenticated;
notify pgrst, 'reload schema';
