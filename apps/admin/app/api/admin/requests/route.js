// app/api/admin/requests/route.js
// GET  — list subscription requests that are ready for admin action
// POST — approve or reject a pending request

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// ── Business hours queue ──────────────────────────────────────────────────────
const BIZ_TZ    = process.env.BUSINESS_TIMEZONE || 'Asia/Kolkata';
const BIZ_OPEN  = 9;   // 9 AM
const BIZ_CLOSE = 18;  // 6 PM

function getBizHour(date) {
  return parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: BIZ_TZ, hour: 'numeric', hour12: false }).format(date),
    10
  );
}

// Returns the UTC Date when the request becomes visible to admin.
// Returns null if submitted during business hours (available immediately).
function queuedUntil(requestedAt) {
  const date  = new Date(requestedAt);
  const hour  = getBizHour(date);
  if (hour >= BIZ_OPEN && hour < BIZ_CLOSE) return null; // already within hours

  // Compute next 9 AM in biz timezone
  const base = hour >= BIZ_CLOSE
    ? new Date(date.getTime() + 24 * 60 * 60 * 1000) // after close → tomorrow
    : date;                                             // before open → today

  const dtParts = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: BIZ_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(base).forEach(p => { if (p.type !== 'literal') dtParts[p.type] = p.value; });

  // Build "09:00 on that date" as UTC, then correct for timezone offset
  const naiveUTC   = new Date(`${dtParts.year}-${dtParts.month}-${dtParts.day}T09:00:00Z`);
  const actualHour = getBizHour(naiveUTC);
  return new Date(naiveUTC.getTime() + (BIZ_OPEN - actualHour) * 3600000);
}
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('subscription_requests')
    .select('*, clients(name, email)')
    .order('requested_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  // Hide pending requests that are still in the business-hours queue
  const visible = (data || []).filter(req => {
    if (req.status !== 'pending') return true; // always show approved / rejected
    const until = queuedUntil(req.requested_at);
    return !until || until.getTime() <= now;
  });

  return Response.json({ requests: visible });
}

export async function POST(request) {
  try {
    const { requestId, action, notes } = await request.json();
    // action: 'approve' | 'reject'
    if (!requestId || !action) {
      return Response.json({ error: 'requestId and action required' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: req } = await supabase
      .from('subscription_requests')
      .select('*, clients(name, email, credits)')
      .eq('id', requestId)
      .single();

    if (!req)               return Response.json({ error: 'Request not found' }, { status: 404 });
    if (req.status !== 'pending') return Response.json({ error: 'Request is not pending' }, { status: 400 });

    // ── APPROVE ──────────────────────────────────────────────
    if (action === 'approve') {

      // 0. Duplicate email guard — block if email already has an active subscription
      const { data: existingSub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', (await supabase.from('users').select('id').eq('email', req.user_email).maybeSingle()).data?.id)
        .eq('status', 'active')
        .maybeSingle();

      // Simpler duplicate check: look for any other approved request with same email
      const { data: alreadyApproved } = await supabase
        .from('subscription_requests')
        .select('id')
        .eq('user_email', req.user_email)
        .eq('status', 'approved')
        .maybeSingle();

      if (alreadyApproved) {
        return Response.json({ error: `${req.user_email} already has an approved subscription.` }, { status: 409 });
      }

      // 1. Upsert user into main users table
      const { data: insertedUser, error: userError } = await supabase
        .from('users')
        .insert([{ name: req.user_name, email: req.user_email }])
        .select()
        .single();

      let userId;
      if (userError) {
        if (userError.code === '23505') {
          // Already exists — fetch their id
          const { data: existing } = await supabase
            .from('users').select('id').eq('email', req.user_email).single();
          userId = existing?.id;
        } else {
          return Response.json({ error: 'Failed to create user: ' + userError.message }, { status: 500 });
        }
      } else {
        userId = insertedUser.id;
      }

      // 2. Create subscription
      const approvedAt = new Date(); // exact approval timestamp — used for activated_at and revoke window
      const startDate  = req.start_date ? new Date(req.start_date) : approvedAt;
      const expiryDate = req.plan_type === 'lifetime'
        ? new Date(startDate.getTime() + 100 * 365 * 24 * 60 * 60 * 1000)
        : new Date(startDate.getTime() +       365 * 24 * 60 * 60 * 1000);

      const { data: sub, error: subError } = await supabase
        .from('subscriptions')
        .insert([{
          user_id:              userId,
          plan_name:            'Creative Cloud Pro Configuration',
          plan_type:            req.plan_type,
          organization_name:    '',
          activated_at:         approvedAt.toISOString(),
          expires_at:           expiryDate.toISOString(),
          status:               'active',
          progress_percent:     0,
          team_status:          'normal',
          team_status_message:  'This team is operating normally.',
        }])
        .select()
        .single();

      if (subError) return Response.json({ error: 'Failed to create subscription: ' + subError.message }, { status: 500 });

      // 3. Update request status — only update columns that exist in schema
      const { error: updateErr } = await supabase
        .from('subscription_requests')
        .update({ status: 'approved' })
        .eq('id', requestId);

      if (updateErr) {
        // Rollback: delete the subscription we just created
        await supabase.from('subscriptions').delete().eq('id', sub.id);
        return Response.json({ error: 'Failed to update request status: ' + updateErr.message }, { status: 500 });
      }

      // 4. Send activation email via Resend
      try {
        const resend  = new Resend(process.env.RESEND_API_KEY);
        const isLifetime = req.plan_type === 'lifetime';
        await resend.emails.send({
          from:    process.env.RESEND_FROM_EMAIL || 'noreply@mgdigital.com',
          to:      req.user_email,
          subject: 'Your subscription is now active — MG Digital',
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
              <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 6px;">Hi ${req.user_name} 👋</h1>
              <p style="color:#64748b;margin:0 0 24px;font-size:15px;">Your subscription has been activated.</p>

              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
                <table style="width:100%;border-collapse:collapse;">
                  <tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Plan</td>
                      <td style="padding:6px 0;font-weight:600;color:#4f46e5;font-size:14px;text-align:right;text-transform:capitalize;">${req.plan_type}</td></tr>
                  <tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Activated</td>
                      <td style="padding:6px 0;font-weight:600;color:#0f172a;font-size:14px;text-align:right;">${approvedAt.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</td></tr>
                  ${!isLifetime
                    ? `<tr><td style="padding:6px 0;color:#64748b;font-size:14px;">Expires</td>
                           <td style="padding:6px 0;font-weight:600;color:#0f172a;font-size:14px;text-align:right;">${expiryDate.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</td></tr>`
                    : `<tr><td colspan="2" style="padding:8px 0;color:#7c3aed;font-weight:600;font-size:14px;">♾️ Lifetime access — no expiry</td></tr>`
                  }
                </table>
              </div>

              <p style="color:#64748b;font-size:14px;margin:0 0 16px;">Check your subscription status anytime:</p>
              <a href="${process.env.NEXT_PUBLIC_STATUS_URL || 'https://your-domain.com'}"
                 style="display:inline-block;background:#2563eb;color:#fff;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none;font-size:14px;">
                Check Status
              </a>
              <p style="color:#94a3b8;font-size:12px;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:16px;">
                MG Digital · Subscription Portal
              </p>
            </div>
          `,
        });
      } catch (emailErr) {
        // Log but don't fail — subscription is already created
        console.error('[requests] Email failed:', emailErr.message);
      }

      // 5. Activity log
      await supabase.from('activity_logs').insert([{
        actor_type: 'admin',
        actor_id:   'admin',
        actor_name: 'Admin',
        action:     'subscription_approved',
        details:    { request_id: requestId, user_email: req.user_email, subscription_id: sub.id, client_name: req.clients?.name },
      }]);

    // ── REJECT ────────────────────────────────────────────────
    } else if (action === 'reject') {

      // Refund the credit back to client
      const { data: client } = await supabase
        .from('clients').select('credits').eq('id', req.client_id).single();

      await supabase.from('clients')
        .update({ credits: (client?.credits || 0) + 1 })
        .eq('id', req.client_id);

      await supabase.from('credit_transactions').insert([{
        client_id:    req.client_id,
        amount:       1,
        type:         'refund',
        description:  `Refund — rejected request for ${req.user_email}`,
        reference_id: requestId,
        created_by:   'admin',
      }]);

      const { error: rejectErr } = await supabase
        .from('subscription_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (rejectErr) return Response.json({ error: 'Failed to update request status: ' + rejectErr.message }, { status: 500 });

      await supabase.from('activity_logs').insert([{
        actor_type: 'admin',
        actor_id:   'admin',
        actor_name: 'Admin',
        action:     'subscription_rejected',
        details:    { request_id: requestId, user_email: req.user_email, credit_refunded: true },
      }]);

    } else {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('[admin/requests]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
