-- SprintLens: Load Query
-- Answers: who has too much active work, where is toil concentrated, who is at burnout risk.
-- DORA signal: Change Failure Rate context (high Sentry errors relative to PRs merged).
--
-- Before running, verify column names with describe_table and list_columns for each source.
-- PagerDuty and Sentry joins are LEFT JOIN — query works even if those sources are not connected.
-- Replace {linear_team} with value from sprintlens.toml

SELECT
  i.assignee_email                    AS engineer,
  COUNT(DISTINCT i.id)                AS active_linear_issues,
  COUNT(DISTINCT pr.id)               AS open_prs,
  COUNT(DISTINCT s.id)                AS unresolved_sentry_errors,
  COUNT(DISTINCT pd.id)               AS pagerduty_incidents_30d,

  -- composite load score: weight each signal
  (
    COUNT(DISTINCT i.id) * 2
    + COUNT(DISTINCT pr.id) * 1
    + COUNT(DISTINCT s.id) * 1
    + COUNT(DISTINCT pd.id) * 3
  )                                   AS load_score

FROM linear.issues i

LEFT JOIN github.pull_requests pr
  ON pr.author  = i.assignee_email
  AND pr.state  = 'open'

LEFT JOIN sentry.issues s
  ON s.assignee_email = i.assignee_email
  AND s.status        = 'unresolved'

LEFT JOIN pagerduty.incidents pd
  ON pd.assignee_email  = i.assignee_email
  AND pd.created_at     > NOW() - INTERVAL '30 days'

WHERE i.state       = 'in_progress'
  AND i.team_name   = '{linear_team}'

GROUP BY i.assignee_email
ORDER BY load_score DESC
