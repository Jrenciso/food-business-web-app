begin;

-- Dine-in is additive; existing Pickup and Delivery index rows stay unchanged.
alter table public.order_index drop constraint if exists order_index_order_type_check;
alter table public.order_index add constraint order_index_order_type_check
  check (order_type in ('pickup','delivery','dine-in'));

create or replace function public.validate_order_money(p_order jsonb,p_menu jsonb,p_areas jsonb)
returns void language plpgsql set search_path = '' as $$
declare v_line jsonb; v_item jsonb; v_area jsonb; v_subtotal bigint:=0;
        v_fee bigint; v_discount bigint; v_total bigint; v_quantity bigint; v_price bigint;
begin
  if coalesce(p_order->>'type','') not in ('pickup','delivery','dine-in')
    then raise exception 'Choose Pickup, Delivery, or Dine-in'; end if;
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
  if p_order->>'type' in ('pickup','dine-in') and v_fee<>0
    then raise exception 'Pickup and Dine-in cannot have a delivery fee'; end if;
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
  elsif p_order->>'type'='dine-in' then
    if nullif(trim(coalesce(p_order->>'address','')),'') is not null
       or nullif(trim(coalesce(p_order->>'landmark','')),'') is not null
       or nullif(trim(coalesce(p_order->>'riderId','')),'') is not null
       or nullif(trim(coalesce(p_order->>'deliveryAreaId','')),'') is not null
       or nullif(trim(coalesce(p_order->>'deliveryAreaLabel','')),'') is not null
       or nullif(trim(coalesce(p_order->>'deliveryFeeOverrideReason','')),'') is not null
       or coalesce((p_order->>'deliveryAreaFee')::bigint,0)<>0 then
      raise exception 'Dine-in cannot include delivery details';
    end if;
    if length(coalesce(p_order->>'dineInReference',''))>80 then
      raise exception 'Dine-in reference is too long';
    end if;
  end if;
end $$;
revoke all on function public.validate_order_money(jsonb,jsonb,jsonb) from public,anon,authenticated;

-- Validate persisted business-wide order display settings on every shared write.
create or replace function public.validate_new_order_display_settings()
returns trigger language plpgsql set search_path='' as $$
declare v_display jsonb; v_type text; v_enabled jsonb; v_order jsonb; v_is_new boolean;
begin
  v_display:=new.data#>'{settings,newOrderDisplay}';
  if v_display is not null then
    v_enabled:=v_display->'enabledOrderTypes';
    if jsonb_typeof(v_display)<>'object' or jsonb_typeof(v_enabled)<>'array'
       or jsonb_array_length(v_enabled)=0 then
      raise exception 'At least one new-order type must be enabled';
    end if;
    for v_type in select jsonb_array_elements_text(v_enabled) loop
      if v_type not in ('pickup','delivery','dine-in') then raise exception 'Unsupported new-order type'; end if;
    end loop;
    if not exists(select 1 from jsonb_array_elements_text(v_enabled) as t(value) where t.value=v_display->>'defaultOrderType') then
      raise exception 'Default order type must be enabled';
    end if;
    if v_display->>'layout' not in ('tiles','list') or v_display->>'tileSize' not in ('compact','standard','large')
       or v_display->>'showImages' not in ('true','false') then
      raise exception 'Invalid new-order display settings';
    end if;
  end if;
  for v_order in select value from jsonb_array_elements(coalesce(new.data->'orders','[]'::jsonb)) loop
    v_is_new:=tg_op='INSERT';
    if not v_is_new then
      select not exists(select 1 from jsonb_array_elements(coalesce(old.data->'orders','[]'::jsonb)) prior
        where prior->>'id'=v_order->>'id') into v_is_new;
    end if;
    if v_order->>'type'='dine-in' and v_order->>'status' in ('Picked up','Out for delivery') then
      raise exception 'Dine-in tickets cannot use delivery statuses';
    end if;
    if v_display is not null and v_is_new and not exists(
      select 1 from jsonb_array_elements_text(v_enabled) as enabled(value)
      where enabled.value=v_order->>'type') then
      raise exception 'This order type is disabled in New order settings';
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists workspace_new_order_settings_valid on public.workspace_state;
create trigger workspace_new_order_settings_valid before insert or update of data on public.workspace_state
for each row execute function public.validate_new_order_display_settings();

-- Staff need the menu and configured order-entry defaults, but retain the
-- existing restricted ticket, payment, payroll, and employee snapshots.
create or replace function public.read_operations(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_member public.business_memberships%rowtype; v_state public.workspace_state%rowtype;
  v_data jsonb; v_orders jsonb;
begin
  select * into v_member from public.business_memberships where business_id=p_business_id and user_id=auth.uid() and active;
  if not found then raise exception 'Access denied' using errcode='42501'; end if;
  select * into v_state from public.workspace_state where business_id=p_business_id;
  if not found then raise exception 'Workspace not found'; end if;
  v_data:=v_state.data;
  if v_member.role<>'owner' then
    select coalesce(jsonb_agg(jsonb_set(o.snapshot,'{payments}','[]'::jsonb,true) order by o.created_at desc),'[]'::jsonb)
      into v_orders from public.order_index o where o.business_id=p_business_id
       and (v_member.role<>'rider' or (o.order_type='delivery' and o.rider_employee_id=v_member.employee_id));
    v_data:=jsonb_build_object('orders',v_orders,
      'categories',coalesce(v_state.data->'categories','[]'::jsonb),
      'items',coalesce(v_state.data->'items','[]'::jsonb),
      'team',(select coalesce(jsonb_agg(jsonb_build_object('id',m.employee_id,'name',m.display_name,
        'role',m.role,'active',m.active,'rates','[]'::jsonb)),'[]'::jsonb)
        from public.business_memberships m where m.business_id=p_business_id and m.active),
      'attendance','[]'::jsonb,'adjustments','[]'::jsonb,'payrollRuns','[]'::jsonb,
      'payrollBatches','[]'::jsonb,'payrollDraft',null,
      'deliveryAreas',coalesce(v_state.data->'deliveryAreas','[]'::jsonb),
      'workShifts','[]'::jsonb,'activity','[]'::jsonb,
      'settings',jsonb_build_object('businessName',v_data#>>'{settings,businessName}',
        'currency',v_data#>>'{settings,currency}','timezone',v_data#>>'{settings,timezone}',
        'theme',v_data#>>'{settings,theme}','accent',v_data#>>'{settings,accent}',
        'newOrderDisplay',v_data#>'{settings,newOrderDisplay}','dataMode','live'),
      'nextTicket',coalesce(v_state.data->'nextTicket','1001'::jsonb));
  end if;
  return jsonb_build_object('data',v_data,'revision',v_state.revision,'role',v_member.role,
    'employeeId',v_member.employee_id,'displayName',v_member.display_name);
end $$;
revoke all on function public.read_operations(uuid) from public,anon;
grant execute on function public.read_operations(uuid) to authenticated;

-- Chef and kitchen accounts may create a single new ticket through this
-- constrained RPC. They cannot edit existing orders or any other workspace data.
create or replace function public.apply_staff_order(p_business_id uuid,p_expected_revision bigint,
  p_next jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_member public.business_memberships%rowtype; v_state public.workspace_state%rowtype;
  v_response jsonb; v_order jsonb; v_item jsonb; v_line jsonb; v_next jsonb;
  v_count integer; v_ticket bigint; v_enabled jsonb;
begin
  select * into v_member from public.business_memberships where business_id=p_business_id
    and user_id=auth.uid() and active and role in ('chef','kitchen');
  if not found or public.staff_password_change_required() then raise exception 'Access denied' using errcode='42501'; end if;
  select response into v_response from public.operation_request where business_id=p_business_id and request_id=p_request_id;
  if found then return v_response; end if;
  select * into v_state from public.workspace_state where business_id=p_business_id for update;
  if not found then raise exception 'Workspace not found'; end if;
  select response into v_response from public.operation_request where business_id=p_business_id and request_id=p_request_id;
  if found then return v_response; end if;
  if v_state.revision<>p_expected_revision then raise exception 'Workspace changed on another device. Refresh and review before saving.' using errcode='40001'; end if;
  if jsonb_typeof(p_next->'orders')<>'array' then raise exception 'Invalid order list'; end if;
  select count(*) into v_count from jsonb_array_elements(p_next->'orders') n
    where not exists(select 1 from jsonb_array_elements(v_state.data->'orders') o where o->>'id'=n.value->>'id');
  if v_count<>1 then raise exception 'Staff may create one new ticket at a time' using errcode='42501'; end if;
  select n.value into v_order from jsonb_array_elements(p_next->'orders') n
    where not exists(select 1 from jsonb_array_elements(v_state.data->'orders') o where o->>'id'=n.value->>'id');
  v_ticket:=coalesce((v_state.data->>'nextTicket')::bigint,1001);
  if v_order->>'number'<>v_ticket::text or v_order->>'status'<>'New'
    or jsonb_typeof(v_order->'payments')<>'array' or jsonb_array_length(v_order->'payments')<>0
    or coalesce((v_order->>'sample')::boolean,false) then
    raise exception 'Staff tickets must start with the next ticket number, New, unpaid, and live';
  end if;
  if nullif(trim(v_order->>'customer'),'') is null or nullif(trim(v_order->>'contact'),'') is null
    then raise exception 'Customer name and contact are required'; end if;
  v_enabled:=coalesce(v_state.data#>'{settings,newOrderDisplay,enabledOrderTypes}','["pickup","delivery","dine-in"]'::jsonb);
  if not exists(select 1 from jsonb_array_elements_text(v_enabled) as e(value) where e.value=v_order->>'type')
    then raise exception 'This order type is disabled in New order settings' using errcode='42501'; end if;
  perform public.validate_order_money(v_order,v_state.data->'items',v_state.data->'deliveryAreas');
  for v_line in select value from jsonb_array_elements(v_order->'lines') loop
    select value into v_item from jsonb_array_elements(v_state.data->'items') where value->>'id'=v_line->>'itemId';
    if v_item is null or v_item->>'available'<>'true' or v_item->>'name'<>v_line->>'name'
       or v_item->>'price'<>v_line->>'unitPrice' then raise exception 'Order item does not match the active menu'; end if;
  end loop;
  if v_order->>'type'='delivery' and not exists(select 1 from public.business_memberships m
    where m.business_id=p_business_id and m.active and m.role='rider' and m.employee_id=v_order->>'riderId') then
    raise exception 'Choose an active rider for delivery';
  end if;
  v_next:=jsonb_set(v_state.data,'{orders}',coalesce(v_state.data->'orders','[]'::jsonb)||jsonb_build_array(v_order),true);
  v_next:=jsonb_set(v_next,'{nextTicket}',to_jsonb(v_ticket+1),true);
  perform public.rebuild_operations_indexes(p_business_id,v_next);
  update public.workspace_state set data=v_next,revision=revision+1,updated_at=now() where business_id=p_business_id;
  v_response:=public.read_operations(p_business_id);
  insert into public.operation_request(business_id,request_id,revision,response)
    values(p_business_id,p_request_id,v_state.revision+1,v_response);
  return v_response;
end $$;
revoke all on function public.apply_staff_order(uuid,bigint,jsonb,uuid) from public,anon;
grant execute on function public.apply_staff_order(uuid,bigint,jsonb,uuid) to authenticated;

-- Private images are addressed by business/item folders. Members may read their
-- business images; only active owners may upload, replace, or remove images.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('menu-item-images','menu-item-images',false,1572864,array['image/webp'])
on conflict(id) do update set public=false,file_size_limit=1572864,allowed_mime_types=array['image/webp'];
create or replace function public.can_access_menu_images(p_business_id uuid,p_owner_only boolean)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.business_memberships m where m.business_id=p_business_id
    and m.user_id=auth.uid() and m.active and (not p_owner_only or m.role='owner'));
$$;
revoke all on function public.can_access_menu_images(uuid,boolean) from public,anon;
grant execute on function public.can_access_menu_images(uuid,boolean) to authenticated;
drop policy if exists "Menu images readable by business members" on storage.objects;
create policy "Menu images readable by business members" on storage.objects for select to authenticated
using(bucket_id='menu-item-images' and public.can_access_menu_images((storage.foldername(name))[1]::uuid,false));
drop policy if exists "Owners upload menu images" on storage.objects;
create policy "Owners upload menu images" on storage.objects for insert to authenticated
with check(bucket_id='menu-item-images' and public.can_access_menu_images((storage.foldername(name))[1]::uuid,true));
drop policy if exists "Owners update menu images" on storage.objects;
create policy "Owners update menu images" on storage.objects for update to authenticated
using(bucket_id='menu-item-images' and public.can_access_menu_images((storage.foldername(name))[1]::uuid,true))
with check(bucket_id='menu-item-images' and public.can_access_menu_images((storage.foldername(name))[1]::uuid,true));
drop policy if exists "Owners delete menu images" on storage.objects;
create policy "Owners delete menu images" on storage.objects for delete to authenticated
using(bucket_id='menu-item-images' and public.can_access_menu_images((storage.foldername(name))[1]::uuid,true));

notify pgrst,'reload schema';
commit;
