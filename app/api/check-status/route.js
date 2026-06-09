import { createClient } from '@supabase/supabase-js';
import { getCached, setCached } from '../../lib/statusCache.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MS_PER_DAY = 86400000;

export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email) return Response.json({ found: false, error: 'Email is required' }, { status: 400 });

    const key = email.toLowerCase().trim();

    const cached = getCached(key);
    if (cached) return Response.json(cached);

    // Step 1: find user by email
    const { data: user } = await supabase
      .from('users')
      .select('id, name')
      .eq('email', key)
      .single();

    if (!user) return Response.json({ found: false, error: 'Email not found in our system' });

    // Step 2: get subscription
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('activated_at', { ascending: false })
      .limit(1)
      .single();

    if (!sub) return Response.json({ found: false, error: 'Email not found in our system' });

    // Step 3: fetch org name only from external API
    let organization = 'Organization data not available';
    try {
      const res = await fetch('https://reseller.ado-besoft.com/api/user-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: key }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      if (data?.organization?.name) organization = data.organization.name;
      else if (data?.organization) organization = data.organization;
      else if (data?.org) organization = data.org;
    } catch {}

    // Step 4: calculate from real dates
    const now = Date.now();
    const expiresMs = new Date(sub.expires_at).getTime();
    const activatedMs = new Date(sub.activated_at).getTime();
    const totalDuration = expiresMs - activatedMs;
    const isLifetime = sub.plan_type === 'lifetime';

    const daysRemaining = isLifetime ? null : Math.ceil((expiresMs - now) / MS_PER_DAY);
    // progressPercent = elapsed time as % of total duration ("X% complete")
    const elapsed = now - activatedMs;
    const progressPercent = isLifetime
      ? 100
      : totalDuration > 0
        ? Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)))
        : 0;

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
    return Response.json(result);
  } catch (err) {
    console.error('check-status error:', err);
    return Response.json({ found: false, error: 'An error occurred. Please try again.' }, { status: 500 });
  }
}
