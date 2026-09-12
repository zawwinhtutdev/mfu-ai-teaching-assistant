import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Keep-alive endpoint — pinged by Vercel cron to prevent:
 * 1. Vercel serverless cold starts from long inactivity
 * 2. Supabase free-tier project pausing (pauses after 7 days of no API calls)
 */
export async function GET() {
  const results: Record<string, string> = {
    vercel: "ok",
    timestamp: new Date().toISOString(),
  };

  // Ping Supabase to keep it alive
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error } = await supabase.from("profiles").select("id").limit(1);
      results.supabase = error ? `error: ${error.message}` : "ok";
    } else {
      results.supabase = "skipped: missing env vars";
    }
  } catch (e) {
    results.supabase = `error: ${e instanceof Error ? e.message : "unknown"}`;
  }

  return NextResponse.json(results);
}
