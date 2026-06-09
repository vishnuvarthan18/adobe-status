import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Service role key bypasses RLS — required for server-side writes
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return createClient(url, key);
}

export async function POST(request) {
  try {
    const { name, email, planType, startDate } = await request.json();

    if (!name || !email || !planType) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Step 1: Insert user (upsert on email conflict)
    const { data: insertedUser, error: userError } = await supabase
      .from('users')
      .insert([{ name, email }])
      .select()
      .single();

    let userId;

    if (userError) {
      if (userError.code === '23505') {
        // Unique violation — user already exists, fetch them
        const { data: existing, error: fetchError } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .single();

        if (fetchError || !existing) {
          return Response.json(
            { error: 'User already exists but could not be fetched: ' + userError.message },
            { status: 500 }
          );
        }
        userId = existing.id;
      } else {
        return Response.json(
          { error: 'Failed to create user: ' + userError.message },
          { status: 500 }
        );
      }
    } else {
      userId = insertedUser.id;
    }

    // Step 2: Insert subscription
    const now = startDate ? new Date(startDate) : new Date();
    const expiryDate =
      planType === 'lifetime'
        ? new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const { error: subError } = await supabase.from('subscriptions').insert([
      {
        user_id: userId,
        plan_name: 'Creative Cloud Pro Configuration',
        plan_type: planType,
        organization_name: '',
        activated_at: now.toISOString(),
        expires_at: expiryDate.toISOString(),
        status: 'active',
        progress_percent: 0,
        team_status: 'normal',
        team_status_message: 'This team is operating normally.',
      },
    ]);

    if (subError) {
      return Response.json(
        { error: 'Failed to create subscription: ' + subError.message },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('add-user error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
