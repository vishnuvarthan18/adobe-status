import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(request) {
  try {
    const { clientId, name, email, planType, startDate } = await request.json();

    if (!clientId || !name || !email || !planType) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Check client credits
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('credits, name')
      .eq('id', clientId)
      .single();

    if (clientErr || !client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }
    if (client.credits <= 0) {
      return Response.json({ error: 'Insufficient credits. Contact admin to recharge.' }, { status: 400 });
    }

    // Duplicate email guard — block if email already has a pending or approved request
    const normalizedEmail = email.toLowerCase().trim();
    const { data: dupRequest } = await supabase
      .from('subscription_requests')
      .select('id, status')
      .eq('user_email', normalizedEmail)
      .in('status', ['pending', 'approved'])
      .maybeSingle();

    if (dupRequest) {
      const msg = dupRequest.status === 'approved'
        ? `${normalizedEmail} already has an active subscription.`
        : `${normalizedEmail} already has a pending request awaiting approval.`;
      return Response.json({ error: msg }, { status: 409 });
    }

    // Create subscription request
    const { data: req, error: reqErr } = await supabase
      .from('subscription_requests')
      .insert([{
        client_id:  clientId,
        user_name:  name,
        user_email: normalizedEmail,
        plan_type:  planType,
        start_date: startDate || new Date().toISOString().split('T')[0],
        status:     'pending',
      }])
      .select()
      .single();

    if (reqErr) return Response.json({ error: reqErr.message }, { status: 500 });

    // Deduct 1 credit atomically
    const { error: creditErr } = await supabase
      .from('clients')
      .update({ credits: client.credits - 1 })
      .eq('id', clientId);

    if (creditErr) return Response.json({ error: 'Failed to deduct credit: ' + creditErr.message }, { status: 500 });

    // Log credit transaction
    await supabase.from('credit_transactions').insert([{
      client_id:    clientId,
      amount:       -1,
      type:         'deduction',
      description:  `Subscription request for ${email}`,
      reference_id: req.id,
      created_by:   client.name,
    }]);

    // Log activity
    await supabase.from('activity_logs').insert([{
      actor_type: 'client',
      actor_id:   clientId,
      actor_name: client.name,
      action:     'subscription_request_created',
      details:    { user_name: name, user_email: email, plan_type: planType, request_id: req.id },
    }]);

    return Response.json({ success: true, requestId: req.id });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
