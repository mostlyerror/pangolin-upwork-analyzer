// Pangolin content script — reads job data from the current page only.
// No API calls to Upwork. No batch fetching. One job at a time.

function extractSingleJob() {
  // First choice: __NEXT_DATA__ — Next.js embeds full page props as JSON in the DOM.
  // This is already present on the page; we're just reading what's there.
  try {
    const raw = document.getElementById('__NEXT_DATA__')?.textContent;
    if (raw) {
      const nextData = JSON.parse(raw);
      const p = nextData?.props?.pageProps;
      const job = p?.jobDetails?.job || p?.opening || p?.job || null;
      if (job?.title) {
        const isHourly = job.hourlyBudget != null;
        return {
          title: job.title,
          description: job.description || job.descriptionText || null,
          skills: (job.skills || job.attrs || [])
            .map(s => s.prefLabel || s.name || (typeof s === 'string' ? s : null))
            .filter(Boolean),
          budgetMin: isHourly ? job.hourlyBudget?.min : (job.amount?.amount ?? null),
          budgetMax: isHourly ? job.hourlyBudget?.max : (job.amount?.amount ?? null),
          budgetType: isHourly ? 'hourly' : 'fixed',
          url: window.location.href,
        };
      }
    }
  } catch {}

  // Fallback: read visible text from known DOM elements.
  const title = document.querySelector('h1')?.textContent?.trim();
  if (!title) return null;

  const descEl = document.querySelector(
    '[data-test="description"], .description-text, .up-c-line-clamp, .description'
  );
  const skillEls = document.querySelectorAll(
    '[data-test="token"] span, .up-skill-badge span, .air3-badge-tagline'
  );

  return {
    title,
    description: descEl?.textContent?.trim() || null,
    skills: [...skillEls].map(el => el.textContent?.trim()).filter(Boolean),
    budgetMin: null,
    budgetMax: null,
    budgetType: 'fixed',
    url: window.location.href,
  };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'extract') {
    const job = extractSingleJob();
    sendResponse(job ? { job } : { error: 'Could not read job data from this page' });
    return true;
  }
});
