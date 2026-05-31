-- SprintLens DORA: Deployment Frequency
-- Proxy: PR merges to main/master per week
-- (Real deployments need GitHub Actions workflow run data)
-- Replace {github_org}, {github_repo} from sprintlens.toml

SELECT
  'deployment_frequency'                                AS metric,
  'proxy_pr_merges'                                     AS measurement_type,
  ROUND(COUNT(*) / 4.0, 1)                              AS value_per_week,
  'deploys/week'                                        AS unit

FROM github.pull_requests
WHERE base_repo_owner   = '{github_org}'
  AND base_repo_name    = '{github_repo}'
  AND base_branch       IN ('main', 'master')
  AND merged_at         IS NOT NULL
  AND merged_at         > NOW() - INTERVAL '28 days'
