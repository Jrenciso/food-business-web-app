-- Shared operations foundation. Run in a new Supabase project before enabling cloud mode.
create extension if not exists pgcrypto;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.business_memberships (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','kitchen','chef','rider')),
  employee_id text,
  display_name text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id,user_id)
);
create index if not exists memberships_user_idx on public.business_memberships(user_id,business_id) where active;

-- The JSON document preserves all existing operational snapshots and supports
-- revision-checked transactions. Indexed relational projections below enforce
-- duplicate prevention and support common operational lookups.
create table if not exists public.workspace_state (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.order_index (
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_id text not null,
  ticket_number text not null,
  created_at timestamptz not null,
  business_date date not null,
  status text not null,
  order_type text not null check (order_type in ('pickup','delivery')),
  rider_employee_id text,
  total_centavos bigint not null check (total_centavos >= 0),
  snapshot jsonb not null,
  primary key (business_id,order_id),
  unique (business_id,ticket_number)
);
create index if not exists order_lookup_idx on public.order_index(business_id,business_date desc,status);
create index if not exists rider_lookup_idx on public.order_index(business_id,rider_employee_id,status) where order_type='delivery';
create table if not exists public.order_payment_index (
  business_id uuid not null,
  payment_id text not null,
  order_id text not null,
  paid_at timestamptz not null,
  business_date date not null,
  amount_centavos bigint not null check (amount_centavos > 0),
  kind text not null check (kind in ('payment','refund')),
  method_id text not null,
  method_label text not null,
  snapshot jsonb not null,
  primary key (business_id,payment_id),
  foreign key (business_id,order_id) references public.order_index(business_id,order_id) on delete cascade
);
create index if not exists payment_lookup_idx on public.order_payment_index(business_id,business_date,order_id);
create table if not exists public.attendance_index (
  business_id uuid not null references public.businesses(id) on delete cascade,
  attendance_id text not null,
  employee_id text not null,
  business_date date not null,
  worked boolean not null,
  updated_at timestamptz not null,
  snapshot jsonb not null,
  primary key (business_id,attendance_id),
  unique (business_id,employee_id,business_date)
);
create index if not exists attendance_lookup_idx on public.attendance_index(business_id,business_date,employee_id);
create table if not exists public.payroll_batch_index (
  business_id uuid not null references public.businesses(id) on delete cascade,
  batch_id text not null,
  batch_number text not null,
  period_from date not null,
  period_to date not null check (period_to >= period_from),
  status text not null check (status in ('generated','void')),
  created_at timestamptz not null,
  snapshot jsonb not null,
  primary key (business_id,batch_id),
  unique (business_id,batch_number)
);
create index if not exists payroll_lookup_idx on public.payroll_batch_index(business_id,period_from desc,status);
create table if not exists public.payroll_work_date (
  business_id uuid not null,
  employee_id text not null,
  business_date date not null,
  batch_id text not null,
  primary key (business_id,employee_id,business_date),
  foreign key (business_id,batch_id) references public.payroll_batch_index(business_id,batch_id) on delete cascade
);
create table if not exists public.operation_request (
  business_id uuid not null references public.businesses(id) on delete cascade,
  request_id uuid not null,
  revision bigint not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (business_id,request_id)
);

alter table public.businesses enable row level security;
alter table public.business_memberships enable row level security;
alter table public.workspace_state enable row level security;
alter table public.order_index enable row level security;
alter table public.order_payment_index enable row level security;
alter table public.attendance_index enable row level security;
alter table public.payroll_batch_index enable row level security;
alter table public.payroll_work_date enable row level security;
alter table public.operation_request enable row level security;
revoke all on public.businesses,public.business_memberships,public.workspace_state,
  public.order_index,public.order_payment_index,public.attendance_index,
  public.payroll_batch_index,public.payroll_work_date,public.operation_request from anon,authenticated;

create or replace function public.my_businesses()
returns table (business_id uuid,business_name text,member_role text,employee_id text,display_name text)
language sql security definer set search_path = '' as $$
  select b.id,b.name,m.role,m.employee_id,m.display_name
  from public.business_memberships m join public.businesses b on b.id=m.business_id
  where m.user_id=auth.uid() and m.active order by b.created_at;
$$;
revoke all on function public.my_businesses() from public,anon;
grant execute on function public.my_businesses() to authenticated;

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
    select coalesce(jsonb_agg(jsonb_set(o.snapshot,'{payments}','[]'::jsonb,true) order by o.created_at desc),'[]'::jsonb) into v_orders
    from public.order_index o where o.business_id=p_business_id
      and (v_member.role <> 'rider' or
           (o.order_type='delivery' and o.rider_employee_id=v_member.employee_id));
    v_data:=jsonb_build_object(
      'orders',v_orders,'categories','[]'::jsonb,'items','[]'::jsonb,
      'team',(select coalesce(jsonb_agg(jsonb_build_object('id',m.employee_id,'name',m.display_name,
               'role',m.role,'active',m.active,'rates','[]'::jsonb)),'[]'::jsonb)
              from public.business_memberships m where m.business_id=p_business_id and m.active),
      'attendance','[]'::jsonb,'adjustments','[]'::jsonb,'payrollRuns','[]'::jsonb,
      'payrollBatches','[]'::jsonb,'payrollDraft',null,'deliveryAreas','[]'::jsonb,
      'workShifts','[]'::jsonb,'activity','[]'::jsonb,
      'settings',jsonb_build_object('businessName',v_data#>>'{settings,businessName}',
         'currency',v_data#>>'{settings,currency}','timezone',v_data#>>'{settings,timezone}',
         'theme',v_data#>>'{settings,theme}','accent',v_data#>>'{settings,accent}',
         'dataMode','live'),'nextTicket',0);
  end if;
  return jsonb_build_object('data',v_data,'revision',v_state.revision,'role',v_member.role,
    'employeeId',v_member.employee_id,'displayName',v_member.display_name);
end $$;
revoke all on function public.read_operations(uuid) from public,anon;
grant execute on function public.read_operations(uuid) to authenticated;

create or replace function public.validate_order_money(p_order jsonb,p_menu jsonb,p_areas jsonb)
returns void language plpgsql set search_path = '' as $$
declare v_line jsonb; v_item jsonb; v_area jsonb; v_subtotal bigint:=0;
        v_fee bigint; v_discount bigint; v_total bigint; v_quantity bigint; v_price bigint;
begin
  if jsonb_typeof(p_order->'lines') <> 'array' or jsonb_array_length(p_order->'lines')=0
    then raise exception 'Order needs items'; end if;
  for v_line in select value from jsonb_array_elements(p_order->'lines') loop
    v_quantity:=(v_line->>'quantity')::bigint;
    v_price:=(v_line->>'unitPrice')::bigint;
    if v_quantity<1 or v_quantity>999 or v_price<0 or v_price>100000000
      then raise exception 'Invalid order line'; end if;
    if nullif(trim(v_line->>'name'),'') is null then raise exception 'Order line needs a name'; end if;
    v_subtotal:=v_subtotal+v_quantity*v_price;
  end loop;
  v_fee:=(p_order->>'deliveryFee')::bigint;
  v_discount:=(p_order->>'discount')::bigint;
  v_total:=(p_order->>'total')::bigint;
  if v_subtotal<>(p_order->>'subtotal')::bigint or v_fee<0 or v_discount<0
     or v_discount>v_subtotal+v_fee or v_total<>v_subtotal+v_fee-v_discount
     then raise exception 'Order totals do not match its lines and fees'; end if;
  if p_order->>'type'='pickup' and v_fee<>0 then raise exception 'Pickup cannot have a delivery fee'; end if;
  if p_order->>'type'='delivery' then
    select value into v_area from jsonb_array_elements(p_areas) where value->>'id'=p_order->>'deliveryAreaId';
    if v_area is null or v_area->>'active'<>'true' or nullif(trim(p_order->>'address'),'') is null
      then raise exception 'Delivery needs an active area and address'; end if;
    if p_order->>'deliveryAreaLabel'<>v_area->>'label'
      or (p_order->>'deliveryAreaFee')::bigint<>(v_area->>'fee')::bigint
      then raise exception 'Delivery area snapshot does not match the selected area'; end if;
    if nullif(trim(coalesce(p_order->>'deliveryFeeOverrideReason','')),'') is null
       and v_fee<>(v_area->>'fee')::bigint
      then raise exception 'Delivery fee does not match the selected area'; end if;
  end if;
end $$;
revoke all on function public.validate_order_money(jsonb,jsonb,jsonb) from public,anon,authenticated;

create or replace function public.rebuild_operations_indexes(p_business_id uuid,p_data jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order jsonb; v_payment jsonb; v_attendance jsonb; v_batch jsonb;
        v_row jsonb; v_line jsonb;
begin
  delete from public.order_index where business_id=p_business_id;
  delete from public.attendance_index where business_id=p_business_id;
  delete from public.payroll_batch_index where business_id=p_business_id;
  for v_order in select value from jsonb_array_elements(coalesce(p_data->'orders','[]'::jsonb)) loop
    insert into public.order_index(business_id,order_id,ticket_number,created_at,business_date,
      status,order_type,rider_employee_id,total_centavos,snapshot)
    values (p_business_id,v_order->>'id',v_order->>'number',(v_order->>'createdAt')::timestamptz,
      (((v_order->>'createdAt')::timestamptz at time zone 'Asia/Manila')::date),
      v_order->>'status',v_order->>'type',v_order->>'riderId',(v_order->>'total')::bigint,v_order);
    for v_payment in select value from jsonb_array_elements(coalesce(v_order->'payments','[]'::jsonb)) loop
      insert into public.order_payment_index(business_id,payment_id,order_id,paid_at,business_date,
        amount_centavos,kind,method_id,method_label,snapshot)
      values (p_business_id,v_payment->>'id',v_order->>'id',(v_payment->>'at')::timestamptz,
        (((v_payment->>'at')::timestamptz at time zone 'Asia/Manila')::date),
        (v_payment->>'amount')::bigint,v_payment->>'kind',v_payment->>'method',
        coalesce(v_payment->>'methodLabel',v_payment->>'method'),v_payment);
    end loop;
  end loop;
  for v_attendance in select value from jsonb_array_elements(coalesce(p_data->'attendance','[]'::jsonb)) loop
    insert into public.attendance_index(business_id,attendance_id,employee_id,business_date,worked,updated_at,snapshot)
    values (p_business_id,v_attendance->>'id',v_attendance->>'employeeId',
      (v_attendance->>'date')::date,(v_attendance->>'worked')::boolean,
      (v_attendance->>'updatedAt')::timestamptz,v_attendance);
  end loop;
  for v_batch in select value from jsonb_array_elements(coalesce(p_data->'payrollBatches','[]'::jsonb)) loop
    insert into public.payroll_batch_index(business_id,batch_id,batch_number,period_from,period_to,
      status,created_at,snapshot)
    values (p_business_id,v_batch->>'id',v_batch->>'number',(v_batch->>'from')::date,
      (v_batch->>'to')::date,v_batch->>'status',(v_batch->>'createdAt')::timestamptz,v_batch);
    if v_batch->>'status'='generated' then
      for v_row in select value from jsonb_array_elements(coalesce(v_batch->'rows','[]'::jsonb)) loop
        for v_line in select value from jsonb_array_elements(coalesce(v_row->'lines','[]'::jsonb)) loop
          insert into public.payroll_work_date(business_id,employee_id,business_date,batch_id)
          values (p_business_id,v_row->>'employeeId',(v_line->>'date')::date,v_batch->>'id');
        end loop;
      end loop;
    end if;
  end loop;
end $$;
revoke all on function public.rebuild_operations_indexes(uuid,jsonb) from public,anon,authenticated;

create or replace function public.validate_operations_change(
  p_business_id uuid,p_old jsonb,p_new jsonb,p_action text,p_role text,p_employee_id text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old_order jsonb; v_order jsonb; v_payment jsonb; v_old_payment jsonb;
        v_line jsonb; v_item jsonb; v_area jsonb; v_batch jsonb; v_old_batch jsonb;
        v_row jsonb; v_old_row jsonb; v_attendance jsonb; v_rate jsonb;
        v_changed integer:=0; v_total bigint; v_paid bigint; v_refunds bigint;
        v_base bigint; v_add bigint; v_deduct bigint; v_expected bigint; v_days integer;
        v_method jsonb;
begin
  if jsonb_typeof(p_new)<>'object' or p_new#>>'{settings,dataMode}'<>'live'
    then raise exception 'Invalid live workspace document'; end if;
  if p_role<>'owner' then
    if p_action not in ('prep','deliver') or p_new-'orders'<>p_old-'orders'
       or jsonb_array_length(p_new->'orders')<>jsonb_array_length(p_old->'orders')
      then raise exception 'This role cannot change business records' using errcode='42501'; end if;
    for v_order in select value from jsonb_array_elements(p_new->'orders') loop
      select value into v_old_order from jsonb_array_elements(p_old->'orders')
        where value->>'id'=v_order->>'id';
      if v_old_order is null then raise exception 'Staff cannot create orders' using errcode='42501'; end if;
      if v_order<>v_old_order then
        v_changed:=v_changed+1;
        if v_order-'status'-'statusHistory'<>v_old_order-'status'-'statusHistory'
          or jsonb_array_length(v_order->'statusHistory')<>jsonb_array_length(v_old_order->'statusHistory')+1
          then raise exception 'Only ticket status may change' using errcode='42501'; end if;
        if p_role in ('chef','kitchen') and not (
          (v_old_order->>'status'='New' and v_order->>'status'='Preparing') or
          (v_old_order->>'status'='Preparing' and v_order->>'status'='Ready') or
          (v_old_order->>'status'='Ready' and v_old_order->>'type'='pickup' and v_order->>'status'='Picked up'))
          then raise exception 'Kitchen status transition denied' using errcode='42501'; end if;
        if p_role='rider' and not (
          v_old_order->>'type'='delivery' and v_old_order->>'riderId'=p_employee_id and (
          (v_old_order->>'status'='Ready' and v_order->>'status'='Picked up') or
          (v_old_order->>'status'='Picked up' and v_order->>'status'='Out for delivery') or
          (v_old_order->>'status'='Out for delivery' and v_order->>'status'='Completed')))
          then raise exception 'Rider status transition denied' using errcode='42501'; end if;
      end if;
    end loop;
    if v_changed<>1 then raise exception 'One ticket update is required'; end if;
    return;
  end if;

  if exists(select 1 from jsonb_array_elements(coalesce(p_old->'orders','[]'::jsonb)) o
     where not exists(select 1 from jsonb_array_elements(coalesce(p_new->'orders','[]'::jsonb)) n
       where n->>'id'=o->>'id')) then raise exception 'Order history cannot be deleted'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_old->'attendance','[]'::jsonb)) o
     where not exists(select 1 from jsonb_array_elements(coalesce(p_new->'attendance','[]'::jsonb)) n
       where n->>'id'=o->>'id')) then raise exception 'Attendance history cannot be deleted'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_old->'payrollBatches','[]'::jsonb)) o
     where not exists(select 1 from jsonb_array_elements(coalesce(p_new->'payrollBatches','[]'::jsonb)) n
       where n->>'id'=o->>'id')) then raise exception 'Payroll history cannot be deleted'; end if;

  if p_action='pos' then
    if p_new-'orders'-'nextTicket'<>p_old-'orders'-'nextTicket'
      then raise exception 'Order action changed unrelated records'; end if;
    for v_order in select value from jsonb_array_elements(p_new->'orders') loop
      select value into v_old_order from jsonb_array_elements(p_old->'orders')
        where value->>'id'=v_order->>'id';
      if v_old_order is distinct from v_order then
        v_changed:=v_changed+1;
        if v_old_order is null then
          if v_order->>'number'<>p_old->>'nextTicket' or
             (p_new->>'nextTicket')::bigint<>(p_old->>'nextTicket')::bigint+1 or
             v_order->>'status'<>'New' or jsonb_array_length(v_order->'payments')<>0
            then raise exception 'Invalid new ticket number or state'; end if;
        else
          if v_old_order->>'status' in ('Out for delivery','Completed','Cancelled')
             or v_order->'payments'<>v_old_order->'payments'
            then raise exception 'Ticket is locked or payment history changed'; end if;
        end if;
        perform public.validate_order_money(v_order,p_old->'items',p_old->'deliveryAreas');
        if nullif(trim(v_order->>'customer'),'') is null or nullif(trim(v_order->>'contact'),'') is null
          then raise exception 'Customer name and contact are required'; end if;
        for v_line in select value from jsonb_array_elements(v_order->'lines') loop
          if v_old_order is null or not exists (
             select 1 from jsonb_array_elements(coalesce(v_old_order->'lines','[]'::jsonb)) old_line
             where old_line->>'itemId'=v_line->>'itemId' and old_line->>'name'=v_line->>'name'
               and old_line->>'unitPrice'=v_line->>'unitPrice') then
            select value into v_item from jsonb_array_elements(p_old->'items')
              where value->>'id'=v_line->>'itemId';
            if v_item is null or v_item->>'available'<>'true'
               or v_item->>'name'<>v_line->>'name' or v_item->>'price'<>v_line->>'unitPrice'
              then raise exception 'Order item does not match the active menu'; end if;
          end if;
        end loop;
      end if;
    end loop;
    if v_changed<>1 or jsonb_array_length(p_new->'orders') not in
      (jsonb_array_length(p_old->'orders'),jsonb_array_length(p_old->'orders')+1)
      then raise exception 'One order change is required'; end if;
  elsif p_action='payment' then
    if p_new-'orders'<>p_old-'orders' then raise exception 'Payment changed unrelated records'; end if;
    for v_order in select value from jsonb_array_elements(p_new->'orders') loop
      select value into v_old_order from jsonb_array_elements(p_old->'orders')
        where value->>'id'=v_order->>'id';
      if v_old_order is null then raise exception 'Payment ticket not found'; end if;
      if v_order<>v_old_order then
        v_changed:=v_changed+1;
        if v_order-'payments'<>v_old_order-'payments' or
           jsonb_array_length(v_order->'payments')<>jsonb_array_length(v_old_order->'payments')+1 or
           (v_order->'payments')-(jsonb_array_length(v_order->'payments')-1)<>v_old_order->'payments'
          then raise exception 'Payment history must be append-only'; end if;
        v_payment:=v_order->'payments'->(jsonb_array_length(v_order->'payments')-1);
        if (v_payment->>'amount')::bigint<=0 then raise exception 'Payment amount must be positive'; end if;
        select coalesce(sum((value->>'amount')::bigint) filter (where value->>'kind'='payment'),0),
               coalesce(sum((value->>'amount')::bigint) filter (where value->>'kind'='refund'),0)
          into v_paid,v_refunds from jsonb_array_elements(v_old_order->'payments');
        if v_payment->>'kind'='payment' then
          if (v_payment->>'amount')::bigint>(v_old_order->>'total')::bigint-v_paid+v_refunds
            then raise exception 'Payment exceeds remaining balance'; end if;
          select value into v_method from jsonb_array_elements(coalesce(p_old#>'{settings,paymentMethods}','[]'::jsonb))
            where value->>'id'=v_payment->>'method' and value->>'active'='true';
          if v_method is null or v_method->>'label'<>v_payment->>'methodLabel'
            then raise exception 'Payment method is not enabled'; end if;
        elsif v_payment->>'kind'='refund' then
          if (v_payment->>'amount')::bigint>v_paid-v_refunds then raise exception 'Refund exceeds collected amount'; end if;
        else raise exception 'Invalid payment kind'; end if;
      end if;
    end loop;
    if v_changed<>1 then raise exception 'One payment is required'; end if;
  elsif p_action='attendance' then
    if p_new-'attendance'<>p_old-'attendance' then raise exception 'Attendance action changed unrelated records'; end if;
    for v_attendance in select value from jsonb_array_elements(p_new->'attendance') loop
      if exists(select 1 from public.payroll_work_date w where w.business_id=p_business_id
        and w.employee_id=v_attendance->>'employeeId' and w.business_date=(v_attendance->>'date')::date)
        and not exists(select 1 from jsonb_array_elements(p_old->'attendance') a
          where a->>'id'=v_attendance->>'id' and a=v_attendance)
        then raise exception 'Attendance included in payroll is locked'; end if;
    end loop;
  elsif p_action='payroll' then
    if p_new-'payrollBatches'-'payrollDraft'-'adjustments'<>
       p_old-'payrollBatches'-'payrollDraft'-'adjustments'
      then raise exception 'Payroll action changed unrelated records'; end if;
    for v_batch in select value from jsonb_array_elements(coalesce(p_new->'payrollBatches','[]'::jsonb)) loop
      select value into v_old_batch from jsonb_array_elements(coalesce(p_old->'payrollBatches','[]'::jsonb))
        where value->>'id'=v_batch->>'id';
      if v_old_batch is null then
        for v_row in select value from jsonb_array_elements(v_batch->'rows') loop
          v_base:=0; v_add:=0; v_deduct:=0;
          for v_line in select value from jsonb_array_elements(v_row->'lines') loop
            select value into v_attendance from jsonb_array_elements(p_old->'attendance')
              where value->>'id'=v_line->>'attendanceId'
                and value->>'employeeId'=v_row->>'employeeId'
                and value->>'date'=v_line->>'date' and value->>'worked'='true';
            if v_attendance is null or v_attendance->>'start'<>v_line->>'start'
              or v_attendance->>'end'<>v_line->>'end' then raise exception 'Payroll line has no matching work log'; end if;
            v_rate:=v_attendance->'rateSnapshot';
            if v_rate is null or v_rate='null'::jsonb then raise exception 'Work log has no saved rate'; end if;
            if v_rate->>'basis'='daily' then v_expected:=(v_rate->>'amount')::bigint;
            else
              v_days:=extract(day from (date_trunc('month',(v_line->>'date')::date)
                 + interval '1 month - 1 day'))::integer;
              v_expected:=(v_rate->>'amount')::bigint/v_days;
              if extract(day from (v_line->>'date')::date)::integer <=
                 (v_rate->>'amount')::bigint%v_days then v_expected:=v_expected+1; end if;
            end if;
            if (v_line->>'accrual')::bigint<>v_expected or
               (v_line->>'rate')::bigint<>(v_rate->>'amount')::bigint
              then raise exception 'Payroll accrual does not match saved rate'; end if;
            v_base:=v_base+v_expected;
          end loop;
          for v_line in select value from jsonb_array_elements(coalesce(v_row->'adjustments','[]'::jsonb)) loop
            if (v_line->>'amount')::bigint>0 then v_add:=v_add+(v_line->>'amount')::bigint;
            else v_deduct:=v_deduct-(v_line->>'amount')::bigint; end if;
          end loop;
          if v_base<>(v_row->>'base')::bigint or v_add<>(v_row->>'additions')::bigint
            or v_deduct<>(v_row->>'deductions')::bigint or
            v_base+v_add-v_deduct<>(v_row->>'net')::bigint or
            v_row->'payment'<>'null'::jsonb
            then raise exception 'Payroll employee total is invalid'; end if;
        end loop;
      else
        if v_batch->>'status'<>v_old_batch->>'status' then raise exception 'Saved payroll register cannot change state'; end if;
        if v_batch-'rows'<>v_old_batch-'rows' or
           jsonb_array_length(v_batch->'rows')<>jsonb_array_length(v_old_batch->'rows')
          then raise exception 'Saved payroll register fields cannot change'; end if;
        for v_row in select value from jsonb_array_elements(v_batch->'rows') loop
          select value into v_old_row from jsonb_array_elements(v_old_batch->'rows')
            where value->>'employeeId'=v_row->>'employeeId';
          if v_old_row is null or v_row-'payment'-'paymentHistory'<>v_old_row-'payment'-'paymentHistory'
            then raise exception 'Saved payroll calculations cannot change'; end if;
          if v_old_row->'payment'<>'null'::jsonb and v_row->'payment'='null'::jsonb and
             coalesce(v_row->'paymentHistory','[]'::jsonb) <>
               coalesce(v_old_row->'paymentHistory','[]'::jsonb) || jsonb_build_array(v_old_row->'payment')
            then raise exception 'Payment correction must retain earlier record'; end if;
          if v_old_row->'payment'<>'null'::jsonb and v_row->'payment'<>'null'::jsonb and
             (v_old_row->'payment'<>v_row->'payment' or
              coalesce(v_old_row->'paymentHistory','[]'::jsonb)<>coalesce(v_row->'paymentHistory','[]'::jsonb))
            then raise exception 'Saved payroll payment cannot be edited'; end if;
          if v_old_row->'payment'='null'::jsonb and
             coalesce(v_old_row->'paymentHistory','[]'::jsonb)<>coalesce(v_row->'paymentHistory','[]'::jsonb)
            then raise exception 'Payroll payment correction history cannot be edited'; end if;
          if v_old_row->'payment'='null'::jsonb and v_row->'payment'<>'null'::jsonb then
            if (v_row#>>'{payment,amount}')::bigint<>(v_row->>'net')::bigint or
               nullif(v_row#>>'{payment,date}','') is null
              then raise exception 'Payroll payment is invalid'; end if;
            if nullif(v_row#>>'{payment,method}','') is not null and not exists (
               select 1 from jsonb_array_elements(coalesce(p_old#>'{settings,paymentMethods}','[]'::jsonb)) m
               where m->>'id'=v_row#>>'{payment,method}' and m->>'active'='true'
                 and m->>'label'=v_row#>>'{payment,methodLabel}')
              then raise exception 'Payroll payment method is not enabled'; end if;
          end if;
        end loop;
      end if;
    end loop;
  elsif p_action='menu' then
    if p_new-'categories'-'items'<>p_old-'categories'-'items' then raise exception 'Menu action changed unrelated records'; end if;
  elsif p_action='settings' then
    if p_new-'settings'-'deliveryAreas'-'workShifts'<>p_old-'settings'-'deliveryAreas'-'workShifts'
      then raise exception 'Settings action changed unrelated records'; end if;
  elsif p_action='staff' then
    if p_new-'team'<>p_old-'team' then raise exception 'Staff action changed unrelated records'; end if;
  elsif p_action='cancel' then
    if p_new-'orders'<>p_old-'orders' then raise exception 'Ticket action changed unrelated records'; end if;
    for v_order in select value from jsonb_array_elements(p_new->'orders') loop
      select value into v_old_order from jsonb_array_elements(p_old->'orders') where value->>'id'=v_order->>'id';
      if v_order<>v_old_order then
        v_changed:=v_changed+1;
        if v_order-'status'-'statusHistory'-'riderId'<>
           v_old_order-'status'-'statusHistory'-'riderId'
          then raise exception 'Ticket fields cannot change with status action'; end if;
        if v_order->>'status'<>v_old_order->>'status' and not (
          (v_old_order->>'status'='New' and v_order->>'status' in ('Preparing','Cancelled')) or
          (v_old_order->>'status'='Preparing' and v_order->>'status' in ('Ready','Cancelled')) or
          (v_old_order->>'status'='Ready' and v_order->>'status' in ('Picked up','Completed','Cancelled')) or
          (v_old_order->>'status'='Picked up' and v_order->>'status' in ('Out for delivery','Completed','Cancelled')) or
          (v_old_order->>'status'='Out for delivery' and v_order->>'status' in ('Completed','Cancelled')))
          then raise exception 'Invalid ticket status transition'; end if;
      end if;
    end loop;
    if v_changed<>1 then raise exception 'One ticket update is required'; end if;
  else raise exception 'Unknown operation'; end if;
end $$;
revoke all on function public.validate_operations_change(uuid,jsonb,jsonb,text,text,text) from public,anon,authenticated;

create or replace function public.create_business(p_name text,p_initial jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if nullif(trim(p_name),'') is null or length(p_name)>120 or
     p_initial#>>'{settings,dataMode}'<>'live' or
     jsonb_array_length(coalesce(p_initial->'orders','[]'::jsonb))<>0 or
     jsonb_array_length(coalesce(p_initial->'attendance','[]'::jsonb))<>0 or
     jsonb_array_length(coalesce(p_initial->'payrollBatches','[]'::jsonb))<>0
    then raise exception 'New business must start with an empty live workspace'; end if;
  insert into public.businesses(name) values(trim(p_name)) returning id into v_id;
  insert into public.business_memberships(business_id,user_id,role,display_name)
    values(v_id,v_user,'owner',coalesce((select raw_user_meta_data->>'full_name'
      from auth.users where id=v_user),''));
  insert into public.workspace_state(business_id,data) values(v_id,p_initial || jsonb_build_object('activity','[]'::jsonb));
  perform public.rebuild_operations_indexes(v_id,p_initial);
  return v_id;
end $$;
revoke all on function public.create_business(text,jsonb) from public,anon;
grant execute on function public.create_business(text,jsonb) to authenticated;

create or replace function public.apply_operations(
  p_business_id uuid,p_expected_revision bigint,p_action text,p_next jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_member public.business_memberships%rowtype; v_state public.workspace_state%rowtype;
        v_response jsonb; v_next jsonb; v_order jsonb; v_old_order jsonb;
        v_orders jsonb; v_change_count integer:=0;
begin
  select * into v_member from public.business_memberships
    where business_id=p_business_id and user_id=auth.uid() and active;
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  select response into v_response from public.operation_request
    where business_id=p_business_id and request_id=p_request_id;
  if found then return v_response; end if;
  select * into v_state from public.workspace_state where business_id=p_business_id for update;
  if not found then raise exception 'Workspace not found'; end if;
  -- Check again after taking the row lock so a retry never repeats a committed write.
  select response into v_response from public.operation_request
    where business_id=p_business_id and request_id=p_request_id;
  if found then return v_response; end if;
  if v_state.revision<>p_expected_revision then
    raise exception 'Workspace changed on another device. Refresh and review before saving.' using errcode='40001';
  end if;
  v_next:=p_next;
  if v_member.role<>'owner' then
    v_orders:=v_state.data->'orders';
    for v_order in select value from jsonb_array_elements(coalesce(p_next->'orders','[]'::jsonb)) loop
      select value into v_old_order from jsonb_array_elements(v_state.data->'orders')
        where value->>'id'=v_order->>'id';
      if v_old_order is null then raise exception 'Ticket not found' using errcode='42501'; end if;
      if v_order<>jsonb_set(v_old_order,'{payments}','[]'::jsonb,true) then
        if v_order-'status'-'statusHistory'<>jsonb_set(v_old_order,'{payments}','[]'::jsonb,true)-'status'-'statusHistory' then
          raise exception 'Staff may only change ticket status' using errcode='42501'; end if;
        v_change_count:=v_change_count+1;
        v_order:=jsonb_set(jsonb_set(v_old_order,'{status}',v_order->'status'),'{statusHistory}',v_order->'statusHistory');
        select jsonb_agg(case when value->>'id'=v_order->>'id' then v_order else value end)
          into v_orders from jsonb_array_elements(v_orders);
      end if;
    end loop;
    if v_change_count<>1 then raise exception 'One ticket update is required'; end if;
    v_next:=jsonb_set(v_state.data,'{orders}',v_orders);
  end if;
  perform public.validate_operations_change(p_business_id,v_state.data,v_next,p_action,
    v_member.role,v_member.employee_id);
  v_next:=jsonb_set(v_next,'{activity}','[]'::jsonb,true);
  perform public.rebuild_operations_indexes(p_business_id,v_next);
  update public.workspace_state set data=v_next,revision=revision+1,updated_at=now()
    where business_id=p_business_id;
  update public.businesses set name=coalesce(nullif(v_next#>>'{settings,businessName}',''),name),updated_at=now()
    where id=p_business_id;
  v_response:=public.read_operations(p_business_id);
  insert into public.operation_request(business_id,request_id,revision,response)
    values(p_business_id,p_request_id,v_state.revision+1,v_response);
  return v_response;
end $$;
revoke all on function public.apply_operations(uuid,bigint,text,jsonb,uuid) from public,anon;
grant execute on function public.apply_operations(uuid,bigint,text,jsonb,uuid) to authenticated;

create or replace function public.import_local_operations(
  p_business_id uuid,p_expected_revision bigint,p_import jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_state public.workspace_state%rowtype; v_response jsonb;
begin
  if not exists(select 1 from public.business_memberships where business_id=p_business_id
    and user_id=auth.uid() and active and role='owner')
    then raise exception 'Owner access required' using errcode='42501'; end if;
  select response into v_response from public.operation_request
    where business_id=p_business_id and request_id=p_request_id;
  if found then return v_response; end if;
  select * into v_state from public.workspace_state where business_id=p_business_id for update;
  if not found or v_state.revision<>p_expected_revision
    then raise exception 'Workspace changed. Review before importing.' using errcode='40001'; end if;
  if jsonb_array_length(coalesce(v_state.data->'orders','[]'::jsonb))<>0 or
     jsonb_array_length(coalesce(v_state.data->'attendance','[]'::jsonb))<>0 or
     jsonb_array_length(coalesce(v_state.data->'payrollBatches','[]'::jsonb))<>0 or
     jsonb_array_length(coalesce(v_state.data->'items','[]'::jsonb))<>0
    then raise exception 'Import requires an empty shared workspace'; end if;
  if p_import#>>'{settings,dataMode}'<>'live' then raise exception 'Only Live Local data may be imported'; end if;
  perform public.rebuild_operations_indexes(p_business_id,p_import);
  update public.workspace_state set data=jsonb_set(p_import,'{activity}','[]'::jsonb,true),
    revision=revision+1,updated_at=now() where business_id=p_business_id;
  v_response:=public.read_operations(p_business_id);
  insert into public.operation_request(business_id,request_id,revision,response)
    values(p_business_id,p_request_id,v_state.revision+1,v_response);
  return v_response;
end $$;
revoke all on function public.import_local_operations(uuid,bigint,jsonb,uuid) from public,anon;
grant execute on function public.import_local_operations(uuid,bigint,jsonb,uuid) to authenticated;

create or replace function public.set_business_member(
  p_business_id uuid,p_email text,p_role text,p_employee_id text,p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid;
begin
  if not exists(select 1 from public.business_memberships where business_id=p_business_id
    and user_id=auth.uid() and active and role='owner')
    then raise exception 'Owner access required' using errcode='42501'; end if;
  if p_role not in ('owner','kitchen','chef','rider') then raise exception 'Invalid role'; end if;
  select id into v_user_id from auth.users where lower(email)=lower(trim(p_email));
  if v_user_id is null then raise exception 'Create the user in Supabase Auth first'; end if;
  if v_user_id=auth.uid() and (not p_active or p_role<>'owner') then raise exception 'Owner cannot remove own owner access'; end if;
  insert into public.business_memberships(business_id,user_id,role,employee_id,display_name,active)
    values(p_business_id,v_user_id,p_role,p_employee_id,
      coalesce((select raw_user_meta_data->>'full_name' from auth.users where id=v_user_id),p_email),p_active)
    on conflict (business_id,user_id) do update set role=excluded.role,
      employee_id=excluded.employee_id,display_name=excluded.display_name,
      active=excluded.active,updated_at=now();
end $$;
revoke all on function public.set_business_member(uuid,text,text,text,boolean) from public,anon;
grant execute on function public.set_business_member(uuid,text,text,text,boolean) to authenticated;
