import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return Response.json({ error: 'Email and password required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, email, credits')
      .eq('email', email.toLowerCase().trim())
      .eq('password', password)
      .single();

    if (error || !data) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    return Response.json({ id: data.id, name: data.name, email: data.email });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
