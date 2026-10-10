const SUPABASE_URL = 'https://vrhfajwulxjfmgzyzaxx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_37fQXfSzDzUrv35A5VSFXA_eqZBc3dB';

// Replace with your deployed gif-proxy-worker URL (see conversation for the Worker code).
const GIF_PROXY_WORKER_URL = 'https://holy-mountain-12ba.caieby988.workers.dev';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUserId = null;
let activeConversationId = null;
let activePartnerId = null;
let messageChannel = null;

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

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const YOUTUBE_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{6,15})/;

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

const dmListView = document.getElementById('dmListView');
const dmThreadView = document.getElementById('dmThreadView');
const requestsDivider = document.getElementById('requestsDivider');
const requestsSection = document.getElementById('requestsSection');
const requestsList = document.getElementById('requestsList');
const conversationsList = document.getElementById('conversationsList');
const noConversationsHint = document.getElementById('noConversationsHint');

const newDmForm = document.getElementById('newDmForm');
const newDmUsername = document.getElementById('newDmUsername');
const newDmError = document.getElementById('newDmError');

const backToListButton = document.getElementById('backToListButton');
const threadPartnerName = document.getElementById('threadPartnerName');
const threadPartnerAvatar = document.getElementById('threadPartnerAvatar');
const threadPartnerAvatarPlaceholder = document.getElementById('threadPartnerAvatarPlaceholder');
const threadPendingNotice = document.getElementById('threadPendingNotice');
const dmMessages = document.getElementById('dmMessages');
const sendMessageForm = document.getElementById('sendMessageForm');
const messageInput = document.getElementById('messageInput');
const attachButton = document.getElementById('attachButton');
const attachmentInput = document.getElementById('attachmentInput');
const attachmentPreview = document.getElementById('attachmentPreview');
const attachmentPreviewName = document.getElementById('attachmentPreviewName');
const attachmentPreviewRemove = document.getElementById('attachmentPreviewRemove');
const uploadProgress = document.getElementById('uploadProgress');
const uploadProgressBar = document.getElementById('uploadProgressBar');

let pendingAttachmentFile = null;

const gifPickerButton = document.getElementById('gifPickerButton');
const gifPicker = document.getElementById('gifPicker');
const gifPickerGrid = document.getElementById('gifPickerGrid');
const gifPickerEmpty = document.getElementById('gifPickerEmpty');
const emojiPickerButton = document.getElementById('emojiPickerButton');
const emojiPicker = document.getElementById('emojiPicker');
const emojiPickerGrid = document.getElementById('emojiPickerGrid');

const EMOJI_LIST = [
  '😀', '😂', '😅', '😊', '😍', '😘', '😜', '🤔', '😎', '🥳', '😭', '😡',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '👀', '🔥', '💯', '✨', '🎉', '💜',
  '❤️', '🧡', '💛', '💚', '💙', '🤍', '🖤', '💔', '😴', '🤯', '🥺', '😏',
];

function closeAllPickers() {
  gifPicker.hidden = true;
  emojiPicker.hidden = true;
}

async function loadFavoriteGifs() {
  const { data: favorites } = await client
    .from('favorite_gifs')
    .select('id, url')
    .eq('user_id', currentUserId)
    .order('created_at', { ascending: false });

  gifPickerGrid.querySelectorAll('.dm-gif-thumb-wrap').forEach((el) => el.remove());
  gifPickerEmpty.hidden = (favorites || []).length > 0;

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
      gifPickerEmpty.hidden = gifPickerGrid.querySelectorAll('.dm-gif-thumb-wrap').length > 0;
    });

    wrap.appendChild(img);
    wrap.appendChild(removeButton);
    gifPickerGrid.appendChild(wrap);
  });
}

gifPickerButton.addEventListener('click', async () => {
  const willOpen = gifPicker.hidden;
  closeAllPickers();
  if (willOpen) {
    gifPicker.hidden = false;
    await loadFavoriteGifs();
  }
});

emojiPickerButton.addEventListener('click', () => {
  const willOpen = emojiPicker.hidden;
  closeAllPickers();
  if (willOpen) emojiPicker.hidden = false;
});

document.querySelectorAll('[data-close-picker]').forEach((button) => {
  button.addEventListener('click', () => {
    document.getElementById(button.dataset.closePicker).hidden = true;
  });
});

document.addEventListener('click', (event) => {
  const isPickerClick = gifPicker.contains(event.target) || emojiPicker.contains(event.target)
    || gifPickerButton.contains(event.target) || emojiPickerButton.contains(event.target);
  if (!isPickerClick) closeAllPickers();
});

EMOJI_LIST.forEach((emoji) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dm-emoji-item';
  button.textContent = emoji;
  button.addEventListener('click', () => {
    messageInput.value += emoji;
    messageInput.focus();
  });
  emojiPickerGrid.appendChild(button);
});

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
          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, '.jpg'),
            { type: 'image/jpeg' }
          );
          resolve(compressedFile);
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

attachButton.addEventListener('click', () => attachmentInput.click());

attachmentInput.addEventListener('change', async () => {
  const file = attachmentInput.files[0];
  if (!file) return;

  let finalFile = file;

  const isCompressibleImage = file.type.startsWith('image/') && file.type !== 'image/gif';

  if (isCompressibleImage && file.size > MAX_ATTACHMENT_BYTES) {
    attachmentPreviewName.textContent = 'Compressing image...';
    attachmentPreview.hidden = false;
    try {
      finalFile = await compressImage(file);
    } catch (err) {
      alert(`Could not compress this image: ${err.message}`);
      attachmentInput.value = '';
      attachmentPreview.hidden = true;
      return;
    }
  }

  if (finalFile.size > MAX_ATTACHMENT_BYTES) {
    const sizeMb = (finalFile.size / (1024 * 1024)).toFixed(1);
    alert(`Attachments must be under 50MB (this file is ${sizeMb}MB${finalFile !== file ? ' even after compression' : ''}).`);
    attachmentInput.value = '';
    attachmentPreview.hidden = true;
    return;
  }

  pendingAttachmentFile = finalFile;
  attachmentPreviewName.textContent = finalFile.name;
  attachmentPreview.hidden = false;
});

attachmentPreviewRemove.addEventListener('click', () => {
  pendingAttachmentFile = null;
  attachmentInput.value = '';
  attachmentPreview.hidden = true;
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
  await loadConversationList();

  const params = new URLSearchParams(window.location.search);
  const openId = params.get('open');
  if (openId) {
    const other = await loadOtherParticipant(openId);
    if (other) {
      const { data: convo } = await client
        .from('conversations')
        .select('status')
        .eq('id', openId)
        .single();
      openThread(openId, other, convo ? convo.status : null);
    }
  }
}

async function loadOtherParticipant(conversationId) {
  const { data: participants } = await client
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId);

  const otherUserId = (participants || []).find((p) => p.user_id !== currentUserId)?.user_id;
  if (!otherUserId) return null;

  const { data: profile } = await client
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('id', otherUserId)
    .single();

  return profile;
}

async function loadConversationList() {
  const { data: myParticipations } = await client
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', currentUserId);

  const conversationIds = (myParticipations || []).map((p) => p.conversation_id);

  requestsList.innerHTML = '';
  conversationsList.innerHTML = '';
  requestsSection.hidden = true;
  requestsDivider.hidden = true;

  if (conversationIds.length === 0) {
    noConversationsHint.hidden = false;
    return;
  }

  const { data: conversations } = await client
    .from('conversations')
    .select('id, status, created_by')
    .in('id', conversationIds)
    .eq('is_group', false);

  const requests = [];
  const accepted = [];

  for (const convo of conversations || []) {
    const other = await loadOtherParticipant(convo.id);
    if (!other) continue;

    const entry = { ...convo, other };

    if (convo.status === 'pending' && convo.created_by !== currentUserId) {
      requests.push(entry);
    } else if (convo.status !== 'declined') {
      accepted.push(entry);
    }
  }

  if (requests.length > 0) {
    requestsSection.hidden = false;
    requestsDivider.hidden = false;
    requests.forEach((entry) => requestsList.appendChild(buildRequestRow(entry)));
  }

  noConversationsHint.hidden = accepted.length > 0;
  accepted.forEach((entry) => conversationsList.appendChild(buildConversationRow(entry)));
}

function buildConversationRow(entry) {
  const row = document.createElement('div');
  row.className = 'dm-row';
  row.innerHTML = `
    ${entry.other.avatar_url ? `<img class="dm-row-avatar" src="${entry.other.avatar_url}" alt="">` : '<div class="dm-row-avatar dm-row-avatar--placeholder"></div>'}
    <div class="dm-row-info">
      <span class="dm-row-name">${entry.other.display_name}</span>
      <span class="dm-row-username">@${entry.other.username}</span>
    </div>
    ${entry.status === 'pending' ? '<span class="dm-row-tag">Pending</span>' : ''}
  `;
  row.addEventListener('click', () => openThread(entry.id, entry.other, entry.status));
  return row;
}

function buildRequestRow(entry) {
  const row = document.createElement('div');
  row.className = 'dm-row';
  row.innerHTML = `
    ${entry.other.avatar_url ? `<img class="dm-row-avatar" src="${entry.other.avatar_url}" alt="">` : '<div class="dm-row-avatar dm-row-avatar--placeholder"></div>'}
    <div class="dm-row-info">
      <span class="dm-row-name">${entry.other.display_name}</span>
      <span class="dm-row-username">@${entry.other.username}</span>
    </div>
    <div class="dm-row-actions">
      <button type="button" class="copy-button" data-action="accept">Accept</button>
      <button type="button" class="copy-button" data-action="decline">Decline</button>
    </div>
  `;
  row.querySelector('[data-action="accept"]').addEventListener('click', async (event) => {
    event.stopPropagation();
    await client.from('conversations').update({ status: 'accepted' }).eq('id', entry.id);
    await loadConversationList();
  });
  row.querySelector('[data-action="decline"]').addEventListener('click', async (event) => {
    event.stopPropagation();
    await client.from('conversations').update({ status: 'declined' }).eq('id', entry.id);
    await loadConversationList();
  });
  return row;
}

newDmForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  newDmError.textContent = '';

  const username = newDmUsername.value.trim();
  if (!username) return;

  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {

  const { data: targetProfile, error: lookupError } = await client
    .from('profiles')
    .select('id, username, display_name, avatar_url, dm_privacy')
    .ilike('username', username)
    .single();

  if (lookupError || !targetProfile) {
    newDmError.textContent = lookupError ? `User not found: ${lookupError.message}` : 'User not found.';
    submitButton.disabled = false;
    return;
  }

  if (targetProfile.id === currentUserId) {
    newDmError.textContent = "You can't message yourself.";
    submitButton.disabled = false;
    return;
  }

  // Check for an existing conversation with this person
  const { data: myParticipations } = await client
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', currentUserId);

  const myConversationIds = (myParticipations || []).map((p) => p.conversation_id);

  if (myConversationIds.length > 0) {
    const { data: theirParticipations } = await client
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', targetProfile.id)
      .in('conversation_id', myConversationIds);

    if (theirParticipations && theirParticipations.length > 0) {
      openThread(theirParticipations[0].conversation_id, targetProfile, null);
      newDmUsername.value = '';
      submitButton.disabled = false;
      return;
    }
  }

  // Determine friend status if privacy is friends-only
  let status = 'accepted';
  if (targetProfile.dm_privacy === 'friends_only') {
    const [{ data: iFollowThem }, { data: theyFollowMe }] = await Promise.all([
      client.from('follows').select('follower_id').eq('follower_id', currentUserId).eq('following_id', targetProfile.id).maybeSingle(),
      client.from('follows').select('follower_id').eq('follower_id', targetProfile.id).eq('following_id', currentUserId).maybeSingle(),
    ]);

    const areFriends = !!iFollowThem && !!theyFollowMe;
    status = areFriends ? 'accepted' : 'pending';
  }

  const newConversationId = generateUUID();

  const { error: convoError } = await client
    .from('conversations')
    .insert({ id: newConversationId, is_group: false, status, created_by: currentUserId });

  if (convoError) {
    newDmError.textContent = convoError.message;
    submitButton.disabled = false;
    return;
  }

  const { error: participantsError } = await client.from('conversation_participants').insert([
    { conversation_id: newConversationId, user_id: currentUserId },
    { conversation_id: newConversationId, user_id: targetProfile.id },
  ]);

  if (participantsError) {
    newDmError.textContent = `Error: ${participantsError.message}`;
    submitButton.disabled = false;
    return;
  }

  await client.from('notifications').insert({
    user_id: targetProfile.id,
    type: 'message',
    actor_id: currentUserId,
    conversation_id: newConversationId,
  });

  newDmUsername.value = '';
  submitButton.disabled = false;
  openThread(newConversationId, targetProfile, status);

  } catch (err) {
    newDmError.textContent = `Unexpected error: ${err.message}`;
    submitButton.disabled = false;
  }
});

async function openThread(conversationId, otherProfile, status) {
  activeConversationId = conversationId;
  activePartnerId = otherProfile.id;
  dmListView.hidden = true;
  dmThreadView.hidden = false;

  threadPartnerName.textContent = otherProfile.display_name;
  threadPendingNotice.hidden = status !== 'pending';

  if (otherProfile.avatar_url) {
    threadPartnerAvatar.src = otherProfile.avatar_url;
    threadPartnerAvatar.hidden = false;
    threadPartnerAvatarPlaceholder.hidden = true;
  } else {
    threadPartnerAvatar.hidden = true;
    threadPartnerAvatarPlaceholder.hidden = false;
  }

  await loadMessages(conversationId);
  subscribeToMessages(conversationId);
}

async function loadMessages(conversationId) {
  const { data: messages } = await client
    .from('messages')
    .select('id, sender_id, content, attachment_path, attachment_type, attachment_name, attachment_url, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  // Guard against a slow, stale load finishing after the user has already
  // switched to a different conversation (or left the thread view).
  if (activeConversationId !== conversationId) return;

  dmMessages.innerHTML = '';
  for (const message of messages || []) {
    if (activeConversationId !== conversationId) return;
    await appendMessage(message);
  }
  dmMessages.scrollTop = dmMessages.scrollHeight;
}

async function appendMessage(message) {
  const isMine = message.sender_id === currentUserId;

  const wrapper = document.createElement('div');
  wrapper.className = `dm-bubble-wrapper ${isMine ? 'dm-bubble-wrapper--sent' : 'dm-bubble-wrapper--received'}`;
  wrapper.dataset.messageId = message.id;

  const bubble = document.createElement('div');
  bubble.className = `dm-bubble ${isMine ? 'dm-bubble--sent' : 'dm-bubble--received'}`;

  let mediaUrl = message.attachment_url || null;
  let attachmentError = null;

  if (!mediaUrl && message.attachment_path) {
    const { data: signed, error: signError } = await client.storage
      .from('message-attachments')
      .createSignedUrl(message.attachment_path, 3600);
    mediaUrl = signed ? signed.signedUrl : null;
    if (signError) attachmentError = signError.message;
  }

  if (!mediaUrl && attachmentError) {
    const errorEl = document.createElement('p');
    errorEl.className = 'dm-bubble-attachment-error';
    errorEl.textContent = `Attachment failed to load: ${attachmentError}`;
    bubble.appendChild(errorEl);
  }

  if (mediaUrl) {
    const isGif = (message.attachment_name || '').toLowerCase().endsWith('.gif');

    if (message.attachment_type === 'image') {
      const mediaWrap = document.createElement('div');
      mediaWrap.className = 'dm-bubble-media-wrap';

      const img = document.createElement('img');
      img.className = 'dm-bubble-image';
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
        // change across re-renders — mediaUrl is a signed URL with a fresh
        // token every time this message renders, so using it here made the
        // star's favorited state (and the tracking that prevents duplicate
        // saves) reset every time you left and reopened the conversation.
        // message.id never changes, so use that instead.
        wireGifFavoriteButton(favButton, message.attachment_url || message.id, mediaUrl, message.attachment_path);
        mediaWrap.appendChild(favButton);
      }

      bubble.appendChild(mediaWrap);
    } else if (message.attachment_type === 'video') {
      const video = document.createElement('video');
      video.className = 'dm-bubble-video';
      video.src = mediaUrl;
      video.controls = true;
      bubble.appendChild(video);
    } else {
      const link = document.createElement('a');
      link.className = 'dm-bubble-file';
      link.href = mediaUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = `📎 ${message.attachment_name || 'Attachment'}`;
      bubble.appendChild(link);
    }
  }

  if (message.content) {
    const textEl = document.createElement('div');
    if (mediaUrl) textEl.style.marginTop = '0.4rem';
    renderContentWithLinks(textEl, message.content);
    bubble.appendChild(textEl);
  }

  const row = document.createElement('div');
  row.className = 'dm-bubble-row';

  if (isMine) {
    const unsendButton = document.createElement('button');
    unsendButton.type = 'button';
    unsendButton.className = 'dm-unsend-button';
    unsendButton.setAttribute('aria-label', 'Unsend message');
    unsendButton.innerHTML = '&#128465;';
    unsendButton.addEventListener('click', async () => {
      if (!confirm('Unsend this message?')) return;
      await client.from('messages').delete().eq('id', message.id);
      wrapper.remove();
    });
    row.appendChild(unsendButton);
    row.appendChild(bubble);
  } else {
    row.appendChild(bubble);

    const reportButton = document.createElement('button');
    reportButton.type = 'button';
    reportButton.className = 'dm-report-button';
    reportButton.setAttribute('aria-label', 'Report message');
    reportButton.innerHTML = '&#128681;';
    reportButton.addEventListener('click', () => {
      openReportModal(async (reason, customReason) => {
        return await client.from('reports').insert({
          reporter_id: currentUserId,
          target_type: 'message',
          target_id: message.id,
          target_author_id: message.sender_id,
          target_content: message.content,
          reason,
          custom_reason: customReason,
        });
      });
    });
    row.appendChild(reportButton);
  }

  wrapper.appendChild(row);

  const timeEl = document.createElement('span');
  timeEl.className = 'dm-bubble-time';
  timeEl.textContent = new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  wrapper.appendChild(timeEl);

  dmMessages.appendChild(wrapper);
}

function subscribeToMessages(conversationId) {
  if (messageChannel) {
    client.removeChannel(messageChannel);
  }

  messageChannel = client
    .channel(`messages-${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      async (payload) => {
        if (activeConversationId !== conversationId) return;
        if (payload.new.sender_id === currentUserId) return;
        await appendMessage(payload.new);
        dmMessages.scrollTop = dmMessages.scrollHeight;
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => {
        if (activeConversationId !== conversationId) return;
        const wrapper = dmMessages.querySelector(`[data-message-id="${payload.old.id}"]`);
        if (wrapper) wrapper.remove();
      }
    )
    .subscribe();
}

sendMessageForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const content = messageInput.value.trim();
  if (!content && !pendingAttachmentFile) return;
  if (!activeConversationId) return;

  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  const newMessage = {
    conversation_id: activeConversationId,
    sender_id: currentUserId,
    content: content || null,
  };

  if (pendingAttachmentFile) {
    const path = `${activeConversationId}/${generateUUID()}-${pendingAttachmentFile.name}`;

    uploadProgress.hidden = false;
    uploadProgressBar.style.width = '0%';

    try {
      await uploadFileWithProgress('message-attachments', path, pendingAttachmentFile, (percent) => {
        uploadProgressBar.style.width = `${percent}%`;
      });
    } catch (uploadError) {
      alert(`Attachment failed to upload: ${uploadError.message}`);
      uploadProgress.hidden = true;
      submitButton.disabled = false;
      return;
    }

    uploadProgress.hidden = true;
    newMessage.attachment_path = path;
    newMessage.attachment_type = pendingAttachmentFile.type.startsWith('image/')
      ? 'image'
      : pendingAttachmentFile.type.startsWith('video/')
        ? 'video'
        : 'file';
    newMessage.attachment_name = pendingAttachmentFile.name;
  }

  const { data: sentMessage, error } = await client
    .from('messages')
    .insert(newMessage)
    .select('id, sender_id, content, attachment_path, attachment_type, attachment_name, attachment_url, created_at')
    .single();

  if (error || !sentMessage) {
    alert(`Failed to send message: ${error ? error.message : 'unknown error'}`);
    submitButton.disabled = false;
    return;
  }

  await appendMessage(sentMessage);
  dmMessages.scrollTop = dmMessages.scrollHeight;
  messageInput.value = '';
  pendingAttachmentFile = null;
  attachmentInput.value = '';
  attachmentPreview.hidden = true;

  await notifyPartnerOfNewMessage();

  submitButton.disabled = false;
});

async function notifyPartnerOfNewMessage() {
  if (!activePartnerId) return;

  const { data: existingUnread } = await client
    .from('notifications')
    .select('id')
    .eq('user_id', activePartnerId)
    .eq('type', 'message')
    .eq('conversation_id', activeConversationId)
    .eq('is_read', false)
    .maybeSingle();

  if (!existingUnread) {
    await client.from('notifications').insert({
      user_id: activePartnerId,
      type: 'message',
      actor_id: currentUserId,
      conversation_id: activeConversationId,
    });
  }
}

async function sendFavoriteGif(url) {
  if (!activeConversationId) return;

  const { data: sentMessage, error } = await client
    .from('messages')
    .insert({
      conversation_id: activeConversationId,
      sender_id: currentUserId,
      content: null,
      attachment_url: url,
      attachment_type: 'image',
      attachment_name: 'favorite.gif',
    })
    .select('id, sender_id, content, attachment_path, attachment_type, attachment_name, attachment_url, created_at')
    .single();

  if (error || !sentMessage) {
    alert(`Failed to send GIF: ${error ? error.message : 'unknown error'}`);
    return;
  }

  await appendMessage(sentMessage);
  dmMessages.scrollTop = dmMessages.scrollHeight;
  await notifyPartnerOfNewMessage();
}

async function saveFavoriteGif(sourceUrl, sourcePath) {
  try {
    let blob;

    if (sourcePath) {
      const { data, error } = await client.storage.from('message-attachments').download(sourcePath);
      if (error) throw error;
      blob = data;
    } else {
      // External GIF links (e.g. Tenor/Giphy) often block cross-origin fetch()
      // via CORS — route through a proxy Worker that fetches it server-side.
      const response = await fetch(`${GIF_PROXY_WORKER_URL}?url=${encodeURIComponent(sourceUrl)}`);
      if (!response.ok) throw new Error('Could not fetch this GIF from its source.');
      blob = await response.blob();
    }

    const destPath = `${currentUserId}/${generateUUID()}.gif`;

    const { error: uploadError } = await client.storage
      .from('favorite-gifs')
      .upload(destPath, blob, { contentType: 'image/gif' });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = client.storage.from('favorite-gifs').getPublicUrl(destPath);

    // Insert without .select() — chaining .select().single() makes Postgres
    // evaluate the SELECT RLS policy as part of the same INSERT ... RETURNING
    // command, which has intermittently failed the READ-BACK on other tables
    // in this app while the INSERT itself still silently succeeded (a
    // duplicate row with no visible confirmation). Generating the ID
    // client-side sidesteps that entirely.
    const newId = generateUUID();

    const { error: insertError } = await client
      .from('favorite_gifs')
      .insert({ id: newId, user_id: currentUserId, url: publicUrlData.publicUrl });

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

backToListButton.addEventListener('click', async () => {
  if (messageChannel) {
    client.removeChannel(messageChannel);
    messageChannel = null;
  }
  activeConversationId = null;
  dmThreadView.hidden = true;
  dmListView.hidden = false;
  await loadConversationList();
});

init();
