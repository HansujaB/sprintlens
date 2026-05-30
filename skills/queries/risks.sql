-- SprintLens: Risk Query
-- Answers: which PRs are stale and dangerous, what is likely to become an incident.
-- DORA signal: Change Failure Rate, MTTR context.
--
-- Before running, verify column names with describe_table and list_columns.
-- Sentry and PagerDuty joins are LEFT JOIN — works without those sources.
-- Replace {github_org}, {github_repo} with values from sprintlens.toml

SELECT
  pr.title                                              AS pull_request,
  pr.author                                             AS author,
  pr.number                                             AS pr_number,
  DATEDIFF('day', pr.created_at, NOW())                 AS days_open,
  COUNT(DISTINCT s.id)                                  AS related_sentry_errors,
  COUNT(DISTINCT pd.id)                                 AS related_incidents,

  -- risk score: stale PRs with correlated errors are highest risk
  (
    DATEDIFF('day', pr.created_at, NOW()) * 1
    + COUNT(DISTINCT s.id) * 4
    + COUNT(DISTINCT pd.id) * 5
  )                                                     AS risk_score

FROM github.pull_requests pr

LEFT JOIN sentry.issues s
  ON s.title       ILIKE '%' || pr.title || '%'
  AND s.first_seen > pr.created_at

LEFT JOIN pagerduty.incidents pd
  ON pd.title       ILIKE '%' || pr.title || '%'
  AND pd.created_at > pr.created_at

WHERE pr.state              = 'open'
  AND (pr.draft IS NULL OR pr.draft = false)
  AND pr.base_repo_owner    = '{github_org}'
  AND pr.base_repo_name     = '{github_repo}'
  AND DATEDIFF('day', pr.created_at, NOW()) > 3

GROUP BY pr.title, pr.author, pr.number, pr.created_at
ORDER BY risk_score DESC
LIMIT 10
