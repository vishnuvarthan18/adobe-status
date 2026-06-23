import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

const REVOKE_WINDOW_MS = 12 * 60 * 60 * 1000;

export async function POST(request) {
  try {
    const { clientId, subscriptionRequestId } = await request.json();

    if (!clientId || !subscriptionRequestId) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Validate the request belongs to this client and is approved
    const { data: req } = await supabase
      .from('subscription_requests')
      .select('*')
      .eq('id', subscriptionRequestId)
      .eq('client_id', clientId)
      .single();

    if (!req) return Response.json({ error: 'Request not found' }, { status: 404 });
    if (req.status !== 'approved') return Response.json({ error: 'Can only refund approved subscriptions' }, { status: 400 });

    // Compute the 12-hour window from the subscription's actual activation timestamp
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('email', req.user_email)
      .maybeSingle();

    let windowExpires = null;
    if (userRow) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('activated_at')
        .eq('user_id', userRow.id)
        .eq('status', 'active')
        .maybeSingle();

      if (sub?.activated_at) {
        const utc = sub.activated_at.endsWith('Z') ? sub.activated_at : sub.activated_at + 'Z';
        windowExpires = new Date(new Date(utc).getTime() + REVOKE_WINDOW_MS);
      }
    }

    if (!windowExpires || windowExpires <= new Date()) {
      return Response.json({ error: 'Refund window has expired — only available within 12 hours of approval.' }, { status: 400 });
    }

    // Check no existing pending revoke request
    const { data: existing } = await supabase
      .from('revoke_requests')
      .select('id')
      .eq('subscription_request_id', subscriptionRequestId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) return Response.json({ error: 'A refund request is already pending' }, { status: 400 });

    // Create revoke request
    const { error: insertErr } = await supabase.from('revoke_requests').insert([{
      client_id:               clientId,
      subscription_request_id: subscriptionRequestId,
      user_email:              req.user_email,
      user_name:               req.user_name,
      status:                  'pending',
      revoke_window_expires_at: windowExpires.toISOString(),
    }]);

    if (insertErr) return Response.json({ error: 'Failed to submit refund request: ' + insertErr.message }, { status: 500 });

    // Log activity
    const { data: client } = await supabase.from('clients').select('name').eq('id', clientId).single();
    await supabase.from('activity_logs').insert([{
      actor_type: 'client',
      actor_id:   clientId,
      actor_name: client?.name,
      action:     'refund_request_created',
      details:    { user_email: req.user_email, subscription_request_id: subscriptionRequestId },
    }]);

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
