// app/api/admin/revoke/route.js
// GET  — list all revoke requests
// POST — approve or reject a revoke request

import { createClient } from '@supabase/supabase-js';
import { getCached, clearCached } from '../../../lib/statusCache.js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('revoke_requests')
    .select('*, clients(name, email)')
    .order('requested_at', { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ requests: data || [] });
}

export async function POST(request) {
  try {
    const { revokeId, action } = await request.json();
    // action: 'approve' | 'reject'
    if (!revokeId || !action) {
      return Response.json({ error: 'revokeId and action required' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data: rev } = await supabase
      .from('revoke_requests')
      .select('*, subscription_requests(*)')
      .eq('id', revokeId)
      .single();

    if (!rev)                    return Response.json({ error: 'Revoke request not found' }, { status: 404 });
    if (rev.status !== 'pending') return Response.json({ error: 'Already resolved' }, { status: 400 });

    // ── APPROVE REVOKE ────────────────────────────────────────
    if (action === 'approve') {
      // Look up user + subscription by email (subscription_id/user_id not stored in subscription_requests)
      const { data: userRow } = await supabase
        .from('users').select('id').eq('email', rev.user_email).maybeSingle();

      if (userRow) {
        // Deactivate (delete) the active subscription
        await supabase.from('subscriptions')
          .delete()
          .eq('user_id', userRow.id)
          .eq('status', 'active');

        // Remove user if they have no remaining subscriptions
        const { data: remaining } = await supabase
          .from('subscriptions').select('id').eq('user_id', userRow.id);
        if (!remaining || remaining.length === 0) {
          await supabase.from('users').delete().eq('id', userRow.id);
        }
      }

      // Clear status cache so the user can't still check their (now deleted) status
      if (rev.user_email) clearCached(rev.user_email.toLowerCase().trim());

      // Refund 1 credit to client
      const { data: client } = await supabase
        .from('clients').select('credits').eq('id', rev.client_id).single();

      await supabase.from('clients')
        .update({ credits: (client?.credits || 0) + 1 })
        .eq('id', rev.client_id);

      await supabase.from('credit_transactions').insert([{
        client_id:    rev.client_id,
        amount:       1,
        type:         'refund',
        description:  `Credit refund — revoked subscription for ${rev.user_email}`,
        reference_id: revokeId,
        created_by:   'admin',
      }]);

      // Mark subscription_request as revoked
      await supabase.from('subscription_requests')
        .update({ status: 'revoked' })
        .eq('id', rev.subscription_request_id);

      // Resolve revoke request
      await supabase.from('revoke_requests').update({
        status:      'approved',
        resolved_at: new Date().toISOString(),
      }).eq('id', revokeId);

      await supabase.from('activity_logs').insert([{
        actor_type: 'admin',
        actor_id:   'admin',
        actor_name: 'Admin',
        action:     'revoke_approved',
        details:    { revoke_id: revokeId, user_email: rev.user_email, credit_refunded: true },
      }]);

    // ── REJECT REVOKE ─────────────────────────────────────────
    } else if (action === 'reject') {
      await supabase.from('revoke_requests').update({
        status:      'rejected',
        resolved_at: new Date().toISOString(),
      }).eq('id', revokeId);

      await supabase.from('activity_logs').insert([{
        actor_type: 'admin',
        actor_id:   'admin',
        actor_name: 'Admin',
        action:     'revoke_rejected',
        details:    { revoke_id: revokeId, user_email: rev.user_email },
      }]);
    } else {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('[admin/revoke]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
