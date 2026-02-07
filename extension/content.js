// Pangolin content script — extracts Upwork listings via their internal GraphQL API
// Runs on Upwork pages, uses the logged-in user's session cookies

const GRAPHQL_URL = 'https://www.upwork.com/api/graphql/v1?alias=mostRecentJobsFeed';

const QUERY = `query($limit: Int, $toTime: String) {
  mostRecentJobsFeed(limit: $limit, toTime: $toTime) {
    results {
      id
      title
      ciphertext
      description
      type
      freelancersToHire
      duration
      durationLabel
      engagement
      amount { amount }
      createdOn: createdDateTime
      publishedOn: publishedDateTime
      connectPrice
      client {
        totalHires
        totalSpent
        paymentVerificationStatus
        location { country }
        totalReviews
        totalFeedback
        hasFinancialPrivacy
      }
      tierText
      tier
      tierLabel
      proposalsTier
      enterpriseJob
      premium
      attrs: skills {
        prettyName: prefLabel
      }
      hourlyBudget {
        type
        min
        max
      }
    }
    paging {
      total
      count
      resultSetTs: minTime
      maxTime
    }
  }
}`;

async function fetchListingsFromAPI(limit = 50) {
  const allListings = [];
  let toTime = null;
  let pages = 0;
  const maxPages = 5; // safety limit: 5 pages × 50 = 250 listings max

  while (pages < maxPages) {
    const variables = { limit };
    if (toTime) variables.toTime = toTime;

    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // sends cookies for auth
      body: JSON.stringify({ query: QUERY, variables }),
    });

    if (!res.ok) {
      throw new Error(`Upwork API returned ${res.status}`);
    }

    const data = await res.json();
    const feed = data?.data?.mostRecentJobsFeed;
    if (!feed || !feed.results || feed.results.length === 0) break;

    for (const job of feed.results) {
      allListings.push(mapJobToListing(job));
    }

    // Pagination
    toTime = feed.paging?.resultSetTs;
    if (!toTime || feed.results.length < limit) break;
    pages++;
  }

  return allListings;
}

function mapJobToListing(job) {
  const isHourly = job.hourlyBudget != null;

  return {
    title: job.title,
    url: job.ciphertext ? `https://www.upwork.com/jobs/~${job.ciphertext}` : undefined,
    description: job.description || undefined,
    budgetType: isHourly ? 'hourly' : 'fixed',
    budgetMin: isHourly ? job.hourlyBudget?.min : job.amount?.amount,
    budgetMax: isHourly ? job.hourlyBudget?.max : job.amount?.amount,
    skills: (job.attrs || []).map(a => a.prettyName).filter(Boolean),
    postedAt: job.createdOn || job.publishedOn || undefined,
    client: {
      name: undefined, // not available in feed
      totalSpent: job.client?.totalSpent != null ? `$${Number(job.client.totalSpent).toLocaleString()}` : undefined,
      jobsPosted: job.client?.totalHires || undefined,
      hireRate: job.client?.totalFeedback || undefined,
      location: job.client?.location?.country || undefined,
      profileUrl: undefined, // not available in feed
    },
    // Extra fields we can use
    _meta: {
      upworkId: job.id,
      tier: job.tierLabel || job.tierText,
      proposalsTier: job.proposalsTier,
      duration: job.durationLabel,
      connectPrice: job.connectPrice,
      paymentVerified: job.client?.paymentVerificationStatus === 'VERIFIED',
      enterprise: job.enterpriseJob,
      premium: job.premium,
    },
  };
}

// Fallback: DOM scraping for pages where the GraphQL API doesn't apply
function extractListingsFromDOM() {
  const listings = [];
  const cards = document.querySelectorAll('[data-test="job-tile-list"] section, .job-tile');

  for (const card of cards) {
    const titleEl = card.querySelector('a[data-test="job-tile-title-link"], h2 a, .job-tile-title a');
    const descEl = card.querySelector('[data-test="job-description-text"], .job-description');
    const budgetEl = card.querySelector('[data-test="budget"], [data-test="is-fixed-price"], .budget');
    const skillEls = card.querySelectorAll('[data-test="token"] span, .skill-name');
    const clientSpentEl = card.querySelector('[data-test="total-spent"], .client-spendings');
    const clientLocationEl = card.querySelector('[data-test="client-country"], .client-location');

    const title = titleEl?.textContent?.trim();
    if (!title) continue;

    const url = titleEl?.getAttribute('href');

    const listing = {
      title,
      url: url ? `https://www.upwork.com${url}` : undefined,
      description: descEl?.textContent?.trim() || undefined,
      skills: [...skillEls].map(el => el.textContent?.trim()).filter(Boolean),
      client: {
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
    // Try GraphQL API first, fall back to DOM scraping
    fetchListingsFromAPI(msg.limit || 50)
      .then(listings => {
        if (listings.length > 0) {
          sendResponse({ listings, count: listings.length, source: 'api' });
        } else {
          // Fallback to DOM
          const domListings = extractListingsFromDOM();
          sendResponse({ listings: domListings, count: domListings.length, source: 'dom' });
        }
      })
      .catch(err => {
        // Fallback to DOM on API error
        const domListings = extractListingsFromDOM();
        sendResponse({
          listings: domListings,
          count: domListings.length,
          source: 'dom',
          apiError: err.message,
        });
      });

    return true; // keep channel open for async response
  }
});
