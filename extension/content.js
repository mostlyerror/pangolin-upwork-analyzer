// Pangolin content script — reads Upwork listing data from the DOM
// Runs on search/feed pages, extracts visible listing cards

function extractListings() {
  const listings = [];

  // Upwork search result cards — selectors may need updating as Upwork changes their DOM
  const cards = document.querySelectorAll('[data-test="job-tile-list"] section, .job-tile');

  for (const card of cards) {
    const titleEl = card.querySelector('a[data-test="job-tile-title-link"], h2 a, .job-tile-title a');
    const descEl = card.querySelector('[data-test="job-description-text"], .job-description, [data-test="UpCLineClamp JobDescription"]');
    const budgetEl = card.querySelector('[data-test="budget"], [data-test="is-fixed-price"], .budget');
    const skillEls = card.querySelectorAll('[data-test="token"] span, .skill-name, [data-test="attr-item"]');
    const clientNameEl = card.querySelector('[data-test="client-name"], .client-name');
    const clientSpentEl = card.querySelector('[data-test="total-spent"], .client-spendings');
    const clientLocationEl = card.querySelector('[data-test="client-country"], .client-location');
    const postedEl = card.querySelector('[data-test="posted-on"], .job-posted-on, time');

    const title = titleEl?.textContent?.trim();
    if (!title) continue; // skip empty cards

    const url = titleEl?.getAttribute('href');

    const listing = {
      title,
      url: url ? `https://www.upwork.com${url}` : undefined,
      description: descEl?.textContent?.trim() || undefined,
      skills: [...skillEls].map(el => el.textContent?.trim()).filter(Boolean),
      postedAt: postedEl?.getAttribute('datetime') || postedEl?.textContent?.trim() || undefined,
      client: {
        name: clientNameEl?.textContent?.trim() || undefined,
        totalSpent: clientSpentEl?.textContent?.trim() || undefined,
        location: clientLocationEl?.textContent?.trim() || undefined,
      },
    };

    // Parse budget
    const budgetText = budgetEl?.textContent?.trim();
    if (budgetText) {
      if (budgetText.toLowerCase().includes('hourly')) {
        listing.budgetType = 'hourly';
        const nums = budgetText.match(/\$[\d,.]+/g);
        if (nums && nums.length >= 2) {
          listing.budgetMin = parseFloat(nums[0].replace(/[$,]/g, ''));
          listing.budgetMax = parseFloat(nums[1].replace(/[$,]/g, ''));
        }
      } else {
        listing.budgetType = 'fixed';
        const nums = budgetText.match(/\$[\d,.]+/g);
        if (nums) {
          listing.budgetMin = parseFloat(nums[0].replace(/[$,]/g, ''));
          listing.budgetMax = nums[1] ? parseFloat(nums[1].replace(/[$,]/g, '')) : listing.budgetMin;
        }
      }
    }

    listings.push(listing);
  }

  return listings;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'extract') {
    const listings = extractListings();
    sendResponse({ listings, count: listings.length });
  }
  return true; // keep channel open for async response
});
