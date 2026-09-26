export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/social/profiles/') && url.pathname !== '/social/profiles/index.html') {
      const rewritten = new URL(request.url);
      rewritten.pathname = '/social/profiles/index.html';
      return env.ASSETS.fetch(new Request(rewritten, request));
    }

    if (url.pathname.startsWith('/social/posts/') && url.pathname !== '/social/posts/index.html') {
      const rewritten = new URL(request.url);
      rewritten.pathname = '/social/posts/index.html';
      return env.ASSETS.fetch(new Request(rewritten, request));
    }

    return env.ASSETS.fetch(request);
  }
}
