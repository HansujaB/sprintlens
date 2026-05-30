# Executive Report Example

```
ENGINEERING HEALTH — Backend · May 31, 2026

DELIVERY CONFIDENCE: Medium

VELOCITY TREND
Cycle time rose 18% vs last 30 days. Lead time for changes is 52 hours
(High tier). Deployment frequency proxy: 6.2 PR merges/week to main.

ENGINEERING RISK
Two stale PRs carry correlated production errors. Review bottleneck is
slowing auth-service work. On-call load is elevated for 2 engineers.

TOP ROOT CAUSES
1. Review bottleneck — elevated review latency, concentrated ownership
2. Incident interference — paging load correlates with delivery slowdown

RECOMMENDED ACTIONS
• Redistribute review ownership on auth and payment services
• Triage PR #483 before it escalates to an incident

DORA SUMMARY
Deployment Frequency   6.2/week     High (proxy)
Lead Time              52 hrs       High
Change Failure Rate    8.1%         High
MTTR                   4.2 hrs      Elite

Sources: GitHub · Linear · Sentry · PagerDuty
```
