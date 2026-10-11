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

const SUPABASE_URL = 'https://vrhfajwulxjfmgzyzaxx.supabase.co';

// Records which IP an account signed up from, so a Postgres trigger on
// profiles can cap how many accounts one network can create (see
// signup-ip-limit.sql). The real client IP only exists on Cloudflare's edge
// (CF-Connecting-IP) -- browser JS can never see it -- so this has to happen
// here, not in social/hub.js itself. Writes with the service role key,
// since the signup_ips table has no RLS policies for anon/authenticated.
async function recordSignupIp(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!body || typeof body.user_id !== 'string') {
    return new Response('Missing user_id', { status: 400 });
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  const upstream = await fetch(`${SUPABASE_URL}/rest/v1/signup_ips`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ user_id: body.user_id, ip_address: ip }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(text, { status: upstream.status });
  }

  return new Response(null, { status: 204 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/record-signup-ip') {
      return recordSignupIp(request, env);
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
