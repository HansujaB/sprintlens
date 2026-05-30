# SprintLens

> Engineering team health in one terminal command.

SprintLens is a Claude Code skill that answers "where is my team slowing down — and why?" by JOINing data across GitHub, Linear, Sentry, PagerDuty, and Slack using [Coral](https://withcoral.com) — a local cross-source SQL runtime.

What used to take 2 hours of manual work across 5 tools takes 60 seconds.

```
> sprint: full report

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

---

## How it works

SprintLens is a Claude Code skill. It has no backend, no dashboard, no login. Everything runs locally on your machine:

1. Coral connects to your tools (GitHub, Linear, Sentry, PagerDuty, Slack) via their APIs
2. Claude Code reads your `sprintlens.toml` config to map engineer identities
3. Claude Code writes cross-source SQL queries tailored to your actual schema
4. Coral executes the JOINs locally
5. Claude Code formats and explains the results

Your credentials never leave your machine.

---

## Prerequisites

- [Coral CLI](https://withcoral.com/docs/getting-started/installation) installed
- [Claude Code](https://claude.ai/code) installed
- Accounts/tokens for the tools you want to connect

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

### 4. Install SprintLens skill

```bash
npx skills add sprintlens
```

### 5. Create your config file

Copy the example and fill in your team details:

```bash
cp sprintlens.toml.example sprintlens.toml
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
```

### 6. Verify everything

```bash
coral source list
coral sql "SELECT schema_name, table_name FROM coral.tables ORDER BY 1, 2"
```

---

## Usage

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
- The only network calls are from Coral to the tool APIs you connected

---

## DORA metric benchmarks

| Metric | Elite | High | Medium | Low |
|---|---|---|---|---|
| Deployment Frequency | Multiple/day | Daily | Weekly | Monthly |
| Lead Time | < 1 hour | < 1 day | < 1 week | > 1 week |
| Change Failure Rate | < 5% | < 10% | < 15% | > 15% |
| MTTR | < 1 hour | < 1 day | < 1 week | > 1 week |

Source: [DORA State of DevOps Report](https://dora.dev)

---

## Built with

- [Coral](https://withcoral.com) — cross-source SQL runtime
- [Claude Code](https://claude.ai/code) — AI coding agent
- Coral Hackathon 2025
