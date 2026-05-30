-- SprintLens: Velocity Query
-- Answers: where is cycle time increasing, which PRs are stuck, what is lead time.
-- DORA signal: Lead Time for Changes, Deployment Frequency proxy.
--
-- Before running, verify column names with:
--   describe_table(schema="linear", table="issues")
--   describe_table(schema="github", table="pull_requests")
--   list_columns(schema="linear", table="issues")
--   list_columns(schema="github", table="pull_requests")
--
-- Replace {linear_team}, {github_org}, {github_repo} with values from sprintlens.toml
-- Replace engineer email list with actual emails from sprintlens.toml [engineers]

SELECT
  i.assignee_email                                          AS engineer,
  COUNT(DISTINCT i.id)                                      AS issues_completed_30d,
  ROUND(
    AVG(DATEDIFF('hour', i.created_at, i.completed_at))
    / 24.0, 1
  )                                                         AS avg_cycle_days,
  COUNT(DISTINCT pr.id)                                     AS prs_merged_30d,
  ROUND(
    AVG(DATEDIFF('hour', pr.created_at, pr.merged_at)), 0
  )                                                         AS avg_pr_review_hrs

FROM linear.issues i
JOIN github.pull_requests pr
  ON pr.author      = i.assignee_email
  AND pr.merged_at  IS NOT NULL
  AND pr.merged_at  > NOW() - INTERVAL '30 days'

WHERE i.completed_at  > NOW() - INTERVAL '30 days'
  AND i.team_name     = '{linear_team}'
  AND i.assignee_email IN (
    {engineer_emails}
  )

GROUP BY i.assignee_email
ORDER BY avg_cycle_days DESC NULLS LAST
