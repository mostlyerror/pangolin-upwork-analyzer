// Pangolin content script — reads job data from the current page only.
// No API calls to Upwork. No batch fetching. One job at a time.

function cleanText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function cleanTitle(value) {
  return cleanText(value)
    .replace(/\s+-\s+Upwork(?:\s+.*)?$/i, '')
    .replace(/\s+\|\s+Upwork(?:\s+.*)?$/i, '')
    .trim();
}

function getMetaContent(name) {
  return document
    .querySelector(`meta[property="${name}"], meta[name="${name}"]`)
    ?.getAttribute('content');
}

function normalizeSkills(skills) {
  return (Array.isArray(skills) ? skills : [])
    .map((skill) => skill?.prefLabel || skill?.name || skill?.label || (typeof skill === 'string' ? skill : null))
    .filter(Boolean);
}

function normalizeJob(job) {
  if (!job?.title) return null;

  const isHourly = job.hourlyBudget != null || /hourly/i.test(job.engagement || '');
  return {
    title: cleanTitle(job.title),
    description: cleanText(job.description || job.descriptionText || job.details || '') || null,
    skills: normalizeSkills(job.skills || job.attrs || job.tags),
    budgetMin: isHourly ? job.hourlyBudget?.min ?? null : (job.amount?.amount ?? job.budget?.amount ?? null),
    budgetMax: isHourly ? job.hourlyBudget?.max ?? null : (job.amount?.amount ?? job.budget?.amount ?? null),
    budgetType: isHourly ? 'hourly' : 'fixed',
    url: window.location.href,
  };
}

function findJobInJson(value, depth = 0, seen = new Set()) {
  if (!value || typeof value !== 'object' || depth > 8 || seen.has(value)) return null;
  seen.add(value);

  const direct = normalizeJob(value);
  if (direct && (direct.description || direct.skills.length > 0)) return direct;

  const likelyKeys = ['jobDetails', 'opening', 'job', 'jobPosting', 'posting', 'ciphertext'];
  for (const key of likelyKeys) {
    if (value[key]) {
      const found = findJobInJson(value[key], depth + 1, seen);
      if (found) return found;
    }
  }

  for (const child of Object.values(value)) {
    const found = findJobInJson(child, depth + 1, seen);
    if (found) return found;
  }

  return null;
}

function extractFromJsonScripts() {
  const scripts = [
    document.getElementById('__NEXT_DATA__'),
    ...document.querySelectorAll('script[type="application/json"], script:not([src])'),
  ].filter(Boolean);

  for (const script of scripts) {
    const raw = script.textContent?.trim();
    if (!raw || raw.length < 20 || (!raw.includes('title') && !raw.includes('job'))) continue;

    try {
      const parsed = JSON.parse(raw);
      const found = findJobInJson(parsed);
      if (found) return found;
    } catch {}
  }

  return null;
}

function extractSingleJob() {
  const jsonJob = extractFromJsonScripts();
  if (jsonJob) return jsonJob;

  // Fallback: read visible text from known DOM elements.
  const title = cleanTitle(
    document.querySelector('h1, [data-test="job-title"], [data-qa="job-title"]')?.textContent ||
    getMetaContent('og:title') ||
    getMetaContent('twitter:title') ||
    document.title
  );
  if (!title) return null;

  const descEl = document.querySelector(
    '[data-test="description"], .description-text, .up-c-line-clamp, .description'
  );
  const skillEls = document.querySelectorAll(
    '[data-test="token"] span, .up-skill-badge span, .air3-badge-tagline'
  );

  return {
    title,
    description: cleanText(
      descEl?.textContent ||
      getMetaContent('og:description') ||
      getMetaContent('description') ||
      ''
    ) || null,
    skills: [...skillEls].map(el => cleanText(el.textContent)).filter(Boolean),
    budgetMin: null,
    budgetMax: null,
    budgetType: 'fixed',
    url: window.location.href,
  };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'extract') {
    const job = extractSingleJob();
    sendResponse(job ? { job } : { error: 'Could not read job data from this page. Make sure the Upwork job page is fully loaded.' });
    return true;
  }
});
