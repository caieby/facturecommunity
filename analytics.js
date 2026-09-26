const ANALYTICS_URL = 'https://facture-analytics.caieby988.workers.dev/';
const REFRESH_INTERVAL_MS = 30000;

const statRequests = document.getElementById('statRequests');
const statVisits = document.getElementById('statVisits');
const statBandwidth = document.getElementById('statBandwidth');
const statAvgSize = document.getElementById('statAvgSize');
const statusHint = document.getElementById('statusHint');
const updatedHint = document.getElementById('updatedHint');

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(exponent === 0 ? 0 : 2)} ${units[exponent]}`;
}

function animateValue(element, from, to, duration, formatter) {
  const startTime = performance.now();
  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = from + (to - from) * eased;
    element.textContent = formatter(current);
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      element.textContent = formatter(to);
    }
  }
  requestAnimationFrame(step);
}

function formatUpdatedTime(isoString) {
  const date = new Date(isoString);
  return `Last updated ${date.toLocaleString()}`;
}

async function loadAnalytics() {
  try {
    const response = await fetch(ANALYTICS_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
    const data = await response.json();

    animateValue(statRequests, 0, data.requests, 1200, (v) => Math.round(v).toLocaleString());
    animateValue(statVisits, 0, data.visits, 1200, (v) => Math.round(v).toLocaleString());
    animateValue(statBandwidth, 0, data.bandwidth, 1200, (v) => formatBytes(v));

    const avgSize = data.requests > 0 ? data.bandwidth / data.requests : 0;
    animateValue(statAvgSize, 0, avgSize, 1200, (v) => formatBytes(v));

    statusHint.textContent = 'Live stats for facturecommunity.org';
    updatedHint.textContent = formatUpdatedTime(data.generated);
  } catch (error) {
    statusHint.textContent = `Unable to load live stats right now (${error.message}).`;
    updatedHint.textContent = '';
    console.error('Analytics fetch failed:', error);
  }
}

loadAnalytics();
setInterval(loadAnalytics, REFRESH_INTERVAL_MS);
