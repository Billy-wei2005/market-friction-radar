# Source policy

## Source priority

1. Official APIs and public issue trackers.
2. Public pages explicitly available without authentication.
3. User-authorized imports from private or paid sources.

Reddit collection requires OAuth credentials and a truthful user agent. GitHub collection uses `GITHUB_TOKEN` when present. Product Hunt is excluded from the default commercial workflow because its API documentation restricts commercial use without separate permission.

Crowdfunding totals are commitment signals, not proof of durable demand, successful delivery, or a root problem. Record backer count, funding, comments, delays, refunds, and repeated failure patterns separately when those fields are available.

## Privacy and retention

Collect the minimum text needed to understand the operational friction. Do not store email addresses, real names, profile histories, private-group content, or deleted material unless the user explicitly supplies it for an authorized investigation.

## Failure behavior

If a source blocks access, changes schema, times out, or lacks credentials, record the source as skipped. Never substitute invented records or silently fall back to prohibited scraping.
