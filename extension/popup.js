const DEFAULT_API_URL = 'http://localhost:3939/api/listings';

const apiUrlInput = document.getElementById('apiUrl');
const analyzeBtn = document.getElementById('analyzeBtn');
const statusEl = document.getElementById('status');
const analysisCard = document.getElementById('analysisCard');

chrome.storage?.local?.get(['apiUrl'], (result) => {
  apiUrlInput.value = result.apiUrl || DEFAULT_API_URL;
});

apiUrlInput.addEventListener('change', () => {
  chrome.storage?.local?.set({ apiUrl: apiUrlInput.value });
});

function setStatus(msg) {
  statusEl.innerHTML = msg;
}

analyzeBtn.addEventListener('click', async () => {
  analyzeBtn.disabled = true;
  analysisCard.classList.remove('visible');
  setStatus('Extracting job from page...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const jobData = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: 'extract' }, (response) => {
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
    const idea = result.idea;

    document.getElementById('cardPain').textContent = idea.pain_symptom || '(not detected)';
    document.getElementById('cardRoot').textContent = idea.pain_root_cause || '(not detected)';
    document.getElementById('cardPattern').textContent = idea.solution_pattern || '(not detected)';
    document.getElementById('cardPitch').textContent = idea.saas_pitch || '';
    analysisCard.classList.add('visible');

    setStatus('Analysis complete.');
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  }

  analyzeBtn.disabled = false;
});
