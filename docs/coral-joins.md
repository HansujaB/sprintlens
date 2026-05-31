# SprintLens — How the SQL JOINs Work

SprintLens uses [Coral](https://withcoral.com) to issue cross-source SQL queries that JOIN live data from GitHub, Linear, Sentry, and PagerDuty in a single statement. This page explains every JOIN — source tables, conditions, and output columns — so you know exactly what data each report is built on.

---

## Why Coral makes this possible

Without Coral you'd need four separate API clients, each with its own auth, pagination, and retry logic. Then you'd stitch the results together in application code.

Coral gives SprintLens **one SQL interface** over all sources simultaneously:

```mermaid
graph LR
    CLI["sprintlens report\nsprintlens dora\nsprintlens dryrun"]

    CLI -->|"SQL string via\ncoral sql '...'"| CORAL

    subgraph CORAL["Coral — local SQL runtime"]
        direction TB
        PARSE["SQL parser\n+ query planner"]
        EXEC["Parallel source\nexecution"]
        PARSE --> EXEC
    end

    EXEC -->|"base_repo_owner filter\ngithub_org from toml"| GH
    EXEC -->|"team_name filter\nlinear_team from toml"| LIN
    EXEC -->|"org filter\n(if connected)"| SEN
    EXEC -->|"service filter\n(if connected)"| PD

    GH["GitHub API\n──────────────\ngithub.pull_requests\ngithub.issues"]
    LIN["Linear API\n──────────────\nlinear.issues\nlinear.teams"]
    SEN["Sentry API\n──────────────\nsentry.issues"]
    PD["PagerDuty API\n──────────────\npagerduty.incidents"]

    CORAL -->|"JSON rows"| SL["SprintLens\nfact formatters\n→ LLM prompt"]

    classDef source fill:#1e3a5f,stroke:#60a5fa,color:#dbeafe
    classDef coral fill:#4c1d95,stroke:#a78bfa,color:#ede9fe
    classDef sl fill:#064e3b,stroke:#34d399,color:#d1fae5
    class GH,LIN,SEN,PD source
    class CORAL,PARSE,EXEC coral
    class SL sl
```

> **Benchmark:** Claude with Coral was **20% more accurate, 2× more cost-efficient, and 42% lower latency** than using direct provider MCPs — because it issues one structured query instead of many tool calls. For multi-hop tasks like SprintLens's cross-source JOINs, accuracy jumped to **31% higher** with **3.4× better cost efficiency**.

---

## Query 1 — velocity.sql

Measures how fast each engineer moves work from creation to merge.

**Join:** `linear.issues` LEFT JOIN `github.pull_requests`  
**Bridge column:** `linear.issues.assignee_email = github.pull_requests.author`

```mermaid
erDiagram
    linear_issues {
        string assignee_email PK
        string team_name
        datetime created_at
        datetime completed_at
        string state
    }

    github_pull_requests {
        string author PK
        string base_repo_owner
        string base_repo_name
        string base_branch
        datetime merged_at
        datetime reviewed_at
        boolean merged
    }

    velocity_output {
        string engineer
        int issues_completed_30d
        float avg_cycle_days
        int prs_merged_30d
        float avg_pr_review_hrs
    }

    linear_issues ||--o{ github_pull_requests : "LEFT JOIN ON assignee_email = author AND merged_at > NOW()-30d"
    linear_issues ||--|| velocity_output : "GROUP BY assignee_email"
    github_pull_requests ||--|| velocity_output : "AVG cycle + review time"
```

**The LEFT JOIN matters:** engineers who completed Linear issues but had **zero** merged PRs in the window still appear — they're the most likely candidates for blockers or review delays. An INNER JOIN would silently drop them.

**Key filter applied:** `linear.issues.team_name = '{linear_team}'` — scoped to your team only.

---

## Query 2 — load.sql

Measures concurrent workload per engineer across all four sources.

**Joins:** `linear.issues` LEFT JOIN `github.pull_requests` LEFT JOIN `sentry.issues` LEFT JOIN `pagerduty.incidents`

```mermaid
flowchart LR
    E["Engineer email\nfrom config"]

    E -->|"assignee_email IN\n(alice, bob, ...)"| LI

    LI["linear.issues\nstate = in_progress\n── active_linear_issues"]

    LI -->|"LEFT JOIN\nopen_prs\nassignee_email = author"| PR

    PR["github.pull_requests\nstate = open\n── open_prs"]

    PR -->|"LEFT JOIN\nassignee_email = assigned_to\nsentry (if connected)"| SE

    SE["sentry.issues\nstatus = unresolved\n── unresolved_sentry_errors"]

    SE -->|"LEFT JOIN\nassignee_email = resolved_by\npagerduty (if connected)"| PD

    PD["pagerduty.incidents\nstatus = triggered\ncreated_at > NOW()-30d\n── pagerduty_incidents_30d"]

    PD --> OUT

    OUT["Output per engineer:\nengineer\nactive_linear_issues\nopen_prs\nunresolved_sentry_errors\npagerduty_incidents_30d\nload_score (weighted)"]

    classDef src fill:#1e3a5f,stroke:#60a5fa,color:#dbeafe
    classDef out fill:#064e3b,stroke:#34d399,color:#d1fae5
    class LI,PR,SE,PD src
    class OUT out
```

**load_score** is a pre-computed weighted signal: `(active_issues × 2) + (open_prs × 1) + (sentry × 1) + (pagerduty × 3)`. It's passed to the LLM alongside the raw counts so Claude can validate its severity ranking against a pre-ranked value.

**Sentry and PagerDuty are optional.** Both joins are `LEFT JOIN` — if those sources are missing, their columns return `NULL`, which `rowToLoad()` coerces to `0`.

---

## Query 3 — risks.sql

Finds stale PRs and cross-correlates them with production signals.

**Join:** `github.pull_requests` LEFT JOIN `sentry.issues` LEFT JOIN `pagerduty.incidents`  
**Bridge:** title similarity + overlapping date ranges

```mermaid
flowchart TD
    PR["github.pull_requests\nbase_repo_owner = github_org\nbase_repo_name = github_repo\ndraft = false\nmerged_at IS NULL\ncreated_at < NOW() - 3 days\n─────────────────\npr_number · title · author\ndays_open"]

    SE["sentry.issues\nfirst_seen > pr.created_at\n─────────────────\nMatched by:\ntitle ILIKE '%' || pr.title || '%'"]

    PD["pagerduty.incidents\ncreated_at BETWEEN\n  pr.created_at AND NOW()\n─────────────────\nMatched by:\ntitle similarity + date range"]

    PR -->|"LEFT JOIN"| SE
    PR -->|"LEFT JOIN"| PD

    SE --> AGG
    PD --> AGG

    AGG["Aggregation per PR:\nCOUNT(sentry) → related_sentry_errors\nCOUNT(pagerduty) → related_incidents\nweighted risk_score"]

    AGG --> OUT["Output rows — ordered by risk_score DESC:\npull_request · author · pr_number\ndays_open · related_sentry_errors\nrelated_incidents · risk_score"]

    classDef src fill:#1e3a5f,stroke:#60a5fa,color:#dbeafe
    classDef out fill:#064e3b,stroke:#34d399,color:#d1fae5
    class PR,SE,PD src
    class OUT,AGG out
```

**risk_score** = `(days_open × 2) + (sentry_errors × 3) + (incidents × 5)`. The SQL pre-ranks PRs by risk before the results reach the LLM — Claude uses this as a signal for what to flag first.

**No false positives:** Sentry and PagerDuty matches require both title similarity AND a date window that starts after the PR was created — preventing spurious correlations from pre-existing errors.

---

## Query 4 — DORA (4 conditional fragments)

DORA is assembled dynamically from **4 separate SQL fragments** — PagerDuty-dependent metrics are only included when PagerDuty is connected.

```mermaid
flowchart TD
    SRC["connectedSources\nfrom discoverSources()"]

    SRC --> DF["dora-deployment-frequency.sql\ngithub.pull_requests\nbase_branch IN (main, master)\nmerged_at > NOW() - 28d\n──────────────────\nvalue = COUNT(*) / 4.0\nunit = deploys/week\nmeasurement_type = proxy_pr_merges"]

    SRC --> LT["dora-lead-time.sql\nlinear.issues JOIN github.pull_requests\nON pr.author = i.assignee_email\n──────────────────\nvalue = AVG(merged_at - created_at)\nunit = hours\nmeasurement_type = linear_created_to_pr_merged"]

    SRC -->|"Only if pagerduty\nin connectedSources"| CFR["dora-cfr.sql\ngithub.pull_requests\nLEFT JOIN pagerduty.incidents\nON incident.created_at BETWEEN\n  pr.merged_at AND pr.merged_at + 48h\n──────────────────\nvalue = 100 * COUNT(incidents) / COUNT(prs)\nunit = percent"]

    SRC -->|"Only if pagerduty\nin connectedSources"| MTTR["dora-mttr.sql\npagerduty.incidents\nstatus = resolved\n──────────────────\nvalue = AVG(resolved_at - created_at)\nunit = hours"]

    DF & LT & CFR & MTTR -->|"UNION ALL\nassembled in TypeScript"| DORA_OUT["Single SQL string\nexecuted via coral sql\n────────────────────────\n4 rows (or 2 without PagerDuty)\nOne row per metric"]

    DORA_OUT --> TIER["extractDoraSignals()\nDORA State of DevOps tiers:\nelite · high · medium · low\nDeterministic — no LLM"]

    classDef src fill:#1e3a5f,stroke:#60a5fa,color:#dbeafe
    classDef out fill:#064e3b,stroke:#34d399,color:#d1fae5
    classDef pd fill:#7c2d12,stroke:#fb923c,color:#ffedd5
    class DF,LT src
    class CFR,MTTR pd
    class DORA_OUT,TIER out
```

**Why fragments?** The old monolithic `dora.sql` unconditionally queried `pagerduty.incidents` — meaning `sprintlens dora` always crashed if PagerDuty wasn't connected. Now `runDoraQuery()` assembles the UNION at runtime based on `sourceStatus.connected`.

---

## Identity bridging

The hardest part of cross-source JOINs is that the same person has different identifiers in each tool:

| Source | Identifier |
|--------|-----------|
| GitHub | `author` (login handle) |
| Linear | `assignee_email` |
| Sentry | `assigned_to` (email) |
| PagerDuty | `resolved_by` (email) |

SprintLens resolves this through `sprintlens.toml`:

```toml
[engineers.alice]
github = "alice-codes"      # GitHub login
email  = "alice@company.com" # canonical bridge key
slack  = "U012AB3CD"         # optional
```

The `getEngineerEmails()` function extracts the email list, which becomes the `{engineer_emails}` substitution in every SQL query (`WHERE assignee_email IN (...)`). Email is the canonical bridge key across all four sources.

---

## What the LLM actually sees

After all queries run, `formatVelocityFacts`, `formatWorkloadFacts`, `formatBottleneckFacts`, and `formatRiskFacts` compute relative metrics (deviation %, load index, concentration %) and pass a structured JSON prompt to Claude. Claude never writes SQL or sees raw API responses — it reasons over pre-aggregated, normalized facts.

```mermaid
flowchart LR
    Q1["velocity.sql\nrows"] & Q2["load.sql\nrows"] & Q3["risks.sql\nrows"] & Q4["dora-*.sql\nrows"] --> FF

    FF["Fact Formatters\n──────────────────\nteamAvgCycleDays\ncycleDeviationPct per engineer\nloadIndexVsTeam per engineer\nprConcentration %\nhasCorrelatedSignals per PR\nDORA tier per metric"]

    FF --> PROMPT["LLM Prompt\n~2000 tokens\nstructured JSON"]

    PROMPT --> CLAUDE["Claude claude-sonnet-4\n──────────────────\nAnalyzeWithLLM():\n• signals\n• rootCauses\n• recommendations"]

    CLAUDE --> REPORT["Formatted report\nfor terminal or email"]

    classDef src fill:#1e3a5f,stroke:#60a5fa,color:#dbeafe
    classDef out fill:#064e3b,stroke:#34d399,color:#d1fae5
    classDef api fill:#4c1d95,stroke:#a78bfa,color:#ede9fe
    class Q1,Q2,Q3,Q4 src
    class FF,PROMPT out
    class CLAUDE,REPORT api
```
