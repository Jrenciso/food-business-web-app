-- Additive staff credentials, current rider position, and atomic rider collections.
begin;
create table if not exists public.staff_accounts (
  username text primary key check (username ~ '^[a-z][a-z0-9_]{3,31}$'),
  business_id uuid not null references public.businesses(id) on delete cascade,
  employee_id text not null,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  must_change_password boolean not null default true,
  issued_at timestamptz not null default now(),
  unique (business_id, employee_id)
);
create index if not exists staff_accounts_business_idx on public.staff_accounts(business_id,employee_id);
alter table public.staff_accounts enable row level security;
revoke all on public.staff_accounts from anon,authenticated;
-- The staff-accounts Edge Function uses the service-role client for all
-- credential reads and writes. RLS bypass does not replace table grants.
grant all on table public.staff_accounts to service_role;
-- The staff-accounts Edge Function also links created Auth users to a
-- business. Limit its membership-table access to the required operations.
grant select, insert, update on table public.business_memberships to service_role;

create table if not exists public.credential_operation_window (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  attempts integer not null default 1,
  primary key (user_id,window_start)
);
alter table public.credential_operation_window enable row level security;
revoke all on public.credential_operation_window from anon,authenticated;
create or replace function public.allow_credential_operation()
returns boolean language plpgsql security definer set search_path='' as $$
declare v_count integer; v_window timestamptz:=date_trunc('hour',now());
begin
  if auth.uid() is null then return false; end if;
  delete from public.credential_operation_window where window_start < now()-interval '2 hours';
  insert into public.credential_operation_window(user_id,window_start,attempts) values(auth.uid(),v_window,1)
    on conflict (user_id,window_start) do update set attempts=public.credential_operation_window.attempts+1
    returning attempts into v_count;
  return v_count<=10;
end $$;
revoke all on function public.allow_credential_operation() from public,anon;
grant execute on function public.allow_credential_operation() to authenticated;

create or replace function public.prevent_staff_owner_membership()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.role='owner' and exists(select 1 from public.staff_accounts where user_id=new.user_id)
    then raise exception 'Staff accounts cannot become business owners' using errcode='42501'; end if;
  return new;
end $$;
drop trigger if exists staff_owner_guard on public.business_memberships;
create trigger staff_owner_guard before insert or update of role on public.business_memberships
  for each row execute function public.prevent_staff_owner_membership();

create table if not exists public.rider_current_location (
  business_id uuid not null references public.businesses(id) on delete cascade,
  employee_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision not null check (accuracy_m between 0 and 10000),
  updated_at timestamptz not null default now(),
  primary key (business_id,employee_id)
);
create index if not exists rider_location_age_idx on public.rider_current_location(business_id,updated_at);
create index if not exists payment_receiver_idx on public.order_payment_index(business_id,(snapshot->>'receivedById'),paid_at);
alter table public.rider_current_location enable row level security;
revoke all on public.rider_current_location from anon,authenticated;

create or replace function public.staff_password_change_required()
returns boolean language sql security definer set search_path='' as $$
  select coalesce((select must_change_password from public.staff_accounts where user_id=auth.uid()),false)
$$;
revoke all on function public.staff_password_change_required() from public,anon;
grant execute on function public.staff_password_change_required() to authenticated;

-- No coordinates are returned to riders or other businesses.
create or replace function public.owner_rider_locations(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.business_memberships where business_id=p_business_id and user_id=auth.uid() and active and role='owner')
    then raise exception 'Access denied' using errcode='42501'; end if;
  delete from public.rider_current_location where business_id=p_business_id and updated_at<=now()-interval '10 minutes';
  return (select coalesce(jsonb_agg(jsonb_build_object('employeeId',l.employee_id,'orderId',l.order_id,
    'latitude',l.latitude,'longitude',l.longitude,'accuracy',l.accuracy_m,'updatedAt',l.updated_at)), '[]'::jsonb)
    from public.rider_current_location l join public.order_index o on o.business_id=l.business_id and o.order_id=l.order_id
    where l.business_id=p_business_id and o.rider_employee_id=l.employee_id and o.order_type='delivery'
      and o.status in ('Picked up','Out for delivery') and l.updated_at>now()-interval '10 minutes');
end $$;
revoke all on function public.owner_rider_locations(uuid) from public,anon;
grant execute on function public.owner_rider_locations(uuid) to authenticated;

create or replace function public.set_rider_location(p_business_id uuid,p_order_id text,p_latitude double precision,
  p_longitude double precision,p_accuracy double precision)
returns void language plpgsql security definer set search_path='' as $$
declare v_employee text;
begin
  select employee_id into v_employee from public.business_memberships
    where business_id=p_business_id and user_id=auth.uid() and active and role='rider';
  if v_employee is null or public.staff_password_change_required() then raise exception 'Access denied' using errcode='42501'; end if;
  if p_latitude is null or p_longitude is null or p_accuracy is null or
     p_latitude not between -90 and 90 or p_longitude not between -180 and 180 or p_accuracy not between 0 and 10000
    then raise exception 'Invalid location'; end if;
  if not exists(select 1 from public.order_index where business_id=p_business_id and order_id=p_order_id
    and rider_employee_id=v_employee and order_type='delivery' and status in ('Picked up','Out for delivery'))
    then raise exception 'No active assigned delivery' using errcode='42501'; end if;
  if exists(select 1 from public.rider_current_location where business_id=p_business_id and employee_id=v_employee
      and updated_at>now()-interval '12 seconds') then return; end if;
  insert into public.rider_current_location(business_id,employee_id,user_id,order_id,latitude,longitude,accuracy_m,updated_at)
    values(p_business_id,v_employee,auth.uid(),p_order_id,p_latitude,p_longitude,p_accuracy,now())
    on conflict (business_id,employee_id) do update set order_id=excluded.order_id,latitude=excluded.latitude,
      longitude=excluded.longitude,accuracy_m=excluded.accuracy_m,updated_at=excluded.updated_at,user_id=excluded.user_id;
end $$;
revoke all on function public.set_rider_location(uuid,text,double precision,double precision,double precision) from public,anon;
grant execute on function public.set_rider_location(uuid,text,double precision,double precision,double precision) to authenticated;

create or replace function public.stop_rider_location(p_business_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  delete from public.rider_current_location where business_id=p_business_id and user_id=auth.uid();
end $$;
revoke all on function public.stop_rider_location(uuid) from public,anon;
grant execute on function public.stop_rider_location(uuid) to authenticated;

-- Disabling a linked employee profile immediately revokes their membership and
-- removes their current coordinates. Reactivating a profile never grants access
-- automatically; the owner must explicitly re-enable the account.
create or replace function public.revoke_inactive_staff()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.business_memberships m set role=e.role,display_name=coalesce(nullif(e.name,''),m.display_name),updated_at=now()
    from (select value->>'id' as id,value->>'role' as role,value->>'name' as name
      from jsonb_array_elements(coalesce(new.data->'team','[]'::jsonb)) value
      where value->>'active'='true' and value->>'role' in ('rider','chef','kitchen')) e
    where m.business_id=new.business_id and m.role<>'owner' and m.employee_id=e.id
      and (m.role is distinct from e.role or m.display_name is distinct from e.name);
  update public.business_memberships m set active=false,updated_at=now()
    where m.business_id=new.business_id and m.role<>'owner' and m.active
      and exists(select 1 from jsonb_array_elements(coalesce(new.data->'team','[]'::jsonb)) e
        where e->>'id'=m.employee_id and (e->>'active'='false' or e->>'role'='owner'));
  delete from public.rider_current_location l where l.business_id=new.business_id and
    not exists(select 1 from public.business_memberships m where m.business_id=l.business_id
      and m.user_id=l.user_id and m.active and m.role='rider');
  delete from public.rider_current_location l where l.business_id=new.business_id and
    not exists(select 1 from public.order_index o where o.business_id=l.business_id and o.order_id=l.order_id
      and o.rider_employee_id=l.employee_id and o.order_type='delivery' and o.status in ('Picked up','Out for delivery'));
  return new;
end $$;
drop trigger if exists workspace_revoke_inactive_staff on public.workspace_state;
create trigger workspace_revoke_inactive_staff after update of data on public.workspace_state
  for each row execute function public.revoke_inactive_staff();

-- Staff see an aggregate already-paid amount, never payment references or
-- another rider's ledger. The active method list is needed for collection.
create or replace function public.read_operations(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_member public.business_memberships%rowtype; v_state public.workspace_state%rowtype;
  v_data jsonb; v_orders jsonb;
begin
  select * into v_member from public.business_memberships where business_id=p_business_id and user_id=auth.uid() and active;
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  if public.staff_password_change_required() then raise exception 'Password change required' using errcode='42501'; end if;
  select * into v_state from public.workspace_state where business_id=p_business_id;
  if not found then raise exception 'Workspace not found'; end if;
  v_data:=v_state.data;
  if v_member.role<>'owner' then
    select coalesce(jsonb_agg(jsonb_set(jsonb_set(o.snapshot,'{payments}','[]'::jsonb,true),'{paidAmount}',
      to_jsonb(coalesce((select sum(case when p.kind='refund' then -p.amount_centavos else p.amount_centavos end)
        from public.order_payment_index p where p.business_id=o.business_id and p.order_id=o.order_id),0)),true)
      order by o.created_at desc),'[]'::jsonb) into v_orders
    from public.order_index o where o.business_id=p_business_id and
      (v_member.role<>'rider' or o.order_type='delivery' and o.rider_employee_id=v_member.employee_id);
    v_data:=jsonb_build_object('orders',v_orders,'categories','[]'::jsonb,'items','[]'::jsonb,
      'team',(select coalesce(jsonb_agg(jsonb_build_object('id',m.employee_id,'name',m.display_name,
        'role',m.role,'active',m.active,'rates','[]'::jsonb)),'[]'::jsonb)
        from public.business_memberships m where m.business_id=p_business_id and m.active),
      'attendance','[]'::jsonb,'adjustments','[]'::jsonb,'payrollRuns','[]'::jsonb,'payrollBatches','[]'::jsonb,
      'payrollDraft',null,'deliveryAreas','[]'::jsonb,'workShifts','[]'::jsonb,'activity','[]'::jsonb,
      'settings',jsonb_build_object('businessName',v_data#>>'{settings,businessName}',
        'tagline',coalesce(v_data#>>'{settings,tagline}',''),'logo',coalesce(v_data#>>'{settings,logo}',''),
        'currency',v_data#>>'{settings,currency}','timezone',v_data#>>'{settings,timezone}',
        'theme',v_data#>>'{settings,theme}','accent',v_data#>>'{settings,accent}',
        'paymentMethods',coalesce(v_data#>'{settings,paymentMethods}','[]'::jsonb),'dataMode','live'),
      'nextTicket',0);
  end if;
  return jsonb_build_object('data',v_data,'revision',v_state.revision,'role',v_member.role,
    'employeeId',v_member.employee_id,'displayName',v_member.display_name);
end $$;
revoke all on function public.read_operations(uuid) from public,anon;
grant execute on function public.read_operations(uuid) to authenticated;

-- Keep the existing revision checked implementation, but block issued staff
-- credentials from all operational writes until the first password change.
alter function public.apply_operations(uuid,bigint,text,jsonb,uuid) rename to apply_operations_after_password_change;
revoke all on function public.apply_operations_after_password_change(uuid,bigint,text,jsonb,uuid) from public,anon,authenticated;
create function public.apply_operations(p_business_id uuid,p_expected_revision bigint,p_action text,p_next jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if public.staff_password_change_required() then raise exception 'Password change required' using errcode='42501'; end if;
  return public.apply_operations_after_password_change(p_business_id,p_expected_revision,p_action,p_next,p_request_id);
end $$;
revoke all on function public.apply_operations(uuid,bigint,text,jsonb,uuid) from public,anon;
grant execute on function public.apply_operations(uuid,bigint,text,jsonb,uuid) to authenticated;

-- Existing staff email accounts remain valid. The owner may issue a username
-- for an employee only after separately deciding how to retire legacy access.
create or replace function public.record_rider_collection(p_business_id uuid,p_order_id text,
  p_amount bigint,p_method text,p_reference text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_member public.business_memberships%rowtype; v_state public.workspace_state%rowtype;
  v_order jsonb; v_method jsonb; v_paid bigint; v_payment jsonb; v_next jsonb; v_response jsonb;
begin
  select * into v_member from public.business_memberships where business_id=p_business_id and user_id=auth.uid() and active and role='rider';
  if not found or public.staff_password_change_required() then raise exception 'Access denied' using errcode='42501'; end if;
  select * into v_state from public.workspace_state where business_id=p_business_id for update;
  if not found then raise exception 'Workspace not found'; end if;
  select response into v_response from public.operation_request where business_id=p_business_id and request_id=p_request_id;
  if found then return v_response; end if;
  select value into v_order from jsonb_array_elements(v_state.data->'orders') where value->>'id'=p_order_id;
  if v_order is null or v_order->>'riderId' is distinct from v_member.employee_id or v_order->>'type'<>'delivery'
      or v_order->>'status' not in ('Picked up','Out for delivery')
    then raise exception 'Assigned delivery is not eligible' using errcode='42501'; end if;
  select value into v_method from jsonb_array_elements(coalesce(v_state.data#>'{settings,paymentMethods}','[]'::jsonb))
    where value->>'id'=p_method and value->>'active'='true';
  if v_method is null then raise exception 'Choose an enabled payment method'; end if;
  select coalesce(sum(case when value->>'kind'='refund' then -(value->>'amount')::bigint else (value->>'amount')::bigint end),0)
    into v_paid from jsonb_array_elements(coalesce(v_order->'payments','[]'::jsonb));
  if p_amount is null or p_amount<=0 or p_amount>(v_order->>'total')::bigint-v_paid
    then raise exception 'Amount exceeds remaining balance'; end if;
  if length(coalesce(p_reference,''))>120 then raise exception 'Reference is too long'; end if;
  v_payment:=jsonb_build_object('id',gen_random_uuid()::text,'amount',p_amount,'method',p_method,
    'methodLabel',v_method->>'label','reference',trim(coalesce(p_reference,'')),'at',now(),
    'kind','payment','receivedById',v_member.employee_id,'receivedByName',v_member.display_name,'receivedByRole','rider');
  v_order:=jsonb_set(v_order,'{payments}',coalesce(v_order->'payments','[]'::jsonb)||jsonb_build_array(v_payment));
  select jsonb_set(v_state.data,'{orders}',jsonb_agg(case when value->>'id'=p_order_id then v_order else value end))
    into v_next from jsonb_array_elements(v_state.data->'orders');
  perform public.rebuild_operations_indexes(p_business_id,v_next);
  update public.workspace_state set data=v_next,revision=revision+1,updated_at=now() where business_id=p_business_id;
  v_response:=jsonb_build_object('payment',v_payment,'remaining',(v_order->>'total')::bigint-v_paid-p_amount);
  insert into public.operation_request(business_id,request_id,revision,response) values(p_business_id,p_request_id,v_state.revision+1,v_response);
  return v_response;
end $$;
revoke all on function public.record_rider_collection(uuid,text,bigint,text,text,uuid) from public,anon;
grant execute on function public.record_rider_collection(uuid,text,bigint,text,text,uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
