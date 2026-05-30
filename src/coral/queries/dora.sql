-- SprintLens: DORA Metrics Query
-- Computes all four DORA metrics from available sources.
-- Each metric is clearly labeled as real or proxy measurement.
--
-- Replace {github_org}, {github_repo}, {linear_team} from sprintlens.toml
-- PagerDuty metrics require pagerduty source to be connected.

-- ─────────────────────────────────────────────
-- METRIC 1: Deployment Frequency
-- Proxy: PR merges to main per week (real deployments need GitHub Actions data)
-- ─────────────────────────────────────────────
SELECT
  'deployment_frequency'                                AS metric,
  'proxy_pr_merges'                                     AS measurement_type,
  ROUND(COUNT(*) / 4.0, 1)                             AS value_per_week,
  'deploys/week'                                        AS unit
FROM github.pull_requests
WHERE base_repo_owner   = '{github_org}'
  AND base_repo_name    = '{github_repo}'
  AND base_branch       IN ('main', 'master')
  AND merged_at         IS NOT NULL
  AND merged_at         > NOW() - INTERVAL '28 days'

UNION ALL

-- ─────────────────────────────────────────────
-- METRIC 2: Lead Time for Changes
-- Real: Linear issue created → GitHub PR merged
-- ─────────────────────────────────────────────
SELECT
  'lead_time_for_changes'                               AS metric,
  'linear_created_to_pr_merged'                         AS measurement_type,
  ROUND(
    AVG(DATEDIFF('hour', i.created_at, pr.merged_at))
  , 0)                                                  AS value_per_week,
  'hours'                                               AS unit
FROM linear.issues i
JOIN github.pull_requests pr
  ON pr.author      = i.assignee_email
  AND pr.merged_at  IS NOT NULL
  AND pr.merged_at  > NOW() - INTERVAL '28 days'
WHERE i.team_name   = '{linear_team}'
  AND i.completed_at > NOW() - INTERVAL '28 days'

UNION ALL

-- ─────────────────────────────────────────────
-- METRIC 3: Change Failure Rate
-- Real: PRs merged that triggered a PagerDuty incident within 48 hours
-- Requires pagerduty source
-- ─────────────────────────────────────────────
SELECT
  'change_failure_rate'                                 AS metric,
  'pr_to_incident_within_48h'                           AS measurement_type,
  ROUND(
    100.0 * COUNT(DISTINCT pd.id)
    / NULLIF(COUNT(DISTINCT pr.id), 0)
  , 1)                                                  AS value_per_week,
  'percent'                                             AS unit
FROM github.pull_requests pr
LEFT JOIN pagerduty.incidents pd
  ON pd.created_at BETWEEN pr.merged_at
                       AND pr.merged_at + INTERVAL '48 hours'
WHERE pr.base_repo_owner  = '{github_org}'
  AND pr.base_repo_name   = '{github_repo}'
  AND pr.merged_at        IS NOT NULL
  AND pr.merged_at        > NOW() - INTERVAL '28 days'

UNION ALL

-- ─────────────────────────────────────────────
-- METRIC 4: Mean Time to Recovery
-- Real: PagerDuty incident created → resolved
-- Requires pagerduty source
-- ─────────────────────────────────────────────
SELECT
  'mttr'                                                AS metric,
  'pagerduty_incident_created_to_resolved'              AS measurement_type,
  ROUND(
    AVG(DATEDIFF('hour', pd.created_at, pd.resolved_at))
  , 1)                                                  AS value_per_week,
  'hours'                                               AS unit
FROM pagerduty.incidents pd
WHERE pd.status       = 'resolved'
  AND pd.resolved_at  IS NOT NULL
  AND pd.created_at   > NOW() - INTERVAL '28 days'
