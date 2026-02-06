const DEFAULT_API_URL = 'http://localhost:3000/api/listings';

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
  setStatus('Extracting listings...');

  try {
    const { listings, count } = await extractFromPage();

    if (count === 0) {
      setStatus('No listings found on this page.');
      captureBtn.disabled = false;
      return;
    }

    setStatus(`Found <span class="count">${count}</span> listings. Sending...`);

    const apiUrl = apiUrlInput.value || DEFAULT_API_URL;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(listings),
    });

    if (!res.ok) throw new Error(`API returned ${res.status}`);

    const result = await res.json();
    setStatus(`Sent <span class="count">${result.inserted}</span> new, ${result.skipped} duplicates skipped.`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }

  captureBtn.disabled = false;
});

// Copy JSON fallback
copyBtn.addEventListener('click', async () => {
  setStatus('Extracting listings...');

  try {
    const { listings, count } = await extractFromPage();

    if (count === 0) {
      setStatus('No listings found on this page.');
      return;
    }

    await navigator.clipboard.writeText(JSON.stringify(listings, null, 2));
    setStatus(`Copied <span class="count">${count}</span> listings to clipboard.`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  }
});
