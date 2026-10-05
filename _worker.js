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

    if (url.pathname.startsWith('/social/profiles/') && url.pathname !== '/social/profiles/index.html') {
      return serveIndex(request, env, '/social/profiles/index.html');
    }

    if (url.pathname.startsWith('/social/posts/') && url.pathname !== '/social/posts/index.html') {
      return serveIndex(request, env, '/social/posts/index.html');
    }

    return env.ASSETS.fetch(request);
  }
}
