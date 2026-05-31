-- SprintLens DORA: Lead Time for Changes
-- Real measurement: Linear issue created → GitHub PR merged
-- Requires both github and linear sources.
-- Replace {github_org}, {github_repo}, {linear_team} from sprintlens.toml

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

WHERE i.team_name    = '{linear_team}'
  AND i.completed_at > NOW() - INTERVAL '28 days'
