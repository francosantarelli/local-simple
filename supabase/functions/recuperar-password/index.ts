// Entrypoint Deno de la Edge Function `recuperar-password`
// (contracts/recuperar-password.md). Wiring real de Supabase Admin +
// Resend sobre la lógica pura y testeada en ./logic.ts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleRecuperarPassword } from "./logic.ts";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
const emailFrom = Deno.env.get("EMAIL_FROM") ?? "no-reply@local-simple.app";

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const { username } = await req.json().catch(() => ({ username: null }));

  const result = await handleRecuperarPassword(username, {
    async findProfileByUsername(u) {
      const { data: profile } = await admin
        .from("profiles")
        .select("id, username, recovery_email")
        .eq("username", u)
        .maybeSingle();
      if (!profile) return null;

      const { data: userResult } = await admin.auth.admin.getUserById(profile.id);
      const authEmail = userResult?.user?.email;
      if (!authEmail) return null;

      return {
        username: profile.username,
        recoveryEmail: profile.recovery_email,
        authEmail,
      };
    },

    async generateRecoveryLink(authEmail) {
      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: authEmail,
      });
      if (error || !data?.properties?.action_link) {
        throw new Error(`No se pudo generar el link de recuperación: ${error?.message}`);
      }
      return data.properties.action_link;
    },

    async sendRecoveryEmail(recoveryEmail, link) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [recoveryEmail],
          subject: "Recuperar tu contraseña",
          html: `<p>Para restablecer tu contraseña, entrá a este link:</p><p><a href="${link}">${link}</a></p>`,
        }),
      });
      if (!response.ok) {
        throw new Error(`Resend respondió ${response.status} al enviar el email de recuperación`);
      }
    },
  });

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
