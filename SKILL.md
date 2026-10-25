---
name: market-friction-radar
description: Scan public communities, issue trackers, crowdfunding discovery pages, and product feedback for commercial friction signals; separate evidence from speculation; generate explicitly hypothetical Wild Concepts; and produce auditable weekly Excel reports. Use for market pain discovery, opportunity-signal monitoring, community scanning, or scheduled idea digests. Do not present popularity as proof of a validated problem or business opportunity.
---

# Market Friction Radar

Run a high-recall commercial-signal pipeline while keeping observations, inferred pain clusters, and creative concepts in separate layers.

## Route the work

1. Collect raw public signals into `data/01-raw-signals/`. Preserve source URL, timestamp, visible engagement, source type, and exact excerpt.
2. Cluster related signals in `data/02-pain-clusters/`. Treat every cluster as provisional until independently verified.
3. Generate Wild Concepts only into `data/03-wild-concepts/`. Prefix them with `[创意假设]`; never write them back into evidence fields.
4. Export the weekly workbook to `outputs/YYYY-MM-DD/` and email it only when the user has authorized a recipient and delivery credentials are configured.

For collection rules and source limitations, read [references/source-policy.md](references/source-policy.md). For the workbook and concept schemas, read [references/schemas.md](references/schemas.md).

## Non-negotiable rules

- Use official APIs where available and obey platform terms, authentication, attribution, and rate limits.
- Do not evade login, robots controls, paywalls, or anti-automation measures.
- Never infer demand solely from likes, votes, comments, or crowdfunding totals.
- Keep source observations verbatim enough to audit, but minimize personal data and never collect private communities without explicit authorization.
- Mark unavailable sources as skipped with a reason. Do not fabricate results to fill the report.
- Email credentials, API keys, recipients, and tokens belong in environment variables or GitHub Secrets, never in files or logs.
- A scheduled run may collect and report automatically; any new outbound destination or change in recipient still requires user authorization.

## Default execution

Run `npm run radar`. Without `OPENAI_API_KEY`, collection and Excel export still complete and the concept sheet records that automated ideation was skipped. Without SMTP settings, the report remains in the output folder and delivery is recorded as skipped.
