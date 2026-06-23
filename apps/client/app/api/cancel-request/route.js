import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(request) {
  try {
    const { clientId, requestId } = await request.json();
    if (!clientId || !requestId) {
      return Response.json({ error: 'Missing fields' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Validate the request belongs to this client and is still pending
    const { data: req } = await supabase
      .from('subscription_requests')
      .select('*')
      .eq('id', requestId)
      .eq('client_id', clientId)
      .single();

    if (!req) return Response.json({ error: 'Request not found' }, { status: 404 });
    if (req.status !== 'pending') {
      return Response.json({ error: 'Only pending requests can be cancelled' }, { status: 400 });
    }

    // Delete the subscription request
    const { error: deleteErr } = await supabase
      .from('subscription_requests')
      .delete()
      .eq('id', requestId);

    if (deleteErr) return Response.json({ error: deleteErr.message }, { status: 500 });

    // Refund 1 credit
    const { data: client } = await supabase
      .from('clients').select('credits, name').eq('id', clientId).single();

    await supabase.from('clients')
      .update({ credits: (client?.credits || 0) + 1 })
      .eq('id', clientId);

    await supabase.from('credit_transactions').insert([{
      client_id:   clientId,
      amount:      1,
      type:        'refund',
      description: `Cancelled request for ${req.user_email}`,
      created_by:  client?.name || 'client',
    }]);

    await supabase.from('activity_logs').insert([{
      actor_type: 'client',
      actor_id:   clientId,
      actor_name: client?.name,
      action:     'request_cancelled',
      details:    { user_email: req.user_email, request_id: requestId },
    }]);

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
