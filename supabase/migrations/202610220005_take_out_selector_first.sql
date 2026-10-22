begin;

-- Add Take-out without changing existing ticket rows or their stored amounts.
alter table public.order_index drop constraint if exists order_index_order_type_check;
alter table public.order_index add constraint order_index_order_type_check
  check (order_type in ('pickup','take-out','delivery','dine-in'));

create or replace function public.validate_order_money(p_order jsonb,p_menu jsonb,p_areas jsonb)
returns void language plpgsql set search_path = '' as $$
declare v_line jsonb; v_item jsonb; v_area jsonb; v_subtotal bigint:=0;
        v_fee bigint; v_discount bigint; v_total bigint; v_quantity bigint; v_price bigint;
begin
  if coalesce(p_order->>'type','') not in ('pickup','take-out','delivery','dine-in')
    then raise exception 'Choose Pickup, Take-out, Delivery, or Dine-in'; end if;
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
    if nullif(trim(coalesce(p_order->>'dineInReference','')),'') is not null
      then raise exception 'Delivery cannot include a dine-in reference'; end if;
  else
    if v_fee<>0
       or nullif(trim(coalesce(p_order->>'address','')),'') is not null
       or nullif(trim(coalesce(p_order->>'landmark','')),'') is not null
       or nullif(trim(coalesce(p_order->>'riderId','')),'') is not null
       or nullif(trim(coalesce(p_order->>'deliveryAreaId','')),'') is not null
       or nullif(trim(coalesce(p_order->>'deliveryAreaLabel','')),'') is not null
       or nullif(trim(coalesce(p_order->>'deliveryFeeOverrideReason','')),'') is not null
       or coalesce((p_order->>'deliveryAreaFee')::bigint,0)<>0 then
      raise exception 'Pickup, Take-out, and Dine-in cannot include delivery details or fees';
    end if;
    if p_order->>'type'='dine-in' then
      if length(coalesce(p_order->>'dineInReference',''))>80 then raise exception 'Dine-in reference is too long'; end if;
    elsif nullif(trim(coalesce(p_order->>'dineInReference','')),'') is not null then
      raise exception 'Only Dine-in can include a table or dine-in reference';
    end if;
  end if;
end $$;
revoke all on function public.validate_order_money(jsonb,jsonb,jsonb) from public,anon,authenticated;

-- Validate shared display preferences and enabled types without preselecting a type.
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
      if v_type not in ('pickup','take-out','delivery','dine-in') then raise exception 'Unsupported new-order type'; end if;
    end loop;
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

-- Existing businesses gain the newly introduced type in their default list.
-- Preserve every existing preference and ticket unchanged.
update public.workspace_state w set
  data=jsonb_set(w.data,'{settings,newOrderDisplay}',
    coalesce(w.data#>'{settings,newOrderDisplay}','{}'::jsonb)
    || jsonb_build_object(
      'showImages',coalesce(w.data#>'{settings,newOrderDisplay,showImages}','true'::jsonb),
      'layout',coalesce(w.data#>'{settings,newOrderDisplay,layout}','"tiles"'::jsonb),
      'tileSize',coalesce(w.data#>'{settings,newOrderDisplay,tileSize}','"standard"'::jsonb),
      'enabledOrderTypes',case
        when coalesce(w.data#>'{settings,newOrderDisplay,enabledOrderTypes}','["pickup","delivery","dine-in"]'::jsonb) @> '["take-out"]'::jsonb
          then coalesce(w.data#>'{settings,newOrderDisplay,enabledOrderTypes}','["pickup","delivery","dine-in"]'::jsonb)
        else coalesce(w.data#>'{settings,newOrderDisplay,enabledOrderTypes}','["pickup","delivery","dine-in"]'::jsonb)||'["take-out"]'::jsonb
      end),true),
  revision=w.revision+1,updated_at=now();

notify pgrst,'reload schema';
commit;
