import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const base = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(base, serviceKey, { auth: { persistSession: false } });
const emailFor = (username: string) => `${username}@staff.urbancasero.invalid`;
const validName = (name: string) => /^[a-z][a-z0-9_]{3,31}$/.test(name);
const password = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, value => alphabet[value % alphabet.length]).join('');
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store',
    'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info' },
});

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
    'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS',
  } });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const jwt = request.headers.get('authorization')?.replace(/^Bearer /i, '');
  if (!jwt) return json({ error: 'Sign in required' }, 401);
  const { data: identity, error: identityError } = await admin.auth.getUser(jwt);
  if (identityError || !identity.user) return json({ error: 'Sign in required' }, 401);
  let input: Record<string, unknown>;
  try { input = await request.json(); } catch { return json({ error: 'Invalid request' }, 400); }
  const action = String(input.action || '');
  const businessId = String(input.businessId || '');
  const employeeId = String(input.employeeId || '');
  const username = String(input.username || '').trim().toLowerCase();
  const scoped = createClient(base, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false },
  });
  if (action === 'change-password') {
    const { data: allowed } = await scoped.rpc('allow_credential_operation');
    if (!allowed) return json({ error: 'Too many account requests. Try again later.' }, 429);
    const next = String(input.password || '');
    if (next.length < 12 || next.length > 128 || !/[a-z]/.test(next) || !/[A-Z]/.test(next) || !/\d/.test(next))
      return json({ error: 'Use 12 or more characters with upper and lower case letters and a number.' }, 400);
    const { data: account } = await admin.from('staff_accounts').select('user_id').eq('user_id', identity.user.id).maybeSingle();
    if (!account) return json({ error: 'Account unavailable' }, 403);
    const { error: changed } = await admin.auth.admin.updateUserById(identity.user.id, { password: next });
    if (changed) return json({ error: changed.message }, 400);
    const { error: marked } = await admin.from('staff_accounts').update({ must_change_password: false }).eq('user_id', identity.user.id);
    if (marked) return json({ error: 'Password changed; ask the owner to reset access before continuing.' }, 500);
    return json({ ok: true });
  }

  // Check ownership through the same security-definer RPC used by the app.
  // This keeps the authorization decision tied to the caller's JWT and avoids
  // silently treating an admin-client lookup error as a missing membership.
  const { data: memberships, error: membershipError } = await scoped.rpc('my_businesses');
  if (membershipError) {
    console.error('staff-accounts membership lookup failed:', membershipError.message);
    return json({ error: 'Could not verify business access' }, 500);
  }
  const owner = memberships?.some((membership: { business_id: string; member_role: string }) =>
    membership.business_id === businessId && membership.member_role === 'owner');
  if (!owner) return json({ error: 'Access denied' }, 403);
  if (action === 'list') {
    const { data, error } = await admin.from('staff_accounts').select('username,employee_id,user_id,must_change_password')
      .eq('business_id', businessId);
    if (error) {
      console.error('staff-accounts list query failed:', error);
      return json({ error: `Could not load accounts: ${error.message}` }, 500);
    }
    const { data: memberships } = await admin.from('business_memberships').select('user_id,active').eq('business_id', businessId);
    return json({ accounts: data?.map(account => ({ username: account.username, employee_id: account.employee_id,
      must_change_password: account.must_change_password,
      active: memberships?.find(member => member.user_id === account.user_id)?.active === true })) });
  }
  const { data: allowed } = await scoped.rpc('allow_credential_operation');
  if (!allowed) return json({ error: 'Too many account requests. Try again later.' }, 429);
  // Load the canonical workspace using the caller's authorized RPC, matching
  // the snapshot the Employees screen rendered. Direct table access here can
  // be filtered by RLS and make a valid employee look missing.
  const { data: workspace, error: workspaceError } = await scoped.rpc('read_operations', { p_business_id: businessId });
  if (workspaceError || !workspace) {
    console.error('staff-accounts workspace lookup failed:', workspaceError?.message || 'No workspace returned');
    return json({ error: 'Could not load the selected employee profile' }, 500);
  }
  const employee = (workspace.data?.team || []).find((row: { id: string }) => row.id === employeeId);
  if (!employee || employee.role === 'owner') return json({ error: 'Select a non-owner employee profile' }, 400);
  if (action === 'create') {
    if (!employee.active || !validName(username)) return json({ error: 'Choose an active employee and a valid username' }, 400);
    const { data: existing } = await admin.from('staff_accounts').select('username').eq('username', username).maybeSingle();
    if (existing) return json({ error: 'Username unavailable' }, 409);
    const initialPassword = password();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: emailFor(username), password: initialPassword, email_confirm: true,
      app_metadata: { account_type: 'staff_username' },
    });
    if (createError || !created.user) {
      console.error('staff-accounts auth user creation failed:', createError?.message || 'No user returned');
      return json({ error: `Could not create sign-in: ${createError?.message || 'No user returned'}` }, 500);
    }
    const userId = created.user.id;
    const { error: accountError } = await admin.from('staff_accounts').insert({ username, business_id: businessId, employee_id: employeeId, user_id: userId });
    if (accountError) {
      console.error('staff-accounts row creation failed:', accountError.message);
      await admin.auth.admin.deleteUser(userId);
      return json({ error: `Could not save staff account: ${accountError.message}` }, 500);
    }
    const { error: memberError } = await admin.from('business_memberships').upsert({
      business_id: businessId, user_id: userId, role: employee.role, employee_id: employeeId,
      display_name: employee.name, active: true,
    }, { onConflict: 'business_id,user_id' });
    if (memberError) {
      console.error('staff-accounts membership creation failed:', memberError.message);
      await admin.auth.admin.deleteUser(userId);
      return json({ error: `Could not save staff access: ${memberError.message}` }, 500);
    }
    return json({ username, temporaryPassword: initialPassword });
  }
  const { data: account } = await admin.from('staff_accounts').select('user_id,username')
    .eq('business_id', businessId).eq('employee_id', employeeId).maybeSingle();
  if (!account) return json({ error: 'Account unavailable' }, 404);
  if (action === 'reset') {
    const initialPassword = password();
    const { error } = await admin.auth.admin.updateUserById(account.user_id, { password: initialPassword });
    if (error) return json({ error: 'Could not reset password' }, 500);
    await admin.from('staff_accounts').update({ must_change_password: true, issued_at: new Date().toISOString() })
      .eq('user_id', account.user_id);
    return json({ username: account.username, temporaryPassword: initialPassword });
  }
  if (action === 'disable' || action === 'enable') {
    if (action === 'enable' && !employee.active) return json({ error: 'Activate the employee profile first' }, 400);
    const active = action === 'enable';
    let query = admin.from('business_memberships').update({ active, role: employee.role,
      display_name: employee.name, updated_at: new Date().toISOString() }).eq('business_id', businessId);
    // Disabling this employee closes any older email membership too.
    query = active ? query.eq('user_id', account.user_id) : query.eq('employee_id', employeeId).neq('role', 'owner');
    const { error } = await query;
    if (error) return json({ error: 'Could not change access' }, 500);
    if (!active) await admin.from('rider_current_location').delete().eq('business_id', businessId).eq('user_id', account.user_id);
    return json({ ok: true });
  }
  return json({ error: 'Unknown account request' }, 400);
});
