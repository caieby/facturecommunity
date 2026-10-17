const SUPABASE_URL = 'https://vrhfajwulxjfmgzyzaxx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_37fQXfSzDzUrv35A5VSFXA_eqZBc3dB';

const GIF_PROXY_WORKER_URL = 'https://holy-mountain-12ba.caieby988.workers.dev';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MAX_GROUP_MEMBERS = 10;

let currentUserId = null;
let activeGroupId = null;
let activeGroupCreatedBy = null;
let activeGroupMemberProfiles = new Map();
let messageChannel = null;

function escapeGroupText(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function timeAgo(dateStr) {
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

function generateUUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

async function areFriends(otherUserId) {
  const [{ data: iFollowThem }, { data: theyFollowMe }] = await Promise.all([
    client.from('follows').select('follower_id').eq('follower_id', currentUserId).eq('following_id', otherUserId).maybeSingle(),
    client.from('follows').select('follower_id').eq('follower_id', otherUserId).eq('following_id', currentUserId).maybeSingle(),
  ]);
  return !!iFollowThem && !!theyFollowMe;
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

const dmListView = document.getElementById('groupListView');
const dmThreadView = document.getElementById('groupThreadView');
const groupsList = document.getElementById('groupsList');
const noGroupsHint = document.getElementById('noGroupsHint');

const newGroupForm = document.getElementById('newGroupForm');
const newGroupName = document.getElementById('newGroupName');
const newGroupMemberInput = document.getElementById('newGroupMemberInput');
const newGroupAddMemberButton = document.getElementById('newGroupAddMemberButton');
const newGroupMemberError = document.getElementById('newGroupMemberError');
const newGroupMemberChips = document.getElementById('newGroupMemberChips');
const newGroupCountHint = document.getElementById('newGroupCountHint');
const newGroupError = document.getElementById('newGroupError');

const groupBackToListButton = document.getElementById('groupBackToListButton');
const groupThreadName = document.getElementById('groupThreadName');
const groupMemberCount = document.getElementById('groupMemberCount');
const groupMembersButton = document.getElementById('groupMembersButton');
const leaveGroupButton = document.getElementById('leaveGroupButton');
const groupMembersPanel = document.getElementById('groupMembersPanel');
const groupMembersList = document.getElementById('groupMembersList');
const addMemberForm = document.getElementById('addMemberForm');
const addMemberInput = document.getElementById('addMemberInput');
const addMemberError = document.getElementById('addMemberError');

const dmMessages = document.getElementById('groupMessages');
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
let pendingNewMembers = [];

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

let favoriteGifMap = new Map();

async function loadFavoriteGifMap() {
  const { data } = await client.from('favorite_gifs').select('id, url').eq('user_id', currentUserId);
  favoriteGifMap = new Map((data || []).map((f) => [f.url, f.id]));
}

async function saveFavoriteGif(sourceUrl, sourcePath) {
  try {
    let blob;

    if (sourcePath) {
      const { data, error } = await client.storage.from('message-attachments').download(sourcePath);
      if (error) throw error;
      blob = data;
    } else {
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

function wireGifFavoriteButton(button, identityKey, sourceUrl, sourcePath) {
  let favoriteId = favoriteGifMap.get(identityKey) || null;
  if (favoriteId) button.classList.add('favorited');

  button.addEventListener('click', async () => {
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

function previewText(message) {
  if (!message) return 'No messages yet';
  if (message.content) return message.content;
  if (message.attachment_type === 'image') return '📷 Photo';
  if (message.attachment_type === 'video') return '🎞 Video';
  return '📎 Attachment';
}

async function loadGroupList() {
  const { data: myParticipations } = await client
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', currentUserId);

  const conversationIds = (myParticipations || []).map((p) => p.conversation_id);

  groupsList.innerHTML = '';

  if (conversationIds.length === 0) {
    noGroupsHint.hidden = false;
    return;
  }

  const { data: groups } = await client
    .from('conversations')
    .select('id, group_name, created_by')
    .in('id', conversationIds)
    .eq('is_group', true);

  if (!groups || groups.length === 0) {
    noGroupsHint.hidden = false;
    return;
  }

  const { data: recentMessages } = await client
    .from('messages')
    .select('conversation_id, content, attachment_type, created_at')
    .in('conversation_id', groups.map((g) => g.id))
    .order('created_at', { ascending: false });

  const lastMessageByConvo = new Map();
  (recentMessages || []).forEach((message) => {
    if (!lastMessageByConvo.has(message.conversation_id)) {
      lastMessageByConvo.set(message.conversation_id, message);
    }
  });

  groups.sort((a, b) => {
    const aTime = lastMessageByConvo.has(a.id) ? new Date(lastMessageByConvo.get(a.id).created_at).getTime() : 0;
    const bTime = lastMessageByConvo.has(b.id) ? new Date(lastMessageByConvo.get(b.id).created_at).getTime() : 0;
    return bTime - aTime;
  });

  noGroupsHint.hidden = true;

  groups.forEach((group) => {
    const lastMessage = lastMessageByConvo.get(group.id) || null;
    const row = document.createElement('div');
    row.className = 'dm-row';
    row.innerHTML = `
      <div class="dm-row-avatar dm-row-avatar--placeholder group-thread-icon">#</div>
      <div class="dm-row-info">
        <div class="dm-row-top">
          <span class="dm-row-name">${escapeGroupText(group.group_name || 'Group')}</span>
          ${lastMessage ? `<span class="dm-row-time">${timeAgo(lastMessage.created_at)}</span>` : ''}
        </div>
        <span class="dm-row-preview">${escapeGroupText(previewText(lastMessage))}</span>
      </div>
    `;
    row.addEventListener('click', () => openGroupThread(group.id));
    groupsList.appendChild(row);
  });
}

newGroupAddMemberButton.addEventListener('click', async () => {
  newGroupMemberError.textContent = '';

  const username = newGroupMemberInput.value.trim();
  if (!username) return;

  if (pendingNewMembers.length >= MAX_GROUP_MEMBERS - 1) {
    newGroupMemberError.textContent = `Groups are capped at ${MAX_GROUP_MEMBERS} members total.`;
    return;
  }

  newGroupAddMemberButton.disabled = true;

  const { data: targetProfile, error: lookupError } = await client
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .ilike('username', username)
    .single();

  if (lookupError || !targetProfile) {
    newGroupMemberError.textContent = 'User not found.';
    newGroupAddMemberButton.disabled = false;
    return;
  }

  if (targetProfile.id === currentUserId) {
    newGroupMemberError.textContent = "You're already in the group.";
    newGroupAddMemberButton.disabled = false;
    return;
  }

  if (pendingNewMembers.some((m) => m.id === targetProfile.id)) {
    newGroupMemberError.textContent = 'Already added.';
    newGroupAddMemberButton.disabled = false;
    return;
  }

  if (!(await areFriends(targetProfile.id))) {
    newGroupMemberError.textContent = 'You can only add mutual friends to a group.';
    newGroupAddMemberButton.disabled = false;
    return;
  }

  pendingNewMembers.push(targetProfile);
  newGroupMemberInput.value = '';
  newGroupAddMemberButton.disabled = false;
  renderPendingMemberChips();
});

function renderPendingMemberChips() {
  newGroupMemberChips.innerHTML = '';
  pendingNewMembers.forEach((member) => {
    const chip = document.createElement('span');
    chip.className = 'group-member-chip';
    chip.innerHTML = `@${escapeGroupText(member.username)} <button type="button" aria-label="Remove">&times;</button>`;
    chip.querySelector('button').addEventListener('click', () => {
      pendingNewMembers = pendingNewMembers.filter((m) => m.id !== member.id);
      renderPendingMemberChips();
    });
    newGroupMemberChips.appendChild(chip);
  });
  newGroupCountHint.textContent = `${pendingNewMembers.length} / ${MAX_GROUP_MEMBERS - 1} members added (plus you)`;
}

newGroupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  newGroupError.textContent = '';

  const groupName = newGroupName.value.trim();
  if (!groupName) return;

  if (pendingNewMembers.length === 0) {
    newGroupError.textContent = 'Add at least one member.';
    return;
  }

  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  const newConversationId = generateUUID();

  const { error: convoError } = await client
    .from('conversations')
    .insert({ id: newConversationId, is_group: true, group_name: groupName, status: 'accepted', created_by: currentUserId });

  if (convoError) {
    newGroupError.textContent = convoError.message;
    submitButton.disabled = false;
    return;
  }

  const participantRows = [
    { conversation_id: newConversationId, user_id: currentUserId },
    ...pendingNewMembers.map((m) => ({ conversation_id: newConversationId, user_id: m.id })),
  ];

  const { error: participantsError } = await client.from('conversation_participants').insert(participantRows);

  if (participantsError) {
    newGroupError.textContent = `Error: ${participantsError.message}`;
    submitButton.disabled = false;
    return;
  }

  await Promise.all(pendingNewMembers.map((m) => client.from('notifications').insert({
    user_id: m.id,
    type: 'group_invite',
    actor_id: currentUserId,
    conversation_id: newConversationId,
  })));

  newGroupName.value = '';
  pendingNewMembers = [];
  renderPendingMemberChips();
  submitButton.disabled = false;
  await loadGroupList();
  await openGroupThread(newConversationId);
});

async function loadGroupMembers(conversationId) {
  const { data: participants } = await client
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId);

  const memberIds = (participants || []).map((p) => p.user_id);
  if (memberIds.length === 0) return new Map();

  const { data: profiles } = await client
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', memberIds);

  return new Map((profiles || []).map((p) => [p.id, p]));
}

function renderMembersPanel() {
  groupMembersList.innerHTML = '';
  const isCreator = activeGroupCreatedBy === currentUserId;

  activeGroupMemberProfiles.forEach((member) => {
    const row = document.createElement('div');
    row.className = 'group-member-row';
    row.innerHTML = `
      ${member.avatar_url ? `<img class="notif-avatar" src="${member.avatar_url}" alt="">` : '<div class="notif-avatar notif-avatar--placeholder"></div>'}
      <span class="group-member-name">${escapeGroupText(member.display_name)} ${member.id === activeGroupCreatedBy ? '<span class="dm-row-tag">Creator</span>' : ''}</span>
    `;

    if (isCreator && member.id !== currentUserId) {
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'group-member-remove';
      removeButton.setAttribute('aria-label', 'Remove member');
      removeButton.innerHTML = '&times;';
      removeButton.addEventListener('click', async () => {
        if (!confirm(`Remove ${member.display_name} from the group?`)) return;
        await client.from('conversation_participants').delete().eq('conversation_id', activeGroupId).eq('user_id', member.id);
        activeGroupMemberProfiles.delete(member.id);
        renderMembersPanel();
        updateMemberCount();
      });
      row.appendChild(removeButton);
    }

    groupMembersList.appendChild(row);
  });

  addMemberForm.hidden = !isCreator || activeGroupMemberProfiles.size >= MAX_GROUP_MEMBERS;
}

function updateMemberCount() {
  groupMemberCount.textContent = `${activeGroupMemberProfiles.size} member${activeGroupMemberProfiles.size === 1 ? '' : 's'}`;
}

groupMembersButton.addEventListener('click', () => {
  groupMembersPanel.hidden = !groupMembersPanel.hidden;
});

addMemberForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  addMemberError.textContent = '';

  const username = addMemberInput.value.trim();
  if (!username) return;

  if (activeGroupMemberProfiles.size >= MAX_GROUP_MEMBERS) {
    addMemberError.textContent = `Groups are capped at ${MAX_GROUP_MEMBERS} members total.`;
    return;
  }

  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  const { data: targetProfile, error: lookupError } = await client
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .ilike('username', username)
    .single();

  if (lookupError || !targetProfile) {
    addMemberError.textContent = 'User not found.';
    submitButton.disabled = false;
    return;
  }

  if (activeGroupMemberProfiles.has(targetProfile.id)) {
    addMemberError.textContent = 'Already a member.';
    submitButton.disabled = false;
    return;
  }

  if (!(await areFriends(targetProfile.id))) {
    addMemberError.textContent = 'You can only add mutual friends to a group.';
    submitButton.disabled = false;
    return;
  }

  const { error: insertError } = await client
    .from('conversation_participants')
    .insert({ conversation_id: activeGroupId, user_id: targetProfile.id });

  submitButton.disabled = false;

  if (insertError) {
    addMemberError.textContent = insertError.message;
    return;
  }

  await client.from('notifications').insert({
    user_id: targetProfile.id,
    type: 'group_invite',
    actor_id: currentUserId,
    conversation_id: activeGroupId,
  });

  activeGroupMemberProfiles.set(targetProfile.id, targetProfile);
  addMemberInput.value = '';
  renderMembersPanel();
  updateMemberCount();
});

async function openGroupThread(conversationId) {
  activeGroupId = conversationId;
  dmListView.hidden = true;
  dmThreadView.hidden = false;
  groupMembersPanel.hidden = true;

  const { data: convo } = await client
    .from('conversations')
    .select('group_name, created_by')
    .eq('id', conversationId)
    .single();

  if (!convo) return;

  groupThreadName.textContent = convo.group_name || 'Group';
  activeGroupCreatedBy = convo.created_by;

  activeGroupMemberProfiles = await loadGroupMembers(conversationId);
  updateMemberCount();
  renderMembersPanel();

  await loadMessages(conversationId);
  subscribeToMessages(conversationId);

  client
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', currentUserId)
    .in('type', ['group_message', 'group_invite'])
    .eq('conversation_id', conversationId)
    .eq('is_read', false)
    .then(() => {});
}

async function loadMessages(conversationId) {
  const { data: messages } = await client
    .from('messages')
    .select('id, sender_id, content, attachment_path, attachment_type, attachment_name, attachment_url, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (activeGroupId !== conversationId) return;

  dmMessages.innerHTML = '';
  for (const message of messages || []) {
    if (activeGroupId !== conversationId) return;
    await appendMessage(message);
  }
  dmMessages.scrollTop = dmMessages.scrollHeight;
}

async function appendMessage(message) {
  const isMine = message.sender_id === currentUserId;
  const sender = activeGroupMemberProfiles.get(message.sender_id);

  const wrapper = document.createElement('div');
  wrapper.className = `dm-bubble-wrapper ${isMine ? 'dm-bubble-wrapper--sent' : 'dm-bubble-wrapper--received'}`;
  wrapper.dataset.messageId = message.id;

  if (!isMine && sender) {
    const nameEl = document.createElement('span');
    nameEl.className = 'group-message-sender';
    nameEl.textContent = sender.display_name;
    wrapper.appendChild(nameEl);
  }

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
      if (!(await requireHumanCheck())) return;
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
    .channel(`group-messages-${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      async (payload) => {
        if (activeGroupId !== conversationId) return;
        if (payload.new.sender_id === currentUserId) return;
        await appendMessage(payload.new);
        dmMessages.scrollTop = dmMessages.scrollHeight;
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => {
        if (activeGroupId !== conversationId) return;
        const wrapper = dmMessages.querySelector(`[data-message-id="${payload.old.id}"]`);
        if (wrapper) wrapper.remove();
      }
    )
    .subscribe();
}

async function notifyGroupMembers() {
  const otherMemberIds = [...activeGroupMemberProfiles.keys()].filter((id) => id !== currentUserId);

  await Promise.all(otherMemberIds.map(async (memberId) => {
    const { data: existingUnread } = await client
      .from('notifications')
      .select('id')
      .eq('user_id', memberId)
      .eq('type', 'group_message')
      .eq('conversation_id', activeGroupId)
      .eq('is_read', false)
      .maybeSingle();

    if (!existingUnread) {
      await client.from('notifications').insert({
        user_id: memberId,
        type: 'group_message',
        actor_id: currentUserId,
        conversation_id: activeGroupId,
      });
    }
  }));
}

sendMessageForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const content = messageInput.value.trim();
  if (!content && !pendingAttachmentFile) return;
  if (!activeGroupId) return;

  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;

  const newMessage = {
    conversation_id: activeGroupId,
    sender_id: currentUserId,
    content: content || null,
  };

  if (pendingAttachmentFile) {
    const path = `${activeGroupId}/${generateUUID()}-${pendingAttachmentFile.name}`;

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
  submitButton.disabled = false;

  await notifyGroupMembers();
});

async function sendFavoriteGif(url) {
  if (!activeGroupId) return;

  const { data: sentMessage, error } = await client
    .from('messages')
    .insert({
      conversation_id: activeGroupId,
      sender_id: currentUserId,
      content: null,
      attachment_url: url,
      attachment_type: 'image',
      attachment_name: 'favorite.gif',
    })
    .select('id, sender_id, content, attachment_path, attachment_type, attachment_name, attachment_url, created_at')
    .single();

  if (error || !sentMessage) return;

  await appendMessage(sentMessage);
  dmMessages.scrollTop = dmMessages.scrollHeight;
  await notifyGroupMembers();
}

groupBackToListButton.addEventListener('click', async () => {
  if (messageChannel) {
    client.removeChannel(messageChannel);
    messageChannel = null;
  }
  activeGroupId = null;
  dmThreadView.hidden = true;
  dmListView.hidden = false;
  await loadGroupList();
});

leaveGroupButton.addEventListener('click', async () => {
  if (!activeGroupId) return;
  if (!confirm('Leave this group?')) return;

  const leavingGroupId = activeGroupId;
  const wasCreator = activeGroupCreatedBy === currentUserId;

  const { error } = await client
    .from('conversation_participants')
    .delete()
    .eq('conversation_id', leavingGroupId)
    .eq('user_id', currentUserId);

  if (error) {
    alert(`Could not leave the group: ${error.message}`);
    return;
  }

  const remainingIds = [...activeGroupMemberProfiles.keys()].filter((id) => id !== currentUserId);

  if (remainingIds.length === 0) {
    await client.from('conversations').delete().eq('id', leavingGroupId).then(() => {});
  } else if (wasCreator) {
    // The creator carries the only permission to add/remove members -- if
    // they're the one leaving and anyone's still in the group, someone has
    // to inherit that or the group is stuck with no one able to manage it.
    await client.from('conversations').update({ created_by: remainingIds[0] }).eq('id', leavingGroupId).then(() => {});
  }

  if (messageChannel) {
    client.removeChannel(messageChannel);
    messageChannel = null;
  }
  activeGroupId = null;
  dmThreadView.hidden = true;
  dmListView.hidden = false;
  await loadGroupList();
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
  renderPendingMemberChips();
  await loadGroupList();

  const openId = new URLSearchParams(window.location.search).get('open');
  if (openId) await openGroupThread(openId);
}

init();
