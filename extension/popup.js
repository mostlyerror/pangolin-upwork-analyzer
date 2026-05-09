const DEFAULT_API_URL = 'http://localhost:3939/api/listings';

const apiUrlInput = document.getElementById('apiUrl');
const captureBtn = document.getElementById('captureBtn');
const copyBtn = document.getElementById('copyBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const statusEl = document.getElementById('status');
const analysisCard = document.getElementById('analysisCard');

// Load saved API URL
chrome.storage?.local?.get(['apiUrl'], (result) => {
  apiUrlInput.value = result.apiUrl || DEFAULT_API_URL;
});

apiUrlInput.addEventListener('change', () => {
  chrome.storage?.local?.set({ apiUrl: apiUrlInput.value });
});

function setStatus(msg) {
  statusEl.innerHTML = msg;
}

// On load: show analyze section on job pages, batch section everywhere else
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isJobPage = /upwork\.com\/jobs\/~/.test(tab.url || '');
  document.getElementById('batchSection').style.display = isJobPage ? 'none' : 'block';
  document.getElementById('analyzeSection').style.display = isJobPage ? 'block' : 'none';
})();

// Extract listings from the active tab's content script (batch mode)
async function extractFromPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, { action: 'extract' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error('Not on an Upwork page, or page not fully loaded. Navigate to Upwork job search first.'));
        return;
      }
      resolve(response);
    });
  });
}

// Capture & Send to API (batch mode)
captureBtn.addEventListener('click', async () => {
  captureBtn.disabled = true;
  setStatus('Fetching listings from Upwork...');

  try {
    const { listings, count, source, apiError } = await extractFromPage();

    if (count === 0) {
      setStatus('No listings found.' + (apiError ? ` (API error: ${apiError})` : ''));
      captureBtn.disabled = false;
      return;
    }

    const sourceLabel = source === 'api' ? 'via API' : 'via DOM';
    setStatus(`Found <span class="count">${count}</span> listings ${sourceLabel}. Sending...`);

    const apiUrl = apiUrlInput.value || DEFAULT_API_URL;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(listings),
    });

    if (!res.ok) throw new Error(`API returned ${res.status}`);

    const result = await res.json();
    setStatus(
      `Sent <span class="count">${result.inserted}</span> new, ${result.skipped} duplicates skipped. (${sourceLabel})`
    );
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }

  captureBtn.disabled = false;
});

// Copy JSON fallback (batch mode)
copyBtn.addEventListener('click', async () => {
  setStatus('Fetching listings from Upwork...');

  try {
    const { listings, count, source } = await extractFromPage();

    if (count === 0) {
      setStatus('No listings found.');
      return;
    }

    await navigator.clipboard.writeText(JSON.stringify(listings, null, 2));
    const sourceLabel = source === 'api' ? 'via API' : 'via DOM';
    setStatus(`Copied <span class="count">${count}</span> listings to clipboard. (${sourceLabel})`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
});

// Analyze single job (job page mode)
analyzeBtn.addEventListener('click', async () => {
  analyzeBtn.disabled = true;
  analysisCard.classList.remove('visible');
  setStatus('Extracting job from page...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const jobData = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: 'analyze' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error('Could not connect to page. Try reloading the Upwork tab first.'));
          return;
        }
        if (response?.error) reject(new Error(response.error));
        else resolve(response?.job);
      });
    });

    if (!jobData) {
      setStatus('Could not extract job data from this page.');
      analyzeBtn.disabled = false;
      return;
    }

    setStatus('Analyzing with AI...');

    // Derive backend base URL from stored apiUrl (which points to /api/listings)
    const apiUrl = apiUrlInput.value || DEFAULT_API_URL;
    const baseUrl = apiUrl.replace(/\/api\/.*$/, '');

    const res = await fetch(`${baseUrl}/api/analyze-single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobData),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `Server returned ${res.status}` }));
      throw new Error(err.error || `Server returned ${res.status}`);
    }

    const result = await res.json();

    document.getElementById('cardPain').textContent = result.pain_symptom || '(not detected)';
    document.getElementById('cardRoot').textContent = result.pain_root_cause || '(not detected)';
    document.getElementById('cardPattern').textContent = result.solution_pattern || '(not detected)';
    document.getElementById('cardPitch').textContent = result.saas_pitch || '';
    analysisCard.classList.add('visible');

    setStatus(result.cached ? 'Loaded from cache.' : 'Analysis complete.');
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }

  analyzeBtn.disabled = false;
});
