import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    if (!clientId) return Response.json({ error: 'clientId required' }, { status: 400 });

    const supabase = getSupabase();

    const [{ data: client }, { data: transactions }] = await Promise.all([
      supabase.from('clients').select('credits').eq('id', clientId).single(),
      supabase
        .from('credit_transactions')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
    ]);

    return Response.json({
      credits:      client?.credits ?? 0,
      transactions: transactions || [],
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
