// Shared post-card rendering + interactions, used by the Main Feed and (soon) Profile pages.

function escapePostText(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function postTimeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString();
}

function generatePostUUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // crypto.randomUUID() requires a secure context (HTTPS or localhost).
  // Fallback for plain-HTTP testing (e.g. a LAN IP) using a lower-level API
  // that works everywhere.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

function scorePost(post) {
  const ageHours = Math.max((Date.now() - new Date(post.created_at).getTime()) / 3600000, 0);
  const engagement = (post.like_count * 2) + (post.repost_count * 3) + (post.reply_count * 2) + (post.view_count * 0.1);

  // A brand-new post has zero engagement, so without this it scores near
  // the bottom the instant it's posted — any post with even modest existing
  // engagement would outrank it, making a fresh post look like it vanished
  // (it's just buried past the first page). Give new posts a visibility
  // floor for their first 15 minutes, then let normal ranking take over.
  const recencyBoost = ageHours < 0.25 ? 15 : 0;

  return (engagement + recencyBoost + 1) / Math.pow(ageHours + 2, 1.5);
}

function rankPosts(posts) {
  return [...posts].sort((a, b) => scorePost(b) - scorePost(a));
}

function applyNameColor(el, color, colorType) {
  el.style.color = '';
  el.style.background = '';
  el.style.webkitBackgroundClip = '';
  el.style.backgroundClip = '';
  if (!color) return;
  if (colorType === 'gradient') {
    el.style.background = color;
    el.style.webkitBackgroundClip = 'text';
    el.style.backgroundClip = 'text';
    el.style.color = 'transparent';
  } else {
    el.style.color = color;
  }
}

function buildBadgesHtml(profile) {
  if (!profile || !profile.is_verified) return '';
  return '<span class="name-badge name-badge--verified" title="Verified">&#10003;</span>';
}

const POST_SELECT_COLUMNS = 'id, author_id, content, parent_post_id, visibility, reply_permission, view_count, like_count, repost_count, reply_count, media_url, media_type, created_at';

const MAX_POST_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_POST_VIDEO_BYTES = 150 * 1024 * 1024;
const COMPRESS_ABOVE_BYTES = 2 * 1024 * 1024;

function compressPostImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const maxDimension = 2000;
      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Compression failed.'));
            return;
          }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.8
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to read the image for compression.'));
    };

    img.src = objectUrl;
  });
}

function uploadPostFileWithProgress(client, supabaseUrl, supabaseAnonKey, bucket, path, file, onProgress) {
  return new Promise(async (resolve, reject) => {
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      reject(new Error('Not authenticated.'));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${supabaseUrl}/storage/v1/object/${bucket}/${path}`);
    xhr.setRequestHeader('apikey', supabaseAnonKey);
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      let message = `Upload failed (status ${xhr.status}).`;
      try {
        const parsed = JSON.parse(xhr.responseText);
        if (parsed.message) message = parsed.message;
      } catch (err) {}
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error('Network error during upload.'));

    xhr.send(file);
  });
}

function createPostsController(client, currentUserId, supabaseUrl, supabaseAnonKey) {
  const viewedPostIds = new Set();
  let viewObserver = null;

  function ensureViewObserver() {
    if (viewObserver) return viewObserver;
    viewObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const postId = entry.target.dataset.postId;
        if (!postId || viewedPostIds.has(postId)) return;
        viewedPostIds.add(postId);
        client.rpc('increment_post_view', { _post_id: postId }).then(() => {});
        viewObserver.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    return viewObserver;
  }

  async function fetchProfilesById(ids) {
    const uniqueIds = [...new Set(ids)].filter(Boolean);
    if (uniqueIds.length === 0) return new Map();
    const { data } = await client
      .from('profiles')
      .select('id, username, display_name, avatar_url, is_verified, profile_color, profile_color_type')
      .in('id', uniqueIds);
    return new Map((data || []).map((p) => [p.id, p]));
  }

  async function fetchInteractionState(postIds) {
    if (!currentUserId || postIds.length === 0) return { liked: new Set(), reposted: new Set() };
    const [{ data: likes }, { data: reposts }] = await Promise.all([
      client.from('post_likes').select('post_id').eq('user_id', currentUserId).in('post_id', postIds),
      client.from('post_reposts').select('post_id').eq('user_id', currentUserId).in('post_id', postIds),
    ]);
    return {
      liked: new Set((likes || []).map((l) => l.post_id)),
      reposted: new Set((reposts || []).map((r) => r.post_id)),
    };
  }

  async function createPost({ content, visibility, replyPermission, parentPostId, mediaUrl, mediaType }) {
    const id = generatePostUUID();
    const payload = {
      id,
      author_id: currentUserId,
      content,
      visibility: visibility || 'everyone',
      reply_permission: replyPermission || 'everyone',
      parent_post_id: parentPostId || null,
      media_url: mediaUrl || null,
      media_type: mediaUrl ? (mediaType || 'image') : null,
    };

    // Insert without .select() — chaining .select().single() makes Postgres
    // evaluate the SELECT RLS policy as part of the same INSERT ... RETURNING
    // command, which has caused "violates row-level security policy" false
    // positives on other tables in this app (see conversations/participants).
    // Building the returned object client-side sidesteps that entirely.
    const { error } = await client.from('posts').insert(payload);

    if (error) {
      return { data: null, error };
    }

    // Posts have been reported as disappearing on reload despite the insert
    // reporting no error — re-fetch the row we just wrote to confirm it's
    // actually there before telling the caller it succeeded, instead of
    // trusting the optimistic object and finding out later it was never saved.
    const { data: verifyRow, error: verifyError } = await client
      .from('posts')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (verifyError || !verifyRow) {
      return {
        data: null,
        error: new Error(
          verifyError
            ? `Post insert appeared to succeed but could not be verified: ${verifyError.message}`
            : 'Post insert appeared to succeed but the post was not found afterward — it was not actually saved.'
        ),
      };
    }

    return {
      data: {
        id,
        author_id: currentUserId,
        content: payload.content,
        parent_post_id: payload.parent_post_id,
        visibility: payload.visibility,
        reply_permission: payload.reply_permission,
        view_count: 0,
        like_count: 0,
        repost_count: 0,
        reply_count: 0,
        media_url: payload.media_url,
        media_type: payload.media_type,
        created_at: new Date().toISOString(),
      },
      error: null,
    };
  }

  async function uploadPostMedia(file, onProgress) {
    const isVideo = file.type.startsWith('video/');
    const isGif = file.type === 'image/gif';
    let finalFile = file;

    // Any non-gif image over 2MB gets auto-compressed before upload, so a
    // normal phone photo just works instead of being rejected outright.
    if (!isVideo && !isGif && file.size > COMPRESS_ABOVE_BYTES) {
      try {
        finalFile = await compressPostImage(file);
      } catch (err) {
        return { error: new Error(`Could not compress this image: ${err.message}`) };
      }
    }

    // Images get compressed above, so they're held to a tight ceiling. Video
    // can't be re-encoded client-side without a heavy transcoding library, so
    // it just gets a much larger hard cap instead.
    const limit = isVideo ? MAX_POST_VIDEO_BYTES : MAX_POST_IMAGE_BYTES;
    if (finalFile.size > limit) {
      const sizeMb = (finalFile.size / (1024 * 1024)).toFixed(1);
      const limitMb = limit / (1024 * 1024);
      return { error: new Error(`File must be under ${limitMb}MB (this file is ${sizeMb}MB${finalFile !== file ? ' even after compression' : ''}).`) };
    }

    const ext = isVideo ? (file.name.split('.').pop() || 'mp4') : (isGif ? 'gif' : 'jpg');
    const path = `${currentUserId}/${generatePostUUID()}.${ext}`;

    // Uploaded via raw XHR (not the SDK's .upload()) so large files — videos
    // especially — get real progress feedback instead of just sitting on
    // "Uploading..." with no indication anything is happening.
    try {
      await uploadPostFileWithProgress(client, supabaseUrl, supabaseAnonKey, 'post-media', path, finalFile, onProgress);
    } catch (uploadError) {
      return { error: uploadError };
    }

    const { data: publicUrlData } = client.storage.from('post-media').getPublicUrl(path);

    return {
      url: publicUrlData.publicUrl,
      mediaType: isVideo ? 'video' : (isGif ? 'gif' : 'image'),
      error: null,
    };
  }

  async function fetchFavoriteGifs() {
    const { data } = await client
      .from('favorite_gifs')
      .select('id, url')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false });
    return data || [];
  }

  async function saveFavoriteGifFromUrl(url) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();

      const destPath = `${currentUserId}/${generatePostUUID()}.gif`;

      const { error: uploadError } = await client.storage
        .from('favorite-gifs')
        .upload(destPath, blob, { contentType: 'image/gif' });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = client.storage.from('favorite-gifs').getPublicUrl(destPath);

      const { error: insertError } = await client
        .from('favorite_gifs')
        .insert({ user_id: currentUserId, url: publicUrlData.publicUrl });

      if (insertError) throw insertError;

      return { error: null };
    } catch (err) {
      return { error: err };
    }
  }

  function buildCard(post, author, state, opts) {
    opts = opts || {};
    const depth = opts.depth || 0;
    const isOwn = post.author_id === currentUserId;
    const liked = state.liked.has(post.id);
    const reposted = state.reposted.has(post.id);

    const card = document.createElement('article');
    card.className = `post-card${depth > 0 ? ' post-card--comment' : ''}`;
    card.dataset.postId = post.id;

    const avatarHtml = author?.avatar_url
      ? `<img class="post-avatar" src="${author.avatar_url}" alt="">`
      : '<div class="post-avatar post-avatar--placeholder"></div>';

    const mediaHtml = post.media_url
      ? `<div class="post-media-wrap">
          ${post.media_type === 'video' ? '<video class="post-media" controls></video>' : '<img class="post-media" alt="" loading="lazy">'}
          ${post.media_type === 'gif' ? '<button type="button" class="dm-gif-favorite-button post-gif-favorite-button" aria-label="Save as favorite GIF">&#9733;</button>' : ''}
        </div>`
      : '';

    const visibilityLabels = { everyone: 'Everyone', followers: 'Followers', friends: 'Friends' };

    card.innerHTML = `
      ${opts.repostBadge ? '<div class="post-repost-badge">&#128257; Reposted</div>' : ''}
      <div class="post-card-row">
        <a class="post-avatar-link" href="/social/profiles/${post.author_id}/">${avatarHtml}</a>
        <div class="post-body">
          <div class="post-header">
            <a class="post-author-name" href="/social/profiles/${post.author_id}/">${escapePostText(author?.display_name || 'Unknown')}</a>
            ${buildBadgesHtml(author)}
            <span class="post-author-username">@${escapePostText(author?.username || 'unknown')}</span>
            <span class="post-dot">&middot;</span>
            <a class="post-time" href="/social/posts/${post.id}/">${postTimeAgo(post.created_at)}</a>
            ${isOwn ? '<button type="button" class="post-delete" aria-label="Delete post">&times;</button>' : ''}
          </div>
          <p class="post-content"></p>
          ${mediaHtml}
          ${opts.detailView ? `
          <p class="post-permissions">
            <span class="post-permissions-item">&#128065; Visible to: <strong>${visibilityLabels[post.visibility] || 'Everyone'}</strong></span>
            <span class="post-permissions-item">&#128172; Replies from: <strong>${visibilityLabels[post.reply_permission] || 'Everyone'}</strong></span>
          </p>` : ''}
          <div class="post-actions">
            ${depth === 0 ? `
            <button type="button" class="post-action post-action--comment" data-action="comment">
              <span class="post-action-icon">&#128172;</span><span class="post-action-count">${post.reply_count || 0}</span>
            </button>` : ''}
            <button type="button" class="post-action post-action--repost${reposted ? ' active' : ''}" data-action="repost">
              <span class="post-action-icon">&#128257;</span><span class="post-action-count">${post.repost_count || 0}</span>
            </button>
            <button type="button" class="post-action post-action--like${liked ? ' active' : ''}" data-action="like">
              <span class="post-action-icon">${liked ? '&#10084;' : '&#9825;'}</span><span class="post-action-count">${post.like_count || 0}</span>
            </button>
            <span class="post-action post-action--views" title="Views">
              <span class="post-action-icon">&#128065;</span><span class="post-action-count">${post.view_count || 0}</span>
            </span>
          </div>
          <p class="post-inline-error" hidden></p>
          ${depth === 0 ? `
          <div class="post-comments" id="post-comments-${post.id}" hidden>
            <div class="post-comment-list" id="post-comment-list-${post.id}"></div>
            <form class="post-comment-form" data-post-id="${post.id}">
              <input type="text" class="post-comment-input" maxlength="500" placeholder="Post your reply">
              <button type="submit" class="post-comment-submit">Reply</button>
            </form>
            <p class="post-comment-error" hidden></p>
          </div>` : ''}
        </div>
      </div>
    `;

    card.querySelector('.post-content').textContent = post.content;
    if (post.media_url) card.querySelector('.post-media').src = post.media_url;
    if (author) applyNameColor(card.querySelector('.post-author-name'), author.profile_color, author.profile_color_type);
    wireCard(card, post, author, state, opts);

    if (!opts.skipViewTracking) {
      ensureViewObserver().observe(card);
    }

    return card;
  }

  function wireCard(card, post, author, state, opts) {
    const likeButton = card.querySelector('[data-action="like"]');
    const repostButton = card.querySelector('[data-action="repost"]');
    const commentButton = card.querySelector('[data-action="comment"]');
    const deleteButton = card.querySelector('.post-delete');
    const gifFavoriteButton = card.querySelector('.post-gif-favorite-button');
    const inlineError = card.querySelector('.post-inline-error');

    // Clicking anywhere on the post opens its detail page — except on the
    // detail page itself, and except clicks that land on an actual
    // interactive element (links, buttons, the reply form), which should
    // just do their own thing rather than also navigating.
    if (!opts.detailView) {
      card.classList.add('post-card--clickable');
      card.addEventListener('click', (event) => {
        if (event.target.closest('a, button, input, textarea, form')) return;
        if (window.getSelection().toString().length > 0) return; // don't hijack text selection
        window.location.href = `/social/posts/${post.id}/`;
      });
    }

    function showInlineError(message) {
      inlineError.textContent = message;
      inlineError.hidden = false;
      clearTimeout(inlineError._hideTimer);
      inlineError._hideTimer = setTimeout(() => { inlineError.hidden = true; }, 4000);
    }

    likeButton.addEventListener('click', async () => {
      const nowLiked = likeButton.classList.contains('active');
      likeButton.classList.toggle('active');
      likeButton.querySelector('.post-action-icon').innerHTML = nowLiked ? '&#9825;' : '&#10084;';
      const countEl = likeButton.querySelector('.post-action-count');
      countEl.textContent = String(Number(countEl.textContent) + (nowLiked ? -1 : 1));

      const { error } = nowLiked
        ? await client.from('post_likes').delete().eq('post_id', post.id).eq('user_id', currentUserId)
        : await client.from('post_likes').insert({ post_id: post.id, user_id: currentUserId });

      if (error) {
        likeButton.classList.toggle('active');
        likeButton.querySelector('.post-action-icon').innerHTML = nowLiked ? '&#10084;' : '&#9825;';
        countEl.textContent = String(Number(countEl.textContent) + (nowLiked ? 1 : -1));
        showInlineError(error.message.includes('row-level security') ? "You can't interact with this post." : `Error: ${error.message}`);
      }
    });

    repostButton.addEventListener('click', async () => {
      const nowReposted = repostButton.classList.contains('active');
      repostButton.classList.toggle('active');
      const countEl = repostButton.querySelector('.post-action-count');
      countEl.textContent = String(Number(countEl.textContent) + (nowReposted ? -1 : 1));

      const { error } = nowReposted
        ? await client.from('post_reposts').delete().eq('post_id', post.id).eq('user_id', currentUserId)
        : await client.from('post_reposts').insert({ post_id: post.id, user_id: currentUserId });

      if (error) {
        repostButton.classList.toggle('active');
        countEl.textContent = String(Number(countEl.textContent) + (nowReposted ? 1 : -1));
        showInlineError(error.message.includes('row-level security') ? "You can't interact with this post." : `Error: ${error.message}`);
      }
    });

    if (commentButton) {
      const commentsWrap = card.querySelector('.post-comments');
      const commentList = card.querySelector('.post-comment-list');
      const commentForm = card.querySelector('.post-comment-form');
      const commentInput = card.querySelector('.post-comment-input');
      const commentError = card.querySelector('.post-comment-error');
      let loaded = false;

      commentButton.addEventListener('click', async () => {
        commentsWrap.hidden = !commentsWrap.hidden;
        if (!commentsWrap.hidden && !loaded) {
          loaded = true;
          await loadComments(post.id, commentList);
        }
      });

      if (opts.detailView) {
        loaded = true;
        commentsWrap.hidden = false;
        loadComments(post.id, commentList);
      }

      commentForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        commentError.hidden = true;
        const content = commentInput.value.trim();
        if (!content) return;

        const submitButton = commentForm.querySelector('.post-comment-submit');
        submitButton.disabled = true;

        const { data: newComment, error } = await createPost({ content, parentPostId: post.id });

        submitButton.disabled = false;

        if (error) {
          commentError.textContent = error.message.includes('row-level security')
            ? 'You are not allowed to reply to this post.'
            : `Error: ${error.message}`;
          commentError.hidden = false;
          return;
        }

        commentInput.value = '';
        const authorProfile = await fetchProfilesById([currentUserId]);
        const commentCard = buildCard(newComment, authorProfile.get(currentUserId), { liked: new Set(), reposted: new Set() }, { depth: 1 });
        commentList.appendChild(commentCard);

        const countEl = commentButton.querySelector('.post-action-count');
        countEl.textContent = String(Number(countEl.textContent) + 1);
      });
    }

    if (deleteButton) {
      deleteButton.addEventListener('click', async () => {
        if (!window.confirm('Delete this post? This cannot be undone.')) return;
        const { error } = await client.from('posts').delete().eq('id', post.id);
        if (error) {
          window.alert(`Failed to delete: ${error.message}`);
          return;
        }
        card.remove();
        if (opts.onDeleted) opts.onDeleted(post.id);
      });
    }

    if (gifFavoriteButton) {
      gifFavoriteButton.addEventListener('click', async () => {
        gifFavoriteButton.disabled = true;
        const { error } = await saveFavoriteGifFromUrl(post.media_url);
        gifFavoriteButton.disabled = false;

        if (error) {
          showInlineError(`Could not save this GIF: ${error.message}`);
          return;
        }

        gifFavoriteButton.classList.add('favorited');
      });
    }
  }

  async function loadComments(postId, listEl) {
    const { data: comments, error } = await client
      .from('posts')
      .select(POST_SELECT_COLUMNS)
      .eq('parent_post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      listEl.innerHTML = `<p class="post-comment-error">Failed to load replies: ${escapePostText(error.message)}</p>`;
      return;
    }

    if (!comments || comments.length === 0) {
      listEl.innerHTML = '<p class="post-comment-empty">No replies yet.</p>';
      return;
    }

    const authorMap = await fetchProfilesById(comments.map((c) => c.author_id));
    const state = await fetchInteractionState(comments.map((c) => c.id));

    listEl.innerHTML = '';
    for (const comment of comments) {
      listEl.appendChild(buildCard(comment, authorMap.get(comment.author_id), state, { depth: 1, skipViewTracking: true }));
    }
  }

  async function renderPostList(posts, container, opts) {
    const authorMap = await fetchProfilesById(posts.map((p) => p.author_id));
    const state = await fetchInteractionState(posts.map((p) => p.id));
    for (const post of posts) {
      container.appendChild(buildCard(post, authorMap.get(post.author_id), state, opts));
    }
  }

  return {
    createPost,
    renderPostList,
    buildCard,
    fetchProfilesById,
    fetchInteractionState,
    uploadPostMedia,
    fetchFavoriteGifs,
    saveFavoriteGifFromUrl,
  };
}
