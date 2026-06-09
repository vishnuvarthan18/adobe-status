import { createClient } from '@supabase/supabase-js';
import { getCached, setCached } from '../../lib/statusCache.js';

const MS_PER_DAY = 86400000;

export async function POST(request) {
  try {
    console.log('[check-status] Request received');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('[check-status] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'MISSING');
    console.log('[check-status] Service role key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING');

    const { email } = await request.json();
    console.log('[check-status] Received email:', email);

    if (!email) return Response.json({ found: false, error: 'Email is required' }, { status: 400 });

    const key = email.toLowerCase().trim();

    const cached = getCached(key);
    if (cached) {
      console.log('[check-status] Cache hit for:', key);
      return Response.json(cached);
    }

    // Step 1: find user by email
    console.log('[check-status] Step 1: querying users table for:', key);
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name')
      .eq('email', key)
      .single();

    console.log('[check-status] User query result:', JSON.stringify(user));
    if (userError) console.error('[check-status] User query error:', userError.message, userError.code);

    if (!user) return Response.json({ found: false, error: 'Email not found in our system' });

    // Step 2: get subscription
    console.log('[check-status] Step 2: querying subscriptions for user_id:', user.id);
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('activated_at', { ascending: false })
      .limit(1)
      .single();

    console.log('[check-status] Subscription query result:', JSON.stringify(sub));
    if (subError) console.error('[check-status] Subscription query error:', subError.message, subError.code);

    if (!sub) return Response.json({ found: false, error: 'Email not found in our system' });

    // Step 3: fetch org name from external API
    let organization = 'Organization data not available';
    try {
      console.log('[check-status] Step 3: API call to main company for:', key);
      const res = await fetch('https://reseller.ado-besoft.com/api/user-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: key }),
        signal: AbortSignal.timeout(5000),
      });
      console.log('[check-status] External API status:', res.status);
      const data = await res.json();
      console.log('[check-status] External API response:', JSON.stringify(data));
      if (data?.organization?.name) organization = data.organization.name;
      else if (data?.organization) organization = data.organization;
      else if (data?.org) organization = data.org;
    } catch (extErr) {
      console.error('[check-status] External API error:', extErr.message);
    }

    // Step 4: calculate from real dates
    console.log('[check-status] Step 4: calculating dates');
    const now = Date.now();
    const expiresMs = new Date(sub.expires_at).getTime();
    const activatedMs = new Date(sub.activated_at).getTime();
    const totalDuration = expiresMs - activatedMs;
    const isLifetime = sub.plan_type === 'lifetime';

    const daysRemaining = isLifetime ? null : Math.ceil((expiresMs - now) / MS_PER_DAY);
    const elapsed = now - activatedMs;
    const progressPercent = isLifetime
      ? 100
      : totalDuration > 0
        ? Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)))
        : 0;

    console.log('[check-status] daysRemaining:', daysRemaining, '| progressPercent:', progressPercent);

    const result = {
      found: true,
      email: key,
      name: user.name,
      organization,
      planName: sub.plan_name,
      planType: sub.plan_type,
      status: sub.status,
      activatedAt: sub.activated_at,
      expiresAt: sub.expires_at,
      progressPercent,
      daysRemaining,
    };

    setCached(key, result);
    console.log('[check-status] Success — returning result for:', key);
    return Response.json(result);

  } catch (err) {
    console.error('[check-status] UNHANDLED ERROR:', err.message);
    console.error('[check-status] Stack:', err.stack);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}
