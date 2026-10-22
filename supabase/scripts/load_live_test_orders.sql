-- One-time live fixture load: add 50 clearly labeled TEST orders to Urban Casero.
-- Uses the current live menu, enabled order types, delivery setup, and payment methods.
-- Existing business records are preserved. Run once in the Supabase SQL Editor.
begin;

do $seed$
declare
  v_business_id uuid;
  v_state public.workspace_state%rowtype;
  v_data jsonb;
  v_orders jsonb;
  v_items jsonb;
  v_areas jsonb;
  v_riders jsonb;
  v_methods jsonb;
  v_types text[];
  v_supported text[] := array['pickup','take-out','delivery','dine-in'];
  v_batch text := 'live-order-module-50-20261022';
  v_generation text := substr(gen_random_uuid()::text,1,8);
  v_owner_id text;
  v_owner_name text;
  v_next_ticket bigint;
  v_first_ticket bigint;
  v_type text;
  v_path text[];
  v_path_length integer;
  v_line_count integer;
  v_item jsonb;
  v_area jsonb;
  v_rider jsonb;
  v_method jsonb;
  v_lines jsonb;
  v_line jsonb;
  v_history jsonb;
  v_payments jsonb;
  v_order jsonb;
  v_created timestamptz;
  v_paid_at timestamptz;
  v_total bigint;
  v_subtotal bigint;
  v_delivery_fee bigint;
  v_discount bigint;
  v_quantity integer;
  v_paid bigint;
  v_status text;
  v_ticket bigint;
  v_order_id text;
  v_contact text;
  v_customer text;
  v_type_ordinal integer;
  i integer;
  j integer;
begin
  select count(*) into i
  from public.businesses b
  where lower(trim(b.name)) = 'urban casero';
  if i <> 1 then
    raise exception 'Expected exactly one live business named Urban Casero; found %', i;
  end if;

  select b.id into v_business_id
  from public.businesses b
  where lower(trim(b.name)) = 'urban casero';

  select * into v_state
  from public.workspace_state
  where business_id = v_business_id
  for update;
  if not found then raise exception 'Urban Casero live workspace was not found'; end if;

  v_data := v_state.data;
  v_orders := coalesce(v_data->'orders','[]'::jsonb);
  if exists (
    select 1 from jsonb_array_elements(v_orders) o
    where o->>'testDataSeed' = v_batch
  ) then raise exception 'This 50-order test batch already exists; no rows were added'; end if;

  select coalesce(jsonb_agg(value),'[]'::jsonb) into v_items
  from jsonb_array_elements(coalesce(v_data->'items','[]'::jsonb)) item(value)
  where value->>'available' = 'true'
    and coalesce(value->>'price','') ~ '^[0-9]+$'
    and (value->>'price')::bigint >= 0;
  if jsonb_array_length(v_items) = 0 then raise exception 'No available menu items with valid prices'; end if;

  select coalesce(jsonb_agg(value),'[]'::jsonb) into v_areas
  from jsonb_array_elements(coalesce(v_data->'deliveryAreas','[]'::jsonb)) area(value)
  where value->>'active' = 'true';
  select coalesce(jsonb_agg(value),'[]'::jsonb) into v_riders
  from jsonb_array_elements(coalesce(v_data->'team','[]'::jsonb)) member(value)
  where value->>'active' = 'true' and value->>'role' = 'rider';
  select coalesce(jsonb_agg(value),'[]'::jsonb) into v_methods
  from jsonb_array_elements(coalesce(v_data#>'{settings,paymentMethods}','[]'::jsonb)) method(value)
  where value->>'active' = 'true' and nullif(value->>'id','') is not null
    and nullif(value->>'label','') is not null;

  if jsonb_array_length(v_methods) = 0 then
    raise exception 'Enable at least one payment method in the live workspace before loading payment examples';
  end if;
  if jsonb_array_length(v_areas) = 0 or jsonb_array_length(v_riders) = 0 then
    if coalesce(v_data#>'{settings,newOrderDisplay,enabledOrderTypes}','["pickup","take-out","delivery","dine-in"]'::jsonb) ? 'delivery' then
      raise exception 'Delivery is enabled but needs an active delivery area and rider';
    end if;
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(v_data#>'{settings,newOrderDisplay,enabledOrderTypes}',
      '["pickup","take-out","delivery","dine-in"]'::jsonb)) enabled(value)
    where enabled.value <> all(v_supported)
  ) then raise exception 'Live New order settings contain an unsupported order type'; end if;

  select array_agg(choices.order_type order by array_position(v_supported,choices.order_type)) into v_types
  from unnest(v_supported) as choices(order_type)
  where coalesce(v_data#>'{settings,newOrderDisplay,enabledOrderTypes}',
      '["pickup","take-out","delivery","dine-in"]'::jsonb) ? choices.order_type
    and (choices.order_type <> 'delivery' or (jsonb_array_length(v_areas) > 0 and jsonb_array_length(v_riders) > 0));
  if coalesce(cardinality(v_types),0) = 0 then raise exception 'No enabled and configured order types are available'; end if;

  select coalesce(value->>'id','owner'),coalesce(value->>'name','TEST DATA LOAD')
    into v_owner_id,v_owner_name
  from jsonb_array_elements(coalesce(v_data->'team','[]'::jsonb)) member(value)
  where value->>'role'='owner'
  limit 1;
  v_owner_id := coalesce(v_owner_id,'owner');
  v_owner_name := coalesce(v_owner_name,'TEST DATA LOAD');

  select coalesce(max((value->>'number')::bigint),0)+1 into v_first_ticket
  from jsonb_array_elements(v_orders) existing(value)
  where coalesce(value->>'number','') ~ '^[0-9]{1,18}$';
  if coalesce(v_data->>'nextTicket','') !~ '^[0-9]{1,18}$' then
    raise exception 'Live next ticket number is missing or invalid';
  end if;
  v_next_ticket := (v_data->>'nextTicket')::bigint;
  v_first_ticket := greatest(v_first_ticket,v_next_ticket);

  for i in 1..50 loop
    v_type := v_types[((i-1) % cardinality(v_types))+1];
    v_type_ordinal := (i-1) / cardinality(v_types);
    v_order_id := 'test-live-' || v_generation || '-' || lpad(i::text,3,'0');
    v_ticket := v_first_ticket + i - 1;
    v_created := date_trunc('minute',now() - interval '1 day' - random()*interval '29 days');
    v_customer := 'TEST-' || (array['Mia','Juan','Alex','Sam','Jo','Nico','Lea','Rafi','Kai','Toni'])[((i-1)%10)+1]
      || ' ' || (array['Sample','Demo','Fixture','Preview','Example'])[((i-1)%5)+1] || ' ' || lpad(i::text,3,'0');
    v_contact := 'TEST-LIVE-20261022-' || lpad(i::text,3,'0');

    v_lines := '[]'::jsonb;
    v_subtotal := 0;
    v_line_count := 1 + floor(random()*5)::integer;
    for j in 1..v_line_count loop
      v_item := v_items->floor(random()*jsonb_array_length(v_items))::integer;
      v_quantity := 1 + floor(random()*3)::integer;
      v_line := jsonb_build_object(
        'itemId',v_item->>'id','name',v_item->>'name','unitPrice',(v_item->>'price')::bigint,
        'quantity',v_quantity,
        'note',case when random()<0.2 then (array['Sauce on the side','Less spicy','Pack separately','No garnish'])[((i+j)%4)+1] else '' end
      );
      v_lines := v_lines || jsonb_build_array(v_line);
      v_subtotal := v_subtotal + (v_item->>'price')::bigint*v_quantity;
    end loop;

    v_area := null;
    v_rider := null;
    v_delivery_fee := 0;
    if v_type = 'delivery' then
      v_area := v_areas->floor(random()*jsonb_array_length(v_areas))::integer;
      v_rider := v_riders->floor(random()*jsonb_array_length(v_riders))::integer;
      v_delivery_fee := coalesce((v_area->>'fee')::bigint,0);
    end if;
    v_discount := case when random()<0.25 then least(v_subtotal,
      floor(v_subtotal*(5+floor(random()*8)::bigint)/10000)::bigint*100) else 0 end;
    v_total := v_subtotal+v_delivery_fee-v_discount;

    if i % 25 = 0 then
      v_path := array['New','Cancelled'];
      v_path_length := 2;
    elsif v_type = 'delivery' then
      v_path := array['New','Preparing','Ready','Picked up','Out for delivery','Completed'];
      v_path_length := 1+(v_type_ordinal%cardinality(v_path));
    elsif v_type = 'dine-in' then
      v_path := array['New','Preparing','Ready','Completed'];
      v_path_length := 1+(v_type_ordinal%cardinality(v_path));
    else
      v_path := array['New','Preparing','Ready','Picked up','Completed'];
      v_path_length := 1+(v_type_ordinal%cardinality(v_path));
    end if;

    v_history := '[]'::jsonb;
    for j in 1..v_path_length loop
      v_history := v_history || jsonb_build_array(jsonb_build_object(
        'status',v_path[j],'at',v_created+(j-1)*interval '15 minutes'));
    end loop;
    v_status := v_path[v_path_length];

    v_payments := '[]'::jsonb;
    if v_status <> 'Cancelled' and v_total > 1 and i%3 <> 0 then
      v_method := v_methods->((i-1)%jsonb_array_length(v_methods));
      v_paid := case when i%3 = 2 then v_total else greatest(1,floor(v_total*0.4)::bigint) end;
      if v_paid >= v_total then v_paid := v_total-1; end if;
      if i%3 = 2 then v_paid := v_total; end if;
      v_paid_at := v_created+v_path_length*interval '15 minutes'+interval '5 minutes';
      v_payments := jsonb_build_array(jsonb_build_object(
        'id','test-payment-'||v_generation||'-'||lpad(i::text,3,'0'),
        'amount',v_paid,'method',v_method->>'id','methodLabel',v_method->>'label',
        'reference','TEST-PAY-'||v_generation||'-'||lpad(i::text,3,'0'),
        'at',v_paid_at,'kind','payment','receivedById',v_owner_id,
        'receivedByName',v_owner_name,'receivedByRole','owner'));
    end if;

    v_order := jsonb_build_object(
      'id',v_order_id,'number',v_ticket::text,'createdAt',v_created,'type',v_type,
      'dineInReference',case when v_type='dine-in' then 'TEST Table '||((i-1)%12+1)::text else '' end,
      'customer',v_customer,'contact',v_contact,
      'address',case when v_type='delivery' then 'TEST DELIVERY — '||(100+i)::text||' Fictional Demo Street, Sample Barangay' else '' end,
      'landmark',case when v_type='delivery' then 'TEST LANDMARK — demo marker' else '' end,
      'notes','TEST DATA FIXTURE · batch '||v_batch,
      'lines',v_lines,'subtotal',v_subtotal,'deliveryFee',v_delivery_fee,
      'deliveryAreaId',case when v_type='delivery' then v_area->>'id' else '' end,
      'deliveryAreaLabel',case when v_type='delivery' then v_area->>'label' else '' end,
      'deliveryAreaFee',case when v_type='delivery' then v_delivery_fee else 0 end,
      'discount',v_discount,'total',v_total,'status',v_status,'statusHistory',v_history,
      'payments',v_payments,'riderId',case when v_type='delivery' then v_rider->>'id' else '' end,
      'sample',false,'testData','live-order-module-fixture','testDataSeed',v_batch
    );

    perform public.validate_order_money(v_order,v_data->'items',v_data->'deliveryAreas');
    v_orders := v_orders || jsonb_build_array(v_order);
  end loop;

  v_data := jsonb_set(v_data,'{orders}',v_orders,true);
  v_data := jsonb_set(v_data,'{nextTicket}',to_jsonb(v_first_ticket+50),true);
  perform public.rebuild_operations_indexes(v_business_id,v_data);
  update public.workspace_state
  set data=v_data,revision=revision+1,updated_at=now()
  where business_id=v_business_id;
  raise notice 'Added 50 TEST orders. Ticket numbers: % through %.',v_first_ticket,v_first_ticket+49;
end
$seed$;

-- Verification summary for this batch.
select
  b.name as business,
  count(*) as test_orders,
  count(distinct o.value->>'type') as order_types,
  count(distinct o.value->>'status') as order_statuses,
  count(distinct case when jsonb_array_length(o.value->'payments')=0 then 'unpaid'
    when (select coalesce(sum((p.value->>'amount')::bigint),0)
      from jsonb_array_elements(o.value->'payments') p(value)
      where p.value->>'kind'='payment') < (o.value->>'total')::bigint then 'partially paid'
    else 'paid' end) as payment_statuses
from public.businesses b
join public.workspace_state w on w.business_id=b.id
cross join lateral jsonb_array_elements(w.data->'orders') o(value)
where lower(trim(b.name))='urban casero'
  and o.value->>'testDataSeed'='live-order-module-50-20261022'
group by b.name;

commit;
