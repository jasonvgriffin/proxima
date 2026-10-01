const semver = require('semver');

const RELEASES_API = 'https://api.github.com/repos/jasonvgriffin/proxima/releases/latest';
const RELEASE_PREFIX = 'https://github.com/jasonvgriffin/proxima/releases/';
const CHECK_TIMEOUT_MS = 5000;

function isAllowedReleaseUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.hostname !== 'github.com') return false;
  const path = parsed.pathname.replace(/\/+$/, '');
  return path === '/jasonvgriffin/proxima/releases' || path.startsWith('/jasonvgriffin/proxima/releases/');
}

function normalizeVersion(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim().replace(/^v/i, '');
  return semver.valid(text);
}

function compareVersions(latestTag, currentVersion, skippedVersion) {
  const latest = normalizeVersion(latestTag);
  const current = normalizeVersion(currentVersion);
  if (!latest || !current) return { newer: false, reason: 'invalid', latest, current };
  if (semver.prerelease(latest)) return { newer: false, reason: 'prerelease', latest, current };
  const skipped = normalizeVersion(skippedVersion);
  if (skipped && semver.eq(latest, skipped)) return { newer: false, reason: 'skipped', latest, current };
  if (semver.gt(latest, current)) return { newer: true, reason: 'newer', latest, current };
  return { newer: false, reason: 'current', latest, current };
}

function parseSha256(digest) {
  if (typeof digest !== 'string') return null;
  const match = /^sha256:([a-f0-9]{64})$/i.exec(digest.trim());
  return match ? match[1].toLowerCase() : null;
}

function chooseInstaller(release, { portable }) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const kind = portable ? 'Portable' : 'Setup';
  const asset = assets.find((item) => {
    const name = item?.name;
    return typeof name === 'string'
      && new RegExp(`^Proxima-${kind}-\\d+\\.\\d+\\.\\d+\\.exe$`).test(name)
      && isAllowedReleaseUrl(item.browser_download_url);
  });
  if (!asset) return null;
  return {
    fileName: asset.name,
    size: typeof asset.size === 'number' && asset.size > 0 ? asset.size : 0,
    url: asset.browser_download_url,
    sha256: parseSha256(asset.digest),
  };
}

function noticeFrom(release, currentVersion, skippedVersion) {
  const compared = compareVersions(release?.tag_name, currentVersion, skippedVersion);
  const url = typeof release?.html_url === 'string' && isAllowedReleaseUrl(release.html_url)
    ? release.html_url
    : `https://github.com/jasonvgriffin/proxima/releases/tag/v${compared.latest || '0.0.0'}`;
  if (!compared.newer) {
    return { status: compared.reason === 'skipped' ? 'skipped' : compared.reason === 'prerelease' ? 'prerelease' : 'current' };
  }
  if (!isAllowedReleaseUrl(url)) return { status: 'error' };
  return {
    status: 'available',
    version: compared.latest,
    notes: typeof release.body === 'string' ? release.body : '',
    url,
  };
}

async function checkLatestRelease({
  fetchImpl,
  currentVersion,
  settings,
  timeoutMs = CHECK_TIMEOUT_MS,
  now = () => Date.now(),
  log = () => {},
}) {
  const prefs = settings || {};
  if (prefs.updateCheck !== true) return { status: 'disabled' };
  const resetAt = typeof prefs.rateLimitReset === 'number' ? prefs.rateLimitReset : 0;
  if (resetAt && now() < resetAt) {
    log('Update check skipped until the GitHub rate limit resets.');
    return { status: 'rate-limited', reset: resetAt };
  }
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': `Proxima/${currentVersion} (https://github.com/jasonvgriffin/proxima)`,
  };
  const etag = prefs.updateCache && typeof prefs.updateCache.etag === 'string' ? prefs.updateCache.etag : '';
  if (etag) headers['If-None-Match'] = etag;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(RELEASES_API, { headers, signal: controller.signal });
  } catch (error) {
    log(`Update check failed: ${error instanceof Error ? error.message : String(error)}`);
    return { status: 'offline' };
  } finally {
    clearTimeout(timer);
  }
  if (!response) {
    log('Update check failed: empty response.');
    return { status: 'offline' };
  }
  if (response.status === 304) {
    const cached = prefs.updateCache && prefs.updateCache.release;
    if (!cached) {
      log('Update check got 304 without a cached release.');
      return { status: 'current' };
    }
    return noticeFrom(cached, currentVersion, prefs.skippedVersion);
  }
  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers?.get?.('x-ratelimit-remaining');
    const resetHeader = response.headers?.get?.('x-ratelimit-reset');
    if (remaining === '0' && resetHeader && Number.isFinite(Number(resetHeader))) {
      const reset = Number(resetHeader) * 1000;
      log(`Update check rate limited until ${new Date(reset).toISOString()}.`);
      return { status: 'rate-limited', reset, persist: { rateLimitReset: reset } };
    }
    log(`Update check HTTP ${response.status}.`);
    return { status: 'error' };
  }
  if (!response.ok) {
    log(`Update check HTTP ${response.status}.`);
    return { status: 'error' };
  }
  let release;
  try {
    release = await response.json();
  } catch (error) {
    log(`Update check could not read the response: ${error instanceof Error ? error.message : String(error)}`);
    return { status: 'error' };
  }
  const nextEtag = response.headers?.get?.('etag') || etag || null;
  const result = noticeFrom(release, currentVersion, prefs.skippedVersion);
  result.persist = { updateCache: { etag: nextEtag, release }, rateLimitReset: null };
  return result;
}

module.exports = {
  RELEASES_API,
  RELEASE_PREFIX,
  CHECK_TIMEOUT_MS,
  isAllowedReleaseUrl,
  normalizeVersion,
  compareVersions,
  chooseInstaller,
  checkLatestRelease,
};
