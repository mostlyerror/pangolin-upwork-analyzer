# Upwork Internal GraphQL API

Endpoint: `https://www.upwork.com/api/graphql/v1?alias=mostRecentJobsFeed`

The extension can call this from the content script context (inherits the user's auth cookies).

## Query

```graphql
query($limit: Int, $toTime: String) {
  mostRecentJobsFeed(limit: $limit, toTime: $toTime) {
    results {
      id
      uid: id
      title
      ciphertext
      description
      type
      recno
      freelancersToHire
      duration
      durationLabel
      engagement
      amount {
        amount
      }
      createdOn: createdDateTime
      publishedOn: publishedDateTime
      prefFreelancerLocationMandatory
      connectPrice
      client {
        totalHires
        totalSpent
        paymentVerificationStatus
        location {
          country
        }
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
      jobTs: jobTime
      attrs: skills {
        id
        uid: id
        prettyName: prefLabel
        prefLabel
      }
      hourlyBudget {
        type
        min
        max
      }
      isApplied
      annotations {
        tags
      }
    }
    paging {
      total
      count
      resultSetTs: minTime
      maxTime
    }
  }
}
```

## Variables

- `limit`: number of results (e.g. 10)
- `toTime`: timestamp string for pagination (use `paging.resultSetTs` from previous response)

## Key fields mapped to our schema

| GraphQL field | Our field |
|---|---|
| `title` | listing.title |
| `description` | listing.description |
| `amount.amount` | listing.budget_min (fixed price) |
| `hourlyBudget.min/max` | listing.budget_min/max (hourly) |
| `engagement` | budget_type indicator ("Hourly" vs fixed) |
| `attrs[].prefLabel` | listing.skills |
| `client.totalSpent` | buyer.total_spent |
| `client.totalHires` | buyer.jobs_posted |
| `client.location.country` | buyer.location |
| `client.totalFeedback` | buyer.hire_rate (feedback score) |
| `client.paymentVerificationStatus` | quality signal |
| `ciphertext` | used to build listing URL: `/jobs/~{ciphertext}` |
| `tier` / `tierLabel` | experience level required |
| `proposalsTier` | competition indicator |

## Notes

- Auth is via cookies (user must be logged in on upwork.com)
- Content script can fetch this since it runs on the upwork.com origin
- Much richer data than DOM scraping — includes client verification, feedback score, proposal count tier
- Pagination via `toTime` parameter using `paging.resultSetTs` from previous page
