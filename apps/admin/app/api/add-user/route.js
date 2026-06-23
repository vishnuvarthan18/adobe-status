import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(request) {
  try {
    const { name, email, planType, startDate } = await request.json();

    if (!name || !email || !planType) {
      return Response.json({ error: 'name, email, and planType are required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const normalizedEmail = email.toLowerCase().trim();

    // Duplicate email guard — block if email already has an active subscription
    const { data: existingUser } = await supabase
      .from('users').select('id').eq('email', normalizedEmail).maybeSingle();
    if (existingUser) {
      const { data: existingSub } = await supabase
        .from('subscriptions').select('id').eq('user_id', existingUser.id).eq('status', 'active').maybeSingle();
      if (existingSub) {
        return Response.json({ error: `${normalizedEmail} already has an active subscription.` }, { status: 409 });
      }
    }

    // Upsert user
    const { data: insertedUser, error: userErr } = await supabase
      .from('users')
      .insert([{ name, email: normalizedEmail }])
      .select()
      .single();

    let userId;
    if (userErr) {
      if (userErr.code === '23505') {
        const { data: existing } = await supabase
          .from('users').select('id').eq('email', normalizedEmail).single();
        userId = existing?.id;
      } else {
        return Response.json({ error: 'Failed to create user: ' + userErr.message }, { status: 500 });
      }
    } else {
      userId = insertedUser.id;
    }

    const now        = startDate ? new Date(startDate) : new Date();
    const expiryDate = planType === 'lifetime'
      ? new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() +       365 * 24 * 60 * 60 * 1000);

    const { error: subErr } = await supabase
      .from('subscriptions')
      .insert([{
        user_id:             userId,
        plan_name:           'Creative Cloud Pro Configuration',
        plan_type:           planType,
        organization_name:   '',
        activated_at:        now.toISOString(),
        expires_at:          expiryDate.toISOString(),
        status:              'active',
        progress_percent:    0,
        team_status:         'normal',
        team_status_message: 'This team is operating normally.',
      }]);

    if (subErr) return Response.json({ error: 'Failed to create subscription: ' + subErr.message }, { status: 500 });

    await supabase.from('activity_logs').insert([{
      actor_type: 'admin',
      actor_id:   'admin',
      actor_name: 'Admin',
      action:     'subscription_approved',
      details:    { user_name: name, user_email: email, plan_type: planType, added_directly: true },
    }]);

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
