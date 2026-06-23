import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

const REVOKE_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours

// ── Business hours queue ──────────────────────────────────────────────────────
const BIZ_TZ    = process.env.BUSINESS_TIMEZONE || 'Asia/Kolkata';
const BIZ_OPEN  = 9;
const BIZ_CLOSE = 18;

function getBizHour(date) {
  return parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: BIZ_TZ, hour: 'numeric', hour12: false }).format(date),
    10
  );
}

function computeQueuedUntil(requestedAt) {
  const date = new Date(requestedAt);
  const hour = getBizHour(date);
  if (hour >= BIZ_OPEN && hour < BIZ_CLOSE) return null;

  const base = hour >= BIZ_CLOSE
    ? new Date(date.getTime() + 24 * 60 * 60 * 1000)
    : date;

  const dtParts = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: BIZ_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(base).forEach(p => { if (p.type !== 'literal') dtParts[p.type] = p.value; });

  const naiveUTC   = new Date(`${dtParts.year}-${dtParts.month}-${dtParts.day}T09:00:00Z`);
  const actualHour = getBizHour(naiveUTC);
  return new Date(naiveUTC.getTime() + (BIZ_OPEN - actualHour) * 3600000);
}
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    if (!clientId) return Response.json({ error: 'clientId required' }, { status: 400 });

    const supabase = getSupabase();

    const [{ data: requests, error }, { data: revokes }] = await Promise.all([
      supabase
        .from('subscription_requests')
        .select('*')
        .eq('client_id', clientId)
        .order('requested_at', { ascending: false }),
      supabase
        .from('revoke_requests')
        .select('subscription_request_id, status')
        .eq('client_id', clientId)
        .eq('status', 'pending'),
    ]);

    if (error) return Response.json({ error: error.message }, { status: 500 });

    const pendingRevokeSet = new Set((revokes || []).map(r => r.subscription_request_id));

    // Compute revoke window from subscription's activated_at for approved requests
    const approvedEmails = (requests || [])
      .filter(r => r.status === 'approved')
      .map(r => r.user_email);

    let revokeWindowMap = {};
    if (approvedEmails.length > 0) {
      // Step 1: get user ids for these emails
      const { data: userRows } = await supabase
        .from('users')
        .select('id, email')
        .in('email', approvedEmails);

      const emailToUserId = {};
      (userRows || []).forEach(u => { emailToUserId[u.email] = u.id; });

      const userIds = Object.values(emailToUserId);
      if (userIds.length > 0) {
        // Step 2: get active subscriptions for those users
        const { data: subRows } = await supabase
          .from('subscriptions')
          .select('user_id, activated_at')
          .in('user_id', userIds)
          .eq('status', 'active');

        const userIdToActivatedAt = {};
        (subRows || []).forEach(s => { userIdToActivatedAt[s.user_id] = s.activated_at; });

        approvedEmails.forEach(email => {
          const uid = emailToUserId[email];
          const activatedAt = uid ? userIdToActivatedAt[uid] : null;
          if (activatedAt) {
            const utc = activatedAt.endsWith('Z') ? activatedAt : activatedAt + 'Z';
            revokeWindowMap[email] = new Date(
              new Date(utc).getTime() + REVOKE_WINDOW_MS
            ).toISOString();
          }
        });
      }
    }

    const now = Date.now();
    const enriched = (requests || []).map(req => {
      const queuedUntil = req.status === 'pending'
        ? computeQueuedUntil(req.requested_at)
        : null;
      return {
        ...req,
        has_revoke_request:      pendingRevokeSet.has(req.id),
        revoke_window_expires_at: req.status === 'approved'
          ? (revokeWindowMap[req.user_email] || null)
          : null,
        queued_until: queuedUntil && queuedUntil.getTime() > now
          ? queuedUntil.toISOString()
          : null,
      };
    });

    return Response.json({ requests: enriched });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
