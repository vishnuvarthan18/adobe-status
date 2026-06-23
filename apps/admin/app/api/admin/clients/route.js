// app/api/admin/clients/route.js
// GET  — list all client accounts
// POST — recharge credits for a client

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, email, credits, created_at')
    .order('created_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ clients: data || [] });
}

export async function POST(request) {
  try {
    const { clientId, amount, description } = await request.json();

    if (!clientId || !amount || amount <= 0) {
      return Response.json({ error: 'clientId and a positive amount are required' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: client } = await supabase
      .from('clients').select('credits, name').eq('id', clientId).single();

    if (!client) return Response.json({ error: 'Client not found' }, { status: 404 });

    const newBalance = client.credits + amount;

    await supabase.from('clients')
      .update({ credits: newBalance })
      .eq('id', clientId);

    await supabase.from('credit_transactions').insert([{
      client_id:   clientId,
      amount,
      type:        'recharge',
      description: description || `Admin recharge: +${amount} credit${amount > 1 ? 's' : ''}`,
      created_by:  'admin',
    }]);

    await supabase.from('activity_logs').insert([{
      actor_type: 'admin',
      actor_id:   'admin',
      actor_name: 'Admin',
      action:     'credits_recharged',
      details:    { client_id: clientId, client_name: client.name, amount, new_balance: newBalance },
    }]);

    return Response.json({ success: true, newBalance });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
