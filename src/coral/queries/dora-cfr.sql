-- SprintLens DORA: Change Failure Rate
-- Real measurement: PRs merged that triggered a PagerDuty incident within 48 hours.
-- ⚠ Only included in query when pagerduty source is connected.
-- Replace {github_org}, {github_repo} from sprintlens.toml

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
