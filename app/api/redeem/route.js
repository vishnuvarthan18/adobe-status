import { createClient } from '@supabase/supabase-js';
import { isValidCode } from '../../lib/redeemCodes.js';

const DESTINATION_URL =
  'https://commerce.adobe.com/store/recommendation?items%5B0%5D%5Bid%5D=660F1BCF287345C0D465E4FF9D4A2AF6&cli=partner&co=IN&lang=en&sdid=WT7FHSB9&mv=affiliate&ss=commitment&rrItems%5B0%5D%5Bid%5D=660F1BCF287345C0D465E4FF9D4A2AF6';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function POST(request) {
  try {
    const { code } = await request.json();
    const normalized = (code || '').trim().toUpperCase();

    if (!normalized) {
      return Response.json({ success: false, error: 'Please enter a code.' }, { status: 400 });
    }

    if (!isValidCode(normalized)) {
      return Response.json({ success: false, error: 'Invalid code.' }, { status: 404 });
    }

    const supabase = getSupabase();

    // Insert fails on primary-key conflict if the code was already redeemed,
    // so this doubles as the atomic "claim" step — no separate read-then-write race.
    const { error } = await supabase
      .from('redeemed_codes')
      .insert([{ code: normalized }]);

    if (error) {
      if (error.code === '23505') {
        return Response.json({ success: false, error: 'This code has already been redeemed.' }, { status: 409 });
      }
      return Response.json({ success: false, error: 'Unable to redeem code right now.' }, { status: 500 });
    }

    return Response.json({ success: true, url: DESTINATION_URL });
  } catch {
    return Response.json({ success: false, error: 'Unable to redeem code right now.' }, { status: 500 });
  }
}
