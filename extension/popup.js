const DEFAULT_API_URL = 'http://localhost:3939/api/listings';

const apiUrlInput = document.getElementById('apiUrl');
const captureBtn = document.getElementById('captureBtn');
const copyBtn = document.getElementById('copyBtn');
const statusEl = document.getElementById('status');

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

// Extract listings from the active tab's content script
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

// Capture & Send to API
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

// Copy JSON fallback
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
