// ============================================
// Supabase Edge Function: check-password
// This runs on Supabase's servers, NOT in the browser — so the real
// passwords are never exposed in your website's code.
//
// HOW TO DEPLOY (one-time setup):
// 1. Install Supabase CLI: npm install -g supabase
// 2. In your project folder, run: supabase login
// 3. Run: supabase functions deploy check-password
// 4. Set your secret passwords (run these once, replace the values):
//    supabase secrets set EDITOR_PASSWORD=your-editor-password-here
//    supabase secrets set VIEWER_PASSWORD=your-viewer-password-here
//
// To CHANGE a password later, just re-run the secrets set command with
// a new value — no code changes needed, no redeploy needed.
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { password } = await req.json();

    const editorPassword = Deno.env.get("EDITOR_PASSWORD");
    const viewerPassword = Deno.env.get("VIEWER_PASSWORD");

    let role = null;
    if (password === editorPassword) {
      role = "editor";
    } else if (password === viewerPassword) {
      role = "viewer";
    }

    if (!role) {
      return new Response(
        JSON.stringify({ success: false, message: "Incorrect password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a simple session token (random string) — not a JWT, just enough
    // to mark this browser as "logged in" with a role, stored in sessionStorage.
    const sessionToken = crypto.randomUUID();

    return new Response(
      JSON.stringify({ success: true, role, sessionToken }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, message: "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
