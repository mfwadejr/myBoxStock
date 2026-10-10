# Host documentation check list (W2, v0.25.0)

Every page in content/docs/host was checked against the code on the v25-dh branch (all v0.22.0 to v0.25.0 features merged). Screenshots are named in tools/docs-shots/manifest-host.mjs; the `![...](shot:NAME "caption")` lines are added to the pages by `node tools/docs-shots/insert-host-shots.mjs` once the docs renderer and docs test accept images. File numbers 01 to 25 and order values 1 to 25 are all unique.

| File | Title | Order | Screenshots (planned names, laptop and phone) | Verified against |
|---|---|---|---|---|
| 01-getting-started.md | Getting started | 1 | none (reference or sensitive page) | v0.25.0 |
| 02-overview.md | Overview | 2 | host-overview | v0.25.0 |
| 03-accounts.md | Accounts | 3 | host-accounts, host-accounts-2, host-accounts-3 | v0.25.0 |
| 04-pipeline.md | Pipeline | 4 | host-pipeline | v0.25.0 |
| 05-onboarding.md | Onboarding | 5 | host-onboarding | v0.25.0 |
| 06-plans.md | Plans | 6 | host-plans | v0.25.0 |
| 07-backups.md | Backups | 7 | host-backups | v0.25.0 |
| 08-email.md | Email | 8 | host-email, host-email-2 | v0.25.0 |
| 09-alerts.md | Alerts | 9 | host-alerts | v0.25.0 |
| 10-firewall.md | Firewall | 10 | host-firewall | v0.25.0 |
| 11-security.md | Security | 11 | none (reference or sensitive page) | v0.25.0 |
| 12-settings.md | Settings | 12 | host-settings | v0.25.0 |
| 13-logs.md | Logs | 13 | host-logs | v0.25.0 |
| 14-audit-trail.md | Audit trail | 14 | host-audit | v0.25.0 |
| 15-updates.md | Updates | 15 | host-updates | v0.25.0 |
| 16-recovery-and-emergencies.md | Recovery and emergencies | 16 | none (reference or sensitive page) | v0.25.0 |
| 17-running-the-server.md | Running the server | 17 | none (reference or sensitive page) | v0.25.0 |
| 18-troubleshooting-faq.md | Troubleshooting and FAQ | 18 | none (reference or sensitive page) | v0.25.0 |
| 19-glossary.md | Glossary | 19 | none (reference or sensitive page) | v0.25.0 |
| 20-support-and-diagnostics.md | Support and diagnostics | 20 | none (reference or sensitive page) | v0.25.0 |
| 21-disaster-recovery.md | Disaster recovery | 21 | none (reference or sensitive page) | v0.25.0 |
| 22-support-tickets.md | Support tickets | 22 | host-support | v0.25.0 |
| 23-data-and-retention.md | Data and retention | 23 | host-retention | v0.25.0 |
| 24-demo-mode.md | Demo mode | 24 | host-demo, host-demo-2 | v0.25.0 |
| 25-accessibility.md | Accessibility | 25 | none (reference or sensitive page) | v0.25.0 |

Changes this sweep: Overview gained "What you can and cannot see here"; Demo mode gained "How big accounts behave" (T49 figures). Pages left without images: Getting started, Security (shows keys), Recovery and emergencies, Running the server, Troubleshooting and FAQ, Glossary, Support and diagnostics, Disaster recovery, Accessibility (reference or runbook pages).
