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
    .from('subscriptions')
    .select('*, users(name, email)')
    .order('activated_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ users: data || [] });
}

export async function DELETE(request) {
  try {
    const { subscriptionId, userId } = await request.json();
    if (!subscriptionId) return Response.json({ error: 'subscriptionId required' }, { status: 400 });

    const supabase = getSupabase();

    const { error: subErr } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', subscriptionId);

    if (subErr) return Response.json({ error: subErr.message }, { status: 500 });

    // Remove user only if they have no remaining subscriptions
    if (userId) {
      const { data: remaining } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId);

      if (!remaining || remaining.length === 0) {
        await supabase.from('users').delete().eq('id', userId);
      }
    }

    await supabase.from('activity_logs').insert([{
      actor_type: 'admin',
      actor_id:   'admin',
      actor_name: 'Admin',
      action:     'subscription_deleted',
      details:    { subscription_id: subscriptionId, user_id: userId },
    }]);

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
