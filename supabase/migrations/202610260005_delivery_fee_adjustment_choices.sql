-- Restrict delivery fee adjustments to Free DF or a strictly lower discounted fee.
begin;

create or replace function public.validate_order_money(p_order jsonb,p_menu jsonb,p_areas jsonb)
returns void language plpgsql set search_path = '' as $$
declare v_line jsonb; v_item jsonb; v_area jsonb; v_subtotal bigint:=0;
        v_fee bigint; v_discount bigint; v_total bigint; v_quantity bigint; v_price bigint;
        v_area_fee bigint; v_fee_adjustment text;
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
    v_area_fee:=(v_area->>'fee')::bigint;
    v_fee_adjustment:=coalesce(p_order->>'deliveryFeeOverrideReason','');
    if v_fee_adjustment='' then
      if v_fee<>v_area_fee then raise exception 'Delivery fee does not match the selected area'; end if;
    elsif v_fee_adjustment='free-df' then
      if v_area_fee<=0 or v_fee<>0 then raise exception 'Free DF must set the delivery fee to zero for a paid delivery area'; end if;
    elsif v_fee_adjustment='df-discount' then
      if v_fee<=0 or v_fee>=v_area_fee then raise exception 'DF Discount must be greater than zero and less than the assigned area fee'; end if;
    elsif v_fee>=0 and v_fee<v_area_fee then
      -- Older deployed clients sent a free-text reason. Keep them working while
      -- still enforcing the strict lower-than-area-fee rule during rollout.
      null;
    else
      raise exception 'Choose Free DF or DF Discount and enter a fee below the assigned area fee';
    end if;
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

notify pgrst, 'reload schema';
commit;
