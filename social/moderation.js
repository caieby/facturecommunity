const SUPABASE_URL = 'https://vrhfajwulxjfmgzyzaxx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_37fQXfSzDzUrv35A5VSFXA_eqZBc3dB';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const pageLoading = document.getElementById('pageLoading');
const unauthorizedView = document.getElementById('unauthorizedView');
const panelView = document.getElementById('panelView');
const reportsTab = document.getElementById('reportsTab');
const appealsTab = document.getElementById('appealsTab');
const reportsSection = document.getElementById('reportsSection');
const appealsSection = document.getElementById('appealsSection');
const reportsList = document.getElementById('reportsList');
const reportsEmpty = document.getElementById('reportsEmpty');
const appealsList = document.getElementById('appealsList');
const appealsEmpty = document.getElementById('appealsEmpty');

let currentSession = null;

async function profileLabel(userId) {
  const { data } = await client
    .from('profiles')
    .select('username, warning_count')
    .eq('id', userId)
    .single();
  return data || { username: 'unknown', warning_count: 0 };
}

function formatDate(value) {
  return new Date(value).toLocaleString();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

async function resolveReportTarget(report) {
  if (report.target_type === 'profile') {
    const profile = await profileLabel(report.target_id);
    return { userId: report.target_id, username: profile.username, warningCount: profile.warning_count, link: `/social/profiles/${report.target_id}/`, content: null };
  }

  // Posts/messages are deleted automatically when a moderator warns or
  // terminates over them, so prefer the snapshot captured at report time --
  // it's still accurate after deletion and keeps us from losing track of
  // who to act against just because the content itself is gone.
  if (report.target_author_id) {
    const profile = await profileLabel(report.target_author_id);
    const link = report.target_type === 'post' ? `/social/posts/${report.target_id}/` : null;
    return { userId: report.target_author_id, username: profile.username, warningCount: profile.warning_count, link, content: report.target_content };
  }

  if (report.target_type === 'message') {
    const { data: message } = await client
      .from('messages')
      .select('sender_id, content')
      .eq('id', report.target_id)
      .single();

    if (!message) {
      return { userId: null, username: '(deleted message)', warningCount: 0, link: null, content: null };
    }

    const profile = await profileLabel(message.sender_id);
    return { userId: message.sender_id, username: profile.username, warningCount: profile.warning_count, link: null, content: message.content };
  }

  const { data: post } = await client
    .from('posts')
    .select('author_id, content')
    .eq('id', report.target_id)
    .single();

  if (!post) {
    return { userId: null, username: '(deleted post)', warningCount: 0, link: null, content: null };
  }

  const profile = await profileLabel(post.author_id);
  return { userId: post.author_id, username: profile.username, warningCount: profile.warning_count, link: `/social/posts/${report.target_id}/`, content: post.content };
}

function targetTypeLabel(targetType) {
  if (targetType === 'profile') return 'Profile';
  if (targetType === 'message') return 'Message';
  return 'Post';
}

async function renderReports() {
  const { data: reports, error } = await client
    .from('reports')
    .select('id, case_number, reporter_id, target_type, target_id, target_author_id, target_content, reason, custom_reason, status, created_at')
    .order('created_at', { ascending: false });

  if (error || !reports || reports.length === 0) {
    reportsEmpty.hidden = false;
    reportsList.innerHTML = '';
    return;
  }

  reportsEmpty.hidden = true;
  reportsList.innerHTML = '';

  for (const report of reports) {
    const reporter = await profileLabel(report.reporter_id);
    const target = await resolveReportTarget(report);

    const card = document.createElement('div');
    card.className = 'mod-case-card';
    card.innerHTML = `
      <div class="mod-case-header">
        <span class="mod-case-id">${report.case_number}</span>
        <span class="mod-case-status mod-case-status--${report.status}">${report.status}</span>
      </div>
      <p class="mod-case-meta">Reported by <strong>${escapeHtml(reporter.username)}</strong> on ${formatDate(report.created_at)}</p>
      <p class="mod-case-meta">Target: ${targetTypeLabel(report.target_type)} &ndash; ${target.link ? `<a href="${target.link}" class="inline-link" target="_blank" rel="noopener">${escapeHtml(target.username)}</a>` : escapeHtml(target.username)} <span class="mod-case-target-id">(ID: ${escapeHtml(report.target_id)})</span></p>
      ${target.content ? `<p class="mod-case-meta"><strong>Reported content:</strong> ${escapeHtml(target.content)}</p>` : ''}
      <p class="mod-case-reason"><strong>Reason:</strong> ${escapeHtml(report.reason)}${report.custom_reason ? ` &mdash; ${escapeHtml(report.custom_reason)}` : ''}</p>
      <div class="mod-case-actions">
        ${report.status === 'open' ? `
          <button type="button" class="action-button action-button--small" data-action="resolve">Mark Resolved</button>
          <button type="button" class="action-button action-button--small moderation-terminate-button" data-action="dismiss">Dismiss</button>
        ` : ''}
        ${target.userId ? '<button type="button" class="action-button action-button--small" data-action="moderate">Moderation Actions</button>' : ''}
      </div>
    `;

    const resolveButton = card.querySelector('[data-action="resolve"]');
    if (resolveButton) {
      resolveButton.addEventListener('click', async () => {
        await client.from('reports').update({ status: 'resolved' }).eq('id', report.id);
        renderReports();
      });
    }

    const dismissButton = card.querySelector('[data-action="dismiss"]');
    if (dismissButton) {
      dismissButton.addEventListener('click', async () => {
        await client.from('reports').update({ status: 'dismissed' }).eq('id', report.id);
        renderReports();
      });
    }

    const moderateButton = card.querySelector('[data-action="moderate"]');
    if (moderateButton) {
      const deletePostId = report.target_type === 'post' ? report.target_id : null;
      const deleteMessageId = report.target_type === 'message' ? report.target_id : null;

      moderateButton.addEventListener('click', () => {
        openModerationModal(target.username, target.warningCount, async (reason) => {
          const { data, error: rpcError } = await client.rpc('warn_user', {
            _target_user_id: target.userId,
            _reason: reason,
            _delete_post_id: deletePostId,
            _delete_message_id: deleteMessageId,
            _content: target.content,
          });
          if (!rpcError) renderReports();
          return { error: rpcError, result: data };
        }, async (reason) => {
          const { error: rpcError } = await client.rpc('terminate_user', {
            _target_user_id: target.userId,
            _reason: reason,
            _delete_post_id: deletePostId,
            _delete_message_id: deleteMessageId,
            _content: target.content,
          });
          if (!rpcError) renderReports();
          return { error: rpcError };
        });
      });
    }

    reportsList.appendChild(card);
  }
}

async function renderAppeals() {
  const { data: appeals, error } = await client
    .from('appeals')
    .select('id, appeal_number, user_id, reason, status, created_at, moderation_action_id')
    .order('created_at', { ascending: false });

  if (error || !appeals || appeals.length === 0) {
    appealsEmpty.hidden = false;
    appealsList.innerHTML = '';
    return;
  }

  appealsEmpty.hidden = true;
  appealsList.innerHTML = '';

  for (const appeal of appeals) {
    const profile = await profileLabel(appeal.user_id);

    let infractionLine = '';
    if (appeal.moderation_action_id) {
      const { data: action } = await client
        .from('moderation_actions')
        .select('action_type, reason, target_post_id, target_message_id, target_content')
        .eq('id', appeal.moderation_action_id)
        .single();
      if (action) {
        const targetId = action.target_post_id || action.target_message_id;
        const targetIdLabel = action.target_post_id ? 'Post ID' : action.target_message_id ? 'Message ID' : null;
        infractionLine = `<p class="mod-case-meta">Appealing: ${action.action_type === 'terminate' ? 'Termination' : 'Warning'} &ndash; ${escapeHtml(action.reason)}</p>`
          + (action.target_content ? `<p class="mod-case-meta"><strong>Flagged content:</strong> ${escapeHtml(action.target_content)}</p>` : '')
          + (targetId ? `<p class="mod-case-meta"><strong>${targetIdLabel}:</strong> <span class="mod-case-target-id">${escapeHtml(targetId)}</span></p>` : '');
      }
    }

    const card = document.createElement('div');
    card.className = 'mod-case-card';
    card.innerHTML = `
      <div class="mod-case-header">
        <span class="mod-case-id">${appeal.appeal_number}</span>
        <span class="mod-case-status mod-case-status--${appeal.status}">${appeal.status}</span>
      </div>
      <p class="mod-case-meta">From <a href="/social/profiles/${appeal.user_id}/" class="inline-link" target="_blank" rel="noopener"><strong>${escapeHtml(profile.username)}</strong></a> on ${formatDate(appeal.created_at)}</p>
      ${infractionLine}
      <p class="mod-case-reason">${escapeHtml(appeal.reason)}</p>
      <div class="mod-case-actions">
        ${appeal.status === 'pending' ? `
          <button type="button" class="action-button action-button--small" data-action="approve">Approve</button>
          <button type="button" class="action-button action-button--small moderation-terminate-button" data-action="deny">Deny</button>
        ` : ''}
      </div>
    `;

    const approveButton = card.querySelector('[data-action="approve"]');
    if (approveButton) {
      approveButton.addEventListener('click', async () => {
        if (!window.confirm('Approve this appeal? This removes one warning from their record and updates their status accordingly.')) return;
        await client.rpc('resolve_appeal', { _appeal_id: appeal.id, _approve: true });
        renderAppeals();
      });
    }

    const denyButton = card.querySelector('[data-action="deny"]');
    if (denyButton) {
      denyButton.addEventListener('click', async () => {
        if (!window.confirm('Deny this appeal?')) return;
        await client.rpc('resolve_appeal', { _appeal_id: appeal.id, _approve: false });
        renderAppeals();
      });
    }

    appealsList.appendChild(card);
  }
}

function switchTab(tab) {
  const showReports = tab === 'reports';
  reportsSection.hidden = !showReports;
  appealsSection.hidden = showReports;
  reportsTab.setAttribute('aria-selected', String(showReports));
  appealsTab.setAttribute('aria-selected', String(!showReports));
}

reportsTab.addEventListener('click', () => switchTab('reports'));
appealsTab.addEventListener('click', () => switchTab('appeals'));

async function init() {
  const { data: { session } } = await client.auth.getSession();

  if (!session) {
    window.location.href = '/social/index.html';
    return;
  }

  currentSession = session;

  const { data: profile } = await client
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  pageLoading.hidden = true;

  if (!profile || (profile.role !== 'moderator' && profile.role !== 'owner')) {
    unauthorizedView.hidden = false;
    return;
  }

  panelView.hidden = false;
  await renderReports();
  await renderAppeals();
}

init();
