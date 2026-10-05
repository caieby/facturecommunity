function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function wrapEmailHtml(title, bodyHtml) {
  return `
    <div style="font-family: Arial, sans-serif; background:#1a0b2e; padding:32px;">
      <div style="max-width:480px; margin:0 auto; background:#2a1050; border-radius:12px; padding:32px; color:#ffffff;">
        <h1 style="color:#a855f7; font-size:20px; margin:0 0 16px;">${escapeHtml(title)}</h1>
        <div style="font-size:15px; line-height:1.6; color:#ffffff;">${bodyHtml}</div>
        <p style="margin-top:24px; font-size:12px; color:#c4b5fd;">Facture &middot; FactureHub Moderation</p>
      </div>
    </div>
  `;
}

function buildAppealEmail(kind, record) {
  const caseNumber = escapeHtml(record.appeal_number || '');

  if (kind === 'received') {
    return {
      subject: 'Appeal Received!',
      html: `<p>We've received your appeal (<strong>${caseNumber}</strong>). A moderator will review it soon.</p><p><strong>Your appeal:</strong> ${escapeHtml(record.reason || '')}</p>`,
    };
  }

  if (kind === 'approved') {
    return {
      subject: 'Appeal has been accepted!',
      html: `<p>Good news — your appeal (<strong>${caseNumber}</strong>) has been reviewed and <strong>accepted</strong>.</p>`,
    };
  }

  return {
    subject: 'Appeal Denied',
    html: `<p>Your appeal (<strong>${caseNumber}</strong>) has been reviewed and <strong>denied</strong>.</p>`,
  };
}

async function getUserEmail(userId, env) {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });

  if (!response.ok) return null;
  const data = await response.json();
  return (data && data.email) || (data && data.user && data.user.email) || null;
}

async function sendResendEmail(to, subject, html, env) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'FactureTeam <FactureTeam@facturecommunity.org>',
      to: [to],
      subject,
      html: wrapEmailHtml(subject, html),
    }),
  });
}

async function handleAppealNotify(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secret = request.headers.get('X-Webhook-Secret');
  if (!env.APPEAL_WEBHOOK_SECRET || secret !== env.APPEAL_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (err) {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { type, record, old_record } = payload;

  let kind = null;
  if (type === 'INSERT') {
    kind = 'received';
  } else if (type === 'UPDATE' && old_record && record.status !== old_record.status) {
    if (record.status === 'approved') kind = 'approved';
    else if (record.status === 'denied') kind = 'denied';
  }

  if (!kind || !record || !record.user_id) {
    return new Response('OK', { status: 200 });
  }

  const email = await getUserEmail(record.user_id, env);
  if (email) {
    const { subject, html } = buildAppealEmail(kind, record);
    await sendResendEmail(email, subject, html, env);
  }

  return new Response('OK', { status: 200 });
}

async function serveIndex(request, env, indexPath) {
  const target = new URL(request.url);
  target.pathname = indexPath;
  let response = await env.ASSETS.fetch(new Request(target, request));

  // Cloudflare's asset handler redirects requests for the literal index.html
  // filename to its "clean" directory URL. Following that redirect back to
  // the client would strip the dynamic id/slug from the original request's
  // path, so resolve it here instead and return the real content.
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('Location');
    if (location) {
      const followUrl = new URL(location, request.url);
      response = await env.ASSETS.fetch(new Request(followUrl, request));
    }
  }

  return response;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/appeal-notify') {
      return handleAppealNotify(request, env);
    }

    if (url.pathname.startsWith('/social/profiles/') && url.pathname !== '/social/profiles/index.html') {
      return serveIndex(request, env, '/social/profiles/index.html');
    }

    if (url.pathname.startsWith('/social/posts/') && url.pathname !== '/social/posts/index.html') {
      return serveIndex(request, env, '/social/posts/index.html');
    }

    return env.ASSETS.fetch(request);
  }
}
