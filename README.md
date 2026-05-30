# SprintLens

> Engineering team health in one terminal command.

SprintLens answers "where is my team slowing down — and why?" by JOINing data across GitHub, Linear, Sentry, PagerDuty, and Slack using [Coral](https://withcoral.com) — a local cross-source SQL runtime.

It ships two ways:

- **npm CLI** — a TypeScript pipeline that runs Coral queries, performs deterministic analysis, and generates manager reports via the Claude API
- **Claude Code skill** — interactive `sprint:` commands inside Claude Code for ad-hoc questions and schema discovery

What used to take 2 hours of manual work across 5 tools takes 60 seconds.

```
> sprintlens report

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SPRINT HEALTH — Backend · May 31 2026
  Sources: GitHub · Linear · Sentry · PagerDuty
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VELOCITY
Average cycle time is 4.2 days. Alice is at 7.1 days — 69% above
team average. PR review time increased from 8hrs to 19hrs this
sprint, suggesting a review bottleneck on the auth service.

LOAD
Bob has 9 active issues, 4 open PRs, and 8 PagerDuty pages this
month — significantly above team average. Consider redistributing
2-3 issues before next sprint planning.

RISKS
• PR #483 "refactor payment service" — open 9 days, 4 correlated
  Sentry errors. Needs triage today before it escalates.
• PR #491 "update auth middleware" — open 6 days, no reviewers
  assigned. Alice is the likely owner — check her availability.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Queried: GitHub · Linear · Sentry · PagerDuty
2026-05-31 09:00 UTC
```

The same briefing is also available inside Claude Code:

```
> sprint: full report
```

See `examples/manager-report.md`, `examples/employee-dm.md`, and `examples/executive-report.md` for sample output formats.

---

## How it works

SprintLens has no backend, no dashboard, and no login. Everything runs locally on your machine.

**CLI pipeline** (`npx sprintlens report`):

1. Coral connects to your tools (GitHub, Linear, Sentry, PagerDuty, Slack) via their APIs
2. SprintLens reads your `sprintlens.toml` config to map engineer identities
3. Cross-source SQL queries in `src/coral/queries/` retrieve facts from Coral
4. The analysis engine (`src/analysis/`) extracts signals, root causes, and recommendations — deterministically, before any LLM call
5. Claude writes the final manager report from structured findings (`src/llm/`)
6. Output goes to the terminal (Slack and email delivery via `src/delivery/` is supported)

**Claude Code skill** (interactive):

1. Coral connects to your tools (GitHub, Linear, Sentry, PagerDuty, Slack) via their APIs
2. Claude Code reads your `sprintlens.toml` config to map engineer identities
3. Claude Code writes cross-source SQL queries tailored to your actual schema
4. Coral executes the JOINs locally
5. Claude Code formats and explains the results

Your credentials never leave your machine.

---

## Project structure

```
src/
├── commands/     init, doctor, report, dryrun
├── config/       sprintlens.toml loading and validation
├── coral/        Coral CLI integration and SQL queries
├── analysis/     Signal extraction, root causes, recommendations
├── llm/          Claude report generation (writing only)
├── reports/      Manager, employee, and executive report objects
├── delivery/     Slack and email
├── types/        Shared TypeScript interfaces
└── utils/        Logging, dates, formatting

skills/SKILL.md   Claude Code skill definition
examples/         Sample report output
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later (for the CLI)
- [Coral CLI](https://withcoral.com/docs/getting-started/installation) installed
- [Claude Code](https://claude.ai/code) installed (for the skill and interactive `sprint:` commands)
- Accounts/tokens for the tools you want to connect
- An [Anthropic API key](https://console.anthropic.com/) (for `sprintlens report` — optional for `sprintlens dryrun`)

---

## Setup

### 1. Install Coral

**macOS**
```bash
brew install withcoral/tap/coral
```

**Windows (PowerShell as Administrator)**
```powershell
Invoke-WebRequest `
  -Uri "https://github.com/withcoral/coral/releases/latest/download/coral-x86_64-pc-windows-msvc.zip" `
  -OutFile "coral.zip"
Expand-Archive coral.zip -DestinationPath coral -Force
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.local\bin"
Copy-Item coral\coral.exe "$env:USERPROFILE\.local\bin\coral.exe"
[Environment]::SetEnvironmentVariable("Path", "$env:USERPROFILE\.local\bin;$env:Path", "User")
```

**Linux**
```bash
curl -fsSL https://withcoral.com/install.sh | sh
```

Verify:
```bash
coral --version
```

### 2. Connect your sources

Minimum required (GitHub + Linear):
```bash
coral source add --interactive github
coral source add --interactive linear
```

Strongly recommended:
```bash
coral source add --interactive sentry
coral source add --interactive pagerduty
```

Optional:
```bash
coral source add --interactive slack
```

### 3. Register Coral with Claude Code

```bash
claude mcp add --scope user coral -- coral mcp-stdio
```

### 4. Install SprintLens

**CLI (from this repo):**
```bash
git clone <repo-url> sprintlens
cd sprintlens
npm install
npm run build
```

Or link globally after building:
```bash
npm link
```

**Claude Code skill:**
```bash
npx skills add sprintlens
```

### 5. Create your config file

Copy the example and fill in your team details:

```bash
cp sprintlens.toml.example sprintlens.toml
```

Or use the CLI:
```bash
npx sprintlens init
```

Edit `sprintlens.toml`:

```toml
[team]
name              = "Backend"
github_org        = "your-org"
github_repo       = "your-repo"
linear_team       = "Backend"
sentry_org        = "your-sentry-org"
pagerduty_service = "backend-api"
slack_channel     = "eng-backend"

[engineers]
alice = { github = "alice-dev", email = "alice@company.com", slack = "Alice" }
bob   = { github = "bobsmith",  email = "bob@company.com",   slack = "Bob S" }

# Required for --email commands (edit before use)
[delivery]
manager_email = "eng-manager@company.com"

[delivery.smtp]
host   = "smtp.gmail.com"
port   = 587
secure = false
from   = "SprintLens <reports@company.com>"
```

Set SMTP credentials before emailing reports:
```bash
export SPRINTLENS_SMTP_USER=your-smtp-user
export SPRINTLENS_SMTP_PASS=your-smtp-password
```

### 6. Verify everything

```bash
coral source list
coral sql "SELECT schema_name, table_name FROM coral.tables ORDER BY 1, 2"
npx sprintlens doctor
```

---

## Usage

### CLI commands

Run from the directory containing your `sprintlens.toml`:

| Command | What you get |
|---|---|
| `npx sprintlens init` | Create `sprintlens.toml` from the example file |
| `npx sprintlens doctor` | Verify config, Coral CLI, and connected sources |
| `npx sprintlens report` | Full pipeline — Coral queries, analysis, Claude report |
| `npx sprintlens report --email` | Email manager report to `[delivery] manager_email` |
| `npx sprintlens digest --email` | Email each engineer their digest (uses `[engineers]` emails) |
| `npx sprintlens dryrun` | Coral queries + deterministic analysis only (no LLM) |

For prose reports, set your Anthropic API key:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
npx sprintlens report
```

For email delivery, edit `[delivery]` and `[delivery.smtp]` in `sprintlens.toml`, then:
```bash
export SPRINTLENS_SMTP_USER=...
export SPRINTLENS_SMTP_PASS=...
npx sprintlens report --email
npx sprintlens digest --email
```

Without an API key, `sprintlens report` outputs structured JSON (signals, root causes, recommendations).

### Claude Code skill commands

Open Claude Code in the directory containing your `sprintlens.toml` and type:

| Command | What you get |
|---|---|
| `sprint: full report` | Weekly briefing — velocity, load, and risks combined |
| `sprint: velocity` | Cycle time and PR review time by engineer |
| `sprint: load` | Who has too much active work right now |
| `sprint: risks` | Open PRs most likely to cause incidents |
| `sprint: dora` | DORA metrics computed from your actual data |
| `sprint: why is [name] slow` | Focused analysis on one engineer |
| `sprint: who should review [PR]` | Best available reviewer by capacity |

You can also ask in plain English:
- "why is the backend team slower this sprint?"
- "who has the most open work right now?"
- "are any PRs about to cause incidents?"

---

## Sources and what they contribute

| Source | Required | What it adds |
|---|---|---|
| `github` | Yes | PRs, review time, deployment frequency |
| `linear` | Yes | Cycle time, active issues, team velocity |
| `sentry` | Recommended | Error rates, change failure rate signal |
| `pagerduty` | Recommended | On-call load, MTTR, incidents |
| `slack` | Optional | Discussion activity, PR mentions |

SprintLens works with only GitHub + Linear connected. Each additional source adds more signal to the diagnosis.

---

## Token requirements

| Source | Token needed | Where to get it |
|---|---|---|
| GitHub | Personal access token (`read:repo`, `read:org`) | github.com/settings/tokens |
| Linear | Personal API key (Read) | linear.app/settings/api |
| Sentry | Internal integration token | sentry.io → Settings → Auth Tokens |
| PagerDuty | Read-only General Access REST API key | pagerduty.com → API Access |
| Slack | Bot token with `channels:read`, `channels:history`, `users:read` | api.slack.com/apps |

---

## Privacy

- All queries execute locally via Coral
- No data is sent to any SprintLens server (there is no server)
- Credentials are stored locally by Coral in OS credential storage
- Claude Code processes results locally
- The CLI sends only structured findings (signals, root causes, recommendations) to the Anthropic API for report writing — never raw Coral rows
- The only network calls are from Coral to the tool APIs you connected, plus Anthropic when running `sprintlens report`

---

## DORA metric benchmarks

| Metric | Elite | High | Medium | Low |
|---|---|---|---|---|
| Deployment Frequency | Multiple/day | Daily | Weekly | Monthly |
| Lead Time | < 1 hour | < 1 day | < 1 week | > 1 week |
| Change Failure Rate | < 5% | < 10% | < 15% | > 15% |
| MTTR | < 1 hour | < 1 day | < 1 week | > 1 week |

Source: [DORA State of DevOps Report](https://dora.dev)

The CLI computes DORA metrics from Coral data in `src/coral/queries/dora.sql` and classifies tiers in the analysis layer. The `sprint: dora` skill command provides the same metrics interactively inside Claude Code.

---

## Built with

- [Coral](https://withcoral.com) — cross-source SQL runtime
- [Claude Code](https://claude.ai/code) — AI coding agent
- [Claude API](https://anthropic.com) — report writing from structured findings
- TypeScript + Node.js — CLI and deterministic analysis engine
- Coral Hackathon 2026
