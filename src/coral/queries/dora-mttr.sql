-- SprintLens DORA: Mean Time to Recovery (MTTR)
-- Real measurement: PagerDuty incident created_at → resolved_at.
-- ⚠ Only included in query when pagerduty source is connected.

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
