const DEFAULT_API_URL = 'http://localhost:3005/api/listings';

const apiUrlInput = document.getElementById('apiUrl');
const analyzeBtn = document.getElementById('analyzeBtn');
const statusEl = document.getElementById('status');

chrome.storage?.local?.get(['apiUrl'], (result) => {
  apiUrlInput.value = result.apiUrl || DEFAULT_API_URL;
});

apiUrlInput.addEventListener('change', () => {
  chrome.storage?.local?.set({ apiUrl: apiUrlInput.value });
});

function setStatus(msg) {
  statusEl.textContent = msg;
}

analyzeBtn.addEventListener('click', async () => {
  analyzeBtn.disabled = true;
  setStatus('Extracting job from page...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error('Open an Upwork job page before saving.');
    }

    const jobData = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: 'extract' }, (response) => {
        if (chrome.runtime.lastError) {
          const detail = chrome.runtime.lastError.message || 'content script unavailable';
          reject(new Error(`Could not connect to this page: ${detail}. Reload the Upwork tab and try again.`));
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

    setStatus('Saving job to Pangolin...');

    const apiUrl = apiUrlInput.value || DEFAULT_API_URL;
    const baseUrl = apiUrl.replace(/\/api\/.*$/, '');

    const endpoint = `${baseUrl}/api/listings`;
    let res;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobData),
      });
    } catch (err) {
      throw new Error(
        `Could not reach Pangolin at ${endpoint}. Check that the local app is running and the API URL is correct.`
      );
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `Server returned ${res.status}` }));
      throw new Error(err.error || `Server returned ${res.status}`);
    }

    const result = await res.json().catch(() => ({}));
    if (Array.isArray(result.errors) && result.errors.length > 0) {
      throw new Error(result.errors.join('; '));
    }

    setStatus(result.inserted === 0 ? 'Already saved.' : 'Saved to Pangolin.');
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  }

  analyzeBtn.disabled = false;
});
