import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

interface NewUserPayload {
  id?: string;
  email?: string;
  full_name?: string | null;
  created_at?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const adminEmail = Deno.env.get('ADMIN_NOTIFICATION_EMAIL') || 'fuadel21@gmail.com';
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Reveta <noreply@reveta.es>';

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = (await req.json()) as NewUserPayload;
    const userEmail = payload.email || 'Email no disponible';
    const fullName = payload.full_name || 'Nombre no disponible';
    const userId = payload.id || 'ID no disponible';
    const createdAt = payload.created_at || new Date().toISOString();

    const subject = 'Nuevo usuario registrado en Reveta';
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <h2>Nuevo usuario registrado en Reveta</h2>
        <p>Se ha registrado un nuevo usuario en la plataforma.</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 560px;">
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Email</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${userEmail}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Nombre</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${fullName}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>ID</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${userId}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Fecha</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${createdAt}</td></tr>
        </table>
      </div>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [adminEmail],
        subject,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      return new Response(JSON.stringify({ error: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await resendResponse.json();
    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
