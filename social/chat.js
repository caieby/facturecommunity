const SUPABASE_URL = 'https://vrhfajwulxjfmgzyzaxx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_37fQXfSzDzUrv35A5VSFXA_eqZBc3dB';

// Replace with your deployed gif-proxy-worker URL (see conversation for the Worker code).
const GIF_PROXY_WORKER_URL = 'https://holy-mountain-12ba.caieby988.workers.dev';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUserId = null;
let activeChatId = null;
let messageChannel = null;
let slowmodeTimer = null;
let slowmodeUntil = 0;
let pendingAttachmentFile = null;

const MESSAGE_COLUMNS = 'id, sender_id, content, attachment_path, attachment_type, attachment_name, attachment_url, created_at';

function generateUUID() {
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

function uploadFileWithProgress(bucket, path, file, onProgress) {
  return new Promise(async (resolve, reject) => {
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      reject(new Error('Not authenticated.'));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`);
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
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

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

function compressImage(file) {
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

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const YOUTUBE_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{6,15})/;

function escapeChatText(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderContentWithLinks(container, text) {
  const parts = text.split(URL_REGEX);
  parts.forEach((part) => {
    if (!part) return;
    if (/^https?:\/\//.test(part)) {
      appendLinkEmbed(container, part);
    } else {
      container.appendChild(document.createTextNode(part));
    }
  });
}

function appendLinkEmbed(container, rawUrl) {
  const url = rawUrl.replace(/[)\].,!?]+$/, '');
  const lower = url.toLowerCase();

  const youtubeMatch = url.match(YOUTUBE_REGEX);
  if (youtubeMatch) {
    const iframe = document.createElement('iframe');
    iframe.className = 'dm-bubble-embed';
    iframe.src = `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    container.appendChild(document.createElement('br'));
    container.appendChild(iframe);
    return;
  }

  if (/\.(jpe?g|png|gif|webp|bmp|svg)(\?.*)?$/.test(lower)) {
    container.appendChild(document.createElement('br'));

    if (/\.gif(\?.*)?$/.test(lower)) {
      const mediaWrap = document.createElement('div');
      mediaWrap.className = 'dm-bubble-media-wrap';

      const img = document.createElement('img');
      img.className = 'dm-bubble-image';
      img.src = url;
      img.alt = 'Linked GIF';
      mediaWrap.appendChild(img);

      const favButton = document.createElement('button');
      favButton.type = 'button';
      favButton.className = 'dm-gif-favorite-button';
      favButton.setAttribute('aria-label', 'Save as favorite GIF');
      favButton.innerHTML = '&#9733;';
      wireGifFavoriteButton(favButton, url, url, null);
      mediaWrap.appendChild(favButton);

      container.appendChild(mediaWrap);
      return;
    }

    const img = document.createElement('img');
    img.className = 'dm-bubble-image';
    img.src = url;
    img.alt = 'Linked image';
    container.appendChild(img);
    return;
  }

  if (/\.(mp4|webm|mov|ogg)(\?.*)?$/.test(lower)) {
    const video = document.createElement('video');
    video.className = 'dm-bubble-video';
    video.src = url;
    video.controls = true;
    container.appendChild(document.createElement('br'));
    container.appendChild(video);
    return;
  }

  const link = document.createElement('a');
  link.className = 'dm-bubble-link';
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = rawUrl;
  container.appendChild(link);
}

const pageLoading = document.getElementById('pageLoading');
const chatListView = document.getElementById('chatListView');
const publicChatList = document.getElementById('publicChatList');
const chatThreadView = document.getElementById('chatThreadView');
const backToChatListButton = document.getElementById('backToChatListButton');
const chatThreadName = document.getElementById('chatThreadName');
const chatThreadDescription = document.getElementById('chatThreadDescription');
const chatMessages = document.getElementById('chatMessages');
const chatSlowmodeNotice = document.getElementById('chatSlowmodeNotice');
const sendChatMessageForm = document.getElementById('sendChatMessageForm');
const chatMessageInput = document.getElementById('chatMessageInput');
const sendChatMessageButton = document.getElementById('sendChatMessageButton');
const chatMemberCount = document.getElementById('chatMemberCount');
const chatMemberList = document.getElementById('chatMemberList');
const chatMemberToggle = document.getElementById('chatMemberToggle');
const chatMemberDropdown = document.getElementById('chatMemberDropdown');

const chatAttachButton = document.getElementById('chatAttachButton');
const chatAttachmentInput = document.getElementById('chatAttachmentInput');
const chatAttachmentPreview = document.getElementById('chatAttachmentPreview');
const chatAttachmentPreviewName = document.getElementById('chatAttachmentPreviewName');
const chatAttachmentPreviewRemove = document.getElementById('chatAttachmentPreviewRemove');
const chatUploadProgress = document.getElementById('chatUploadProgress');
const chatUploadProgressBar = document.getElementById('chatUploadProgressBar');
const chatGifPickerButton = document.getElementById('chatGifPickerButton');
const chatGifPicker = document.getElementById('chatGifPicker');
const chatGifPickerGrid = document.getElementById('chatGifPickerGrid');
const chatGifPickerEmpty = document.getElementById('chatGifPickerEmpty');
const chatEmojiPickerButton = document.getElementById('chatEmojiPickerButton');
const chatEmojiPicker = document.getElementById('chatEmojiPicker');
const chatEmojiPickerGrid = document.getElementById('chatEmojiPickerGrid');

const EMOJI_LIST = [
  '😀', '😂', '😅', '😊', '😍', '😘', '😜', '🤔', '😎', '🥳', '😭', '😡',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '👀', '🔥', '💯', '✨', '🎉', '💜',
  '❤️', '🧡', '💛', '💚', '💙', '🤍', '🖤', '💔', '😴', '🤯', '🥺', '😏',
];

function closeAllPickers() {
  chatGifPicker.hidden = true;
  chatEmojiPicker.hidden = true;
}

async function loadFavoriteGifs() {
  const { data: favorites } = await client
    .from('favorite_gifs')
    .select('id, url')
    .eq('user_id', currentUserId)
    .order('created_at', { ascending: false });

  chatGifPickerGrid.querySelectorAll('.dm-gif-thumb-wrap').forEach((el) => el.remove());
  chatGifPickerEmpty.hidden = (favorites || []).length > 0;

  (favorites || []).forEach((fav) => {
    const wrap = document.createElement('div');
    wrap.className = 'dm-gif-thumb-wrap';

    const img = document.createElement('img');
    img.className = 'dm-gif-thumb';
    img.src = fav.url;
    img.alt = 'Favorite GIF';
    img.addEventListener('click', () => {
      closeAllPickers();
      sendFavoriteGif(fav.url);
    });

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'dm-gif-thumb-remove';
    removeButton.setAttribute('aria-label', 'Remove favorite');
    removeButton.innerHTML = '&times;';
    removeButton.addEventListener('click', async (event) => {
      event.stopPropagation();
      await client.from('favorite_gifs').delete().eq('id', fav.id);
      favoriteGifMap.delete(fav.url);
      wrap.remove();
      chatGifPickerEmpty.hidden = chatGifPickerGrid.querySelectorAll('.dm-gif-thumb-wrap').length > 0;
    });

    wrap.appendChild(img);
    wrap.appendChild(removeButton);
    chatGifPickerGrid.appendChild(wrap);
  });
}

chatGifPickerButton.addEventListener('click', async () => {
  const willOpen = chatGifPicker.hidden;
  closeAllPickers();
  if (willOpen) {
    chatGifPicker.hidden = false;
    await loadFavoriteGifs();
  }
});

chatEmojiPickerButton.addEventListener('click', () => {
  const willOpen = chatEmojiPicker.hidden;
  closeAllPickers();
  if (willOpen) chatEmojiPicker.hidden = false;
});

document.querySelectorAll('[data-close-picker]').forEach((button) => {
  button.addEventListener('click', () => {
    document.getElementById(button.dataset.closePicker).hidden = true;
  });
});

document.addEventListener('click', (event) => {
  const isPickerClick = chatGifPicker.contains(event.target) || chatEmojiPicker.contains(event.target)
    || chatGifPickerButton.contains(event.target) || chatEmojiPickerButton.contains(event.target);
  if (!isPickerClick) closeAllPickers();
});

EMOJI_LIST.forEach((emoji) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dm-emoji-item';
  button.textContent = emoji;
  button.addEventListener('click', () => {
    chatMessageInput.value += emoji;
    chatMessageInput.focus();
  });
  chatEmojiPickerGrid.appendChild(button);
});

chatAttachButton.addEventListener('click', () => chatAttachmentInput.click());

chatAttachmentInput.addEventListener('change', async () => {
  const file = chatAttachmentInput.files[0];
  if (!file) return;

  let finalFile = file;
  const isCompressibleImage = file.type.startsWith('image/') && file.type !== 'image/gif';

  if (isCompressibleImage && file.size > MAX_ATTACHMENT_BYTES) {
    chatAttachmentPreviewName.textContent = 'Compressing image...';
    chatAttachmentPreview.hidden = false;
    try {
      finalFile = await compressImage(file);
    } catch (err) {
      alert(`Could not compress this image: ${err.message}`);
      chatAttachmentInput.value = '';
      chatAttachmentPreview.hidden = true;
      return;
    }
  }

  if (finalFile.size > MAX_ATTACHMENT_BYTES) {
    const sizeMb = (finalFile.size / (1024 * 1024)).toFixed(1);
    alert(`Attachments must be under 50MB (this file is ${sizeMb}MB${finalFile !== file ? ' even after compression' : ''}).`);
    chatAttachmentInput.value = '';
    chatAttachmentPreview.hidden = true;
    return;
  }

  pendingAttachmentFile = finalFile;
  chatAttachmentPreviewName.textContent = finalFile.name;
  chatAttachmentPreview.hidden = false;
});

chatAttachmentPreviewRemove.addEventListener('click', () => {
  pendingAttachmentFile = null;
  chatAttachmentInput.value = '';
  chatAttachmentPreview.hidden = true;
});

async function saveFavoriteGif(sourceUrl, sourcePath) {
  try {
    // public-chat-attachments is a public bucket, so fetch its public URL
    // directly rather than using .download() — that goes through the
    // authenticated storage path, which needs an RLS policy this bucket
    // was never given (unlike message-attachments, which is private).
    let fetchUrl = sourceUrl;
    if (sourcePath) {
      const { data: publicUrlData } = client.storage.from('public-chat-attachments').getPublicUrl(sourcePath);
      fetchUrl = publicUrlData.publicUrl;
    } else {
      // External GIF links (e.g. Tenor/Giphy) often block cross-origin fetch()
      // via CORS — route through a proxy Worker that fetches it server-side.
      fetchUrl = `${GIF_PROXY_WORKER_URL}?url=${encodeURIComponent(sourceUrl)}`;
    }

    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error('Could not fetch this GIF from its source.');
    const blob = await response.blob();

    const destPath = `${currentUserId}/${generateUUID()}.gif`;

    const { error: uploadError } = await client.storage
      .from('favorite-gifs')
      .upload(destPath, blob, { contentType: 'image/gif' });

    if (uploadError) throw uploadError;

    const { data: destPublicUrlData } = client.storage.from('favorite-gifs').getPublicUrl(destPath);

    // Insert without .select() — chaining .select().single() makes Postgres
    // evaluate the SELECT RLS policy as part of the same INSERT ... RETURNING
    // command, which has intermittently failed the READ-BACK on other tables
    // in this app while the INSERT itself still silently succeeded (a
    // duplicate row with no visible confirmation). Generating the ID
    // client-side sidesteps that entirely.
    const newId = generateUUID();

    const { error: insertError } = await client
      .from('favorite_gifs')
      .insert({ id: newId, user_id: currentUserId, url: destPublicUrlData.publicUrl });

    if (insertError) throw insertError;

    return { id: newId, error: null };
  } catch (err) {
    alert(`Could not save this GIF as a favorite: ${err.message}`);
    return { id: null, error: err };
  }
}

// Cache of the current user's favorite GIFs (url -> favorite_gifs.id), loaded
// once at init and kept in sync as favorites are added/removed.
let favoriteGifMap = new Map();

async function loadFavoriteGifMap() {
  const { data } = await client.from('favorite_gifs').select('id, url').eq('user_id', currentUserId);
  favoriteGifMap = new Map((data || []).map((f) => [f.url, f.id]));
}

// Wires a star button to toggle favorite status. identityKey is the stable
// URL used to check/track favorite state (a resent favorite's attachment_url
// matches favorite_gifs.url exactly; a fresh upload has no such match, so it
// simply starts as "not yet favorited," which is correct). sourceUrl/sourcePath
// are what's actually fetched when saving a brand-new favorite.
function wireGifFavoriteButton(button, identityKey, sourceUrl, sourcePath) {
  let favoriteId = favoriteGifMap.get(identityKey) || null;
  if (favoriteId) button.classList.add('favorited');

  button.addEventListener('click', async () => {
    // Saving means fetching + re-uploading the GIF, which can take a couple
    // seconds — with no feedback during that wait it looks unresponsive,
    // which is exactly what prompted repeat clicks before. Show a pending
    // state the instant the click registers.
    button.disabled = true;
    button.classList.add('pending');

    if (favoriteId) {
      const { error } = await client.from('favorite_gifs').delete().eq('id', favoriteId);
      if (error) {
        alert(`Could not remove favorite: ${error.message}`);
      } else {
        favoriteGifMap.delete(identityKey);
        favoriteId = null;
        button.classList.remove('favorited');
      }
    } else {
      const result = await saveFavoriteGif(sourceUrl, sourcePath);
      if (result.id) {
        favoriteId = result.id;
        favoriteGifMap.set(identityKey, result.id);
        button.classList.add('favorited');
      }
    }

    button.classList.remove('pending');
    button.disabled = false;
  });
}

async function sendFavoriteGif(url) {
  if (!activeChatId) return;

  const { error } = await client.from('public_chat_messages').insert({
    chat_id: activeChatId,
    sender_id: currentUserId,
    content: null,
    attachment_url: url,
    attachment_type: 'image',
    attachment_name: 'favorite.gif',
  });

  if (error) {
    alert(error.message.includes('Slow down') ? error.message : `Failed to send GIF: ${error.message}`);
    return;
  }

  slowmodeUntil = Date.now() + 10000;
  updateSlowmodeUI();
}

chatMemberToggle.addEventListener('click', () => {
  const isOpen = chatMemberDropdown.hidden;
  chatMemberDropdown.hidden = !isOpen;
  chatMemberToggle.setAttribute('aria-expanded', String(isOpen));
});

document.addEventListener('click', (event) => {
  if (!chatMemberToggle.contains(event.target) && !chatMemberDropdown.contains(event.target)) {
    chatMemberDropdown.hidden = true;
    chatMemberToggle.setAttribute('aria-expanded', 'false');
  }
});

async function loadChatList() {
  const { data: chats, error } = await client
    .from('public_chats')
    .select('id, name, description')
    .order('name', { ascending: true });

  if (error) {
    publicChatList.innerHTML = `<p class="hub-form-error">Failed to load chats: ${error.message}</p>`;
    return;
  }

  publicChatList.innerHTML = '';

  for (const chat of chats || []) {
    const { count } = await client
      .from('public_chat_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('chat_id', chat.id);

    const row = document.createElement('div');
    row.className = 'dm-row public-chat-row';
    row.innerHTML = `
      <div class="dm-row-info">
        <span class="dm-row-name"></span>
        <span class="chat-row-description"></span>
      </div>
      <span class="chat-row-member-count">${count || 0} member${count === 1 ? '' : 's'}</span>
    `;
    row.querySelector('.dm-row-name').textContent = chat.name;
    row.querySelector('.chat-row-description').textContent = chat.description || '';
    row.addEventListener('click', () => openChat(chat.id, chat.name, chat.description));
    publicChatList.appendChild(row);
  }
}

async function openChat(chatId, name, description) {
  activeChatId = chatId;
  chatThreadName.textContent = name;
  chatThreadDescription.textContent = description || '';
  chatListView.hidden = true;
  chatThreadView.hidden = false;
  chatMessages.innerHTML = '';
  resetSlowmodeUI();
  closeAllPickers();
  pendingAttachmentFile = null;
  chatAttachmentInput.value = '';
  chatAttachmentPreview.hidden = true;
  chatMemberDropdown.hidden = true;
  chatMemberToggle.setAttribute('aria-expanded', 'false');

  // Auto-join. A duplicate-key error just means they're already a member — ignore it.
  await client.from('public_chat_members').insert({ chat_id: chatId, user_id: currentUserId });

  await loadMembers(chatId);
  await loadMessages(chatId);
  subscribeToChat(chatId);
}

async function loadMembers(chatId) {
  const { data: members } = await client
    .from('public_chat_members')
    .select('user_id')
    .eq('chat_id', chatId)
    .order('joined_at', { ascending: true });

  const memberIds = (members || []).map((m) => m.user_id);
  chatMemberCount.textContent = memberIds.length;
  chatMemberList.innerHTML = '';

  if (memberIds.length === 0) return;

  const { data: profiles } = await client
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', memberIds);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  for (const id of memberIds) {
    const profile = profileMap.get(id);
    if (!profile) continue;

    const row = document.createElement('a');
    row.className = 'chat-member-row';
    row.href = `/social/profiles/${profile.id}/`;

    const avatarHtml = profile.avatar_url
      ? `<img class="chat-member-avatar" src="${profile.avatar_url}" alt="">`
      : '<div class="chat-member-avatar chat-member-avatar--placeholder"></div>';

    row.innerHTML = `${avatarHtml}<span class="chat-member-name"></span>`;
    row.querySelector('.chat-member-name').textContent = profile.display_name;
    chatMemberList.appendChild(row);
  }
}

async function loadMessages(chatId) {
  const { data: messages } = await client
    .from('public_chat_messages')
    .select(MESSAGE_COLUMNS)
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (activeChatId !== chatId) return;

  const senderIds = [...new Set((messages || []).map((m) => m.sender_id))];
  const profileMap = new Map();

  if (senderIds.length > 0) {
    const { data: profiles } = await client
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', senderIds);
    (profiles || []).forEach((p) => profileMap.set(p.id, p));
  }

  chatMessages.innerHTML = '';
  for (const message of messages || []) {
    await appendChatMessage(message, profileMap.get(message.sender_id));
  }
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function appendChatMessage(message, sender) {
  if (chatMessages.querySelector(`[data-message-id="${message.id}"]`)) return;

  const isMine = message.sender_id === currentUserId;

  const row = document.createElement('div');
  row.className = 'chat-message-row';
  row.dataset.messageId = message.id;

  const avatarHtml = sender?.avatar_url
    ? `<img class="chat-message-avatar" src="${sender.avatar_url}" alt="">`
    : '<div class="chat-message-avatar chat-message-avatar--placeholder"></div>';

  row.innerHTML = `
    <a class="chat-message-avatar-link" href="/social/profiles/${message.sender_id}/">${avatarHtml}</a>
    <div class="chat-message-body">
      <div class="chat-message-header">
        <a class="chat-message-name" href="/social/profiles/${message.sender_id}/"></a>
        <span class="chat-message-time"></span>
        ${isMine ? '<button type="button" class="dm-unsend-button" aria-label="Unsend message">&#128465;</button>' : ''}
      </div>
      <div class="chat-message-media"></div>
      <div class="chat-message-content"></div>
    </div>
  `;

  row.querySelector('.chat-message-name').textContent = sender?.display_name || 'Unknown';
  row.querySelector('.chat-message-time').textContent = new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  let mediaUrl = message.attachment_url || null;
  if (!mediaUrl && message.attachment_path) {
    // public-chat-attachments is a public bucket — use its public URL
    // directly instead of a signed URL (which needs an RLS policy this
    // bucket doesn't have, unlike the private message-attachments bucket).
    const { data: publicUrlData } = client.storage
      .from('public-chat-attachments')
      .getPublicUrl(message.attachment_path);
    mediaUrl = publicUrlData ? publicUrlData.publicUrl : null;
  }

  const mediaEl = row.querySelector('.chat-message-media');

  if (mediaUrl) {
    const isGif = (message.attachment_name || '').toLowerCase().endsWith('.gif');

    if (message.attachment_type === 'image') {
      const mediaWrap = document.createElement('div');
      mediaWrap.className = 'dm-bubble-media-wrap';

      const img = document.createElement('img');
      img.className = 'chat-message-image';
      img.src = mediaUrl;
      img.alt = message.attachment_name || 'Attachment';
      mediaWrap.appendChild(img);

      if (isGif) {
        const favButton = document.createElement('button');
        favButton.type = 'button';
        favButton.className = 'dm-gif-favorite-button';
        favButton.setAttribute('aria-label', 'Save as favorite GIF');
        favButton.innerHTML = '&#9733;';
        // Identity key: message.attachment_url (a resent favorite) is stable
        // and correctly matches favoriteGifMap. For a fresh upload there's no
        // such match, but the key still needs to be something that doesn't
        // change across re-renders — mediaUrl here is the public URL and
        // happens to be stable in Public Chat's case, but message.id is the
        // more robust choice either way and matches the same fix in DMs.
        wireGifFavoriteButton(favButton, message.attachment_url || message.id, mediaUrl, message.attachment_path);
        mediaWrap.appendChild(favButton);
      }

      mediaEl.appendChild(mediaWrap);
    } else if (message.attachment_type === 'video') {
      const video = document.createElement('video');
      video.className = 'chat-message-video';
      video.src = mediaUrl;
      video.controls = true;
      mediaEl.appendChild(video);
    } else {
      const link = document.createElement('a');
      link.className = 'dm-bubble-file';
      link.href = mediaUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `📎 ${message.attachment_name || 'Attachment'}`;
      mediaEl.appendChild(link);
    }
  }

  if (message.content) {
    renderContentWithLinks(row.querySelector('.chat-message-content'), message.content);
  }

  if (isMine) {
    row.querySelector('.dm-unsend-button').addEventListener('click', async () => {
      if (!confirm('Unsend this message?')) return;
      await client.from('public_chat_messages').delete().eq('id', message.id);
      row.remove();
    });
  }

  chatMessages.appendChild(row);
}

function subscribeToChat(chatId) {
  if (messageChannel) {
    client.removeChannel(messageChannel);
    messageChannel = null;
  }

  messageChannel = client
    .channel(`public-chat-${chatId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'public_chat_messages', filter: `chat_id=eq.${chatId}` },
      async (payload) => {
        const { data: sender } = await client
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .eq('id', payload.new.sender_id)
          .single();
        await appendChatMessage(payload.new, sender);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'public_chat_messages', filter: `chat_id=eq.${chatId}` },
      (payload) => {
        const row = chatMessages.querySelector(`[data-message-id="${payload.old.id}"]`);
        if (row) row.remove();
      }
    )
    .subscribe();
}

function resetSlowmodeUI() {
  clearTimeout(slowmodeTimer);
  slowmodeUntil = 0;
  sendChatMessageButton.disabled = false;
  chatSlowmodeNotice.hidden = true;
}

function updateSlowmodeUI() {
  const remaining = Math.ceil((slowmodeUntil - Date.now()) / 1000);

  if (remaining > 0) {
    sendChatMessageButton.disabled = true;
    chatSlowmodeNotice.hidden = false;
    chatSlowmodeNotice.textContent = `Slow mode: wait ${remaining}s before sending another message`;
    clearTimeout(slowmodeTimer);
    slowmodeTimer = setTimeout(updateSlowmodeUI, 250);
  } else {
    sendChatMessageButton.disabled = false;
    chatSlowmodeNotice.hidden = true;
  }
}

sendChatMessageForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const content = chatMessageInput.value.trim();
  if ((!content && !pendingAttachmentFile) || !activeChatId) return;

  sendChatMessageButton.disabled = true;

  const newMessage = {
    chat_id: activeChatId,
    sender_id: currentUserId,
    content: content || null,
  };

  if (pendingAttachmentFile) {
    const path = `${activeChatId}/${generateUUID()}-${pendingAttachmentFile.name}`;

    chatUploadProgress.hidden = false;
    chatUploadProgressBar.style.width = '0%';

    try {
      await uploadFileWithProgress('public-chat-attachments', path, pendingAttachmentFile, (percent) => {
        chatUploadProgressBar.style.width = `${percent}%`;
      });
    } catch (uploadError) {
      alert(`Attachment failed to upload: ${uploadError.message}`);
      chatUploadProgress.hidden = true;
      sendChatMessageButton.disabled = false;
      return;
    }

    newMessage.attachment_path = path;
    newMessage.attachment_type = pendingAttachmentFile.type.startsWith('image/')
      ? 'image'
      : pendingAttachmentFile.type.startsWith('video/')
        ? 'video'
        : 'file';
    newMessage.attachment_name = pendingAttachmentFile.name;
  }

  const { error } = await client.from('public_chat_messages').insert(newMessage);

  chatUploadProgress.hidden = true;

  if (error) {
    alert(error.message.includes('Slow down') ? error.message : `Failed to send: ${error.message}`);
    sendChatMessageButton.disabled = false;
    return;
  }

  chatMessageInput.value = '';
  pendingAttachmentFile = null;
  chatAttachmentInput.value = '';
  chatAttachmentPreview.hidden = true;

  slowmodeUntil = Date.now() + 10000;
  updateSlowmodeUI();
});

backToChatListButton.addEventListener('click', () => {
  if (messageChannel) {
    client.removeChannel(messageChannel);
    messageChannel = null;
  }
  activeChatId = null;
  chatThreadView.hidden = true;
  chatListView.hidden = false;
  loadChatList();
});

async function init() {
  const { data: { session } } = await client.auth.getSession();

  if (!session) {
    window.location.href = '/social/index.html';
    return;
  }

  const { error: userError } = await client.auth.getUser();
  if (userError) {
    await client.auth.signOut();
    window.location.href = '/social/index.html';
    return;
  }

  currentUserId = session.user.id;
  await loadFavoriteGifMap();

  pageLoading.hidden = true;
  chatListView.hidden = false;

  await loadChatList();
}

init();
