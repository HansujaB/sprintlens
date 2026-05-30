# Manager Report Example

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SPRINT HEALTH — Backend
  May 31, 2026 · Last 30 days
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SUMMARY
Average cycle time is 4.2 days. PR review latency increased from 8hrs to
19hrs this sprint. One stale PR has correlated Sentry errors and needs
triage today.

VELOCITY
Average cycle time is 4.2 days. Alice is at 7.1 days — 69% above team
average. PR review time increased from 8hrs to 19hrs this sprint,
suggesting a review bottleneck on the auth service.

LOAD
Bob has 9 active issues, 4 open PRs, and 8 PagerDuty pages this month —
significantly above team average. Consider redistributing 2-3 issues before
next sprint planning.

ROOT CAUSES
• Review bottleneck — review latency elevated, ownership concentrated
• Incident interference — high on-call load correlates with slower cycle time

RECOMMENDED ACTIONS
• Redistribute payment-service review ownership from Bob to Priya
• Move 2 active Linear issues from Bob to James before next sprint

RISKS
• PR #483 "refactor payment service" — open 9 days, 4 correlated Sentry
  errors. Needs triage today before it escalates.
• PR #491 "update auth middleware" — open 6 days, no reviewers assigned.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sources: GitHub · Linear · Sentry · PagerDuty
Missing: Slack
```
