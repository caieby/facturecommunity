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

// Link-preview bots (Discord, Twitter/X, Slack, iMessage, etc.) fetch the
// raw HTML and read its <meta> tags directly -- they never run the page's
// JS, so without this they'd only ever see the generic static "Facture"
// tags every page ships with, not the actual post. Gated to known crawler
// user agents so real visitors (who get the real content client-side
// anyway) don't pay for the extra Supabase round trip on every post view.
const CRAWLER_UA_PATTERN = /facebookexternalhit|Twitterbot|Discordbot|Slackbot|TelegramBot|WhatsApp|LinkedInBot|Pinterest|SkypeUriPreview|vkShare|redditbot|Applebot|Google-InspectionTool|embedly|iframely/i;

async function servePostEmbed(request, env, postId) {
  const anonKey = 'sb_publishable_37fQXfSzDzUrv35A5VSFXA_eqZBc3dB';

  const postResp = await fetch(
    `${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}&select=content,author_id,media_url,media_type,is_nsfw,removed_at`,
    { headers: { apikey: anonKey } }
  );
  const posts = postResp.ok ? await postResp.json() : [];
  const post = posts[0];

  if (!post || post.removed_at) {
    return serveIndex(request, env, '/social/posts/index.html');
  }

  const profResp = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${post.author_id}&select=username,display_name,is_nsfw_account`,
    { headers: { apikey: anonKey } }
  );
  const profiles = profResp.ok ? await profResp.json() : [];
  const author = profiles[0] || { username: 'unknown', display_name: 'Unknown' };

  const title = `${author.display_name} (@${author.username})`;
  let description = post.content || '';
  if (description.length > 200) description = `${description.slice(0, 197)}...`;

  const isSafeImage = !!post.media_url && post.media_type === 'image' && !post.is_nsfw && !author.is_nsfw_account;
  const image = isSafeImage ? post.media_url : 'https://facturecommunity.org/assets/Facture_Logo.png';

  const base = await serveIndex(request, env, '/social/posts/index.html');

  return new HTMLRewriter()
    .on('title', { element(el) { el.setInnerContent(title); } })
    .on('meta[property="og:title"]', { element(el) { el.setAttribute('content', title); } })
    .on('meta[property="og:description"]', { element(el) { el.setAttribute('content', description); } })
    .on('meta[property="og:image"]', { element(el) { el.setAttribute('content', image); } })
    .on('meta[name="description"]', { element(el) { el.setAttribute('content', description); } })
    .on('meta[name="twitter:title"]', { element(el) { el.setAttribute('content', title); } })
    .on('meta[name="twitter:description"]', { element(el) { el.setAttribute('content', description); } })
    .on('meta[name="twitter:card"]', { element(el) { el.setAttribute('content', isSafeImage ? 'summary_large_image' : 'summary'); } })
    .transform(base);
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
      const segments = url.pathname.split('/').filter(Boolean);
      const postId = segments[2];
      const userAgent = request.headers.get('User-Agent') || '';

      if (postId && CRAWLER_UA_PATTERN.test(userAgent)) {
        return servePostEmbed(request, env, postId);
      }

      return serveIndex(request, env, '/social/posts/index.html');
    }

    return env.ASSETS.fetch(request);
  }
}
