# City Route — Four Auditors (proposed v0.1)

The four auditor personas live in `auditors/` and evaluate each new City Route release **from independent perspectives**. They are written as ready-to-use agent instructions, but **are not automatically scheduled or running**.

- **Auditor 01 — Erasmus student in Warsaw for one year:** [auditors/AUDITOR_01_ERASMUS.md](auditors/AUDITOR_01_ERASMUS.md)
- **Auditor 02 — Warsaw resident:** [auditors/AUDITOR_02_RESIDENT.md](auditors/AUDITOR_02_RESIDENT.md)
- **Auditor 03 — 24-hour first-time tourist:** [auditors/AUDITOR_03_24H_TOURIST.md](auditors/AUDITOR_03_24H_TOURIST.md)
- **Auditor 04 — Project operator/stakeholder:** [auditors/AUDITOR_04_OPERATOR.md](auditors/AUDITOR_04_OPERATOR.md)

**Runbook & scoring:** [auditors/README.md](auditors/README.md)  
**Cumulative audit findings & persona changes:** [auditors/AUDIT_LOG.md](auditors/AUDIT_LOG.md)  
**Ranking proposal:** [docs/DISCOVERY_RANKING_V0.1.md](docs/DISCOVERY_RANKING_V0.1.md)

## Invocation
1. Pick the exact PR/commit and determine whether it is live on production.
2. Give each persona its **own independent evaluation**; do not copy the prior auditor's verdict.
3. Gather actual evidence; distinguish a code/spec inspection from an interactive test.
4. Merge the four findings into one prioritized product audit, preserving any conflicting perspectives.
5. Recommend action only under `AGENTS.md` decision/release gates and track outcomes in `AGENT_COORDINATION.md`.

**Product principle:** A tourist's first 24h should preserve Warsaw essentials, while long-stay users, residents and explicit niche search deserve meaningful local discovery. Editorial endorsements explain *why visit*; they never rewrite Google/Tripadvisor star ratings. No arbitrary daily public submission quotas.
