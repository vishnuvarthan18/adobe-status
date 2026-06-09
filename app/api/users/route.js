import { createClient } from '@supabase/supabase-js';
import { clearCached } from '../../lib/statusCache.js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function GET() {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, user_id, plan_type, status, activated_at, expires_at, users(name, email)')
    .order('activated_at', { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ users: data || [] });
}

export async function DELETE(request) {
  const supabase = getSupabase();

  try {
    const { subscriptionId, userId } = await request.json();

    if (!subscriptionId || !userId) {
      return Response.json({ error: 'Missing subscriptionId or userId' }, { status: 400 });
    }

    // Fetch email before deletion so we can clear the status cache
    const { data: userRow } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    // Delete subscription first (FK constraint)
    const { error: subError } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', subscriptionId);

    if (subError) {
      return Response.json({ error: 'Failed to delete subscription: ' + subError.message }, { status: 500 });
    }

    // Check if user has other subscriptions before deleting the user row
    const { data: remaining } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId);

    if (!remaining || remaining.length === 0) {
      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (userError) {
        return Response.json({ error: 'Failed to delete user: ' + userError.message }, { status: 500 });
      }
    }

    // Clear cached status so the deleted user can't still be "found"
    if (userRow?.email) clearCached(userRow.email.toLowerCase().trim());

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
