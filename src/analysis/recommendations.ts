import type { Recommendation, RootCause } from '../types/signals.js';

/** Convert root causes into actionable recommendations. */
export function generateRecommendations(rootCauses: RootCause[]): Recommendation[] {
  const recommendations: Recommendation[] = [];
  let id = 1;

  for (const cause of rootCauses) {
    switch (cause.type) {
      case 'review_bottleneck':
        recommendations.push({
          id: String(id++),
          rootCause: cause.type,
          action: cause.affectedEngineers?.length
            ? `Redistribute review ownership away from ${cause.affectedEngineers.join(' and ')}`
            : 'Add a second reviewer rotation for stale PRs',
          expectedImpact: 'Reduce PR review latency by spreading load across the team',
          priority: 'high',
        });
        break;

      case 'ownership_bottleneck':
        recommendations.push({
          id: String(id++),
          rootCause: cause.type,
          action: cause.affectedEngineers?.[0]
            ? `Move 2-3 active issues from ${cause.affectedEngineers[0]} to engineers with lower load`
            : 'Rebalance active issue assignments before next sprint planning',
          expectedImpact: 'Reduce ownership concentration and unblock parallel delivery',
          priority: 'high',
          assignee: cause.affectedEngineers?.[0],
        });
        break;

      case 'incident_interference':
        recommendations.push({
          id: String(id++),
          rootCause: cause.type,
          action: 'Schedule a toil reduction review for on-call-heavy engineers this sprint',
          expectedImpact: 'Free capacity for feature work by reducing recurring incident load',
          priority: 'medium',
        });
        break;

      case 'context_switching':
        recommendations.push({
          id: String(id++),
          rootCause: cause.type,
          action: cause.affectedEngineers?.[0]
            ? `Limit ${cause.affectedEngineers[0]} to 2 concurrent in-progress issues until load drops`
            : 'Cap concurrent in-progress issues at 2 per engineer',
          expectedImpact: 'Improve cycle time by reducing context switching',
          priority: 'medium',
          assignee: cause.affectedEngineers?.[0],
        });
        break;

      case 'sprint_scope_creep':
        recommendations.push({
          id: String(id++),
          rootCause: cause.type,
          action: "Triage stale PRs in today's standup — close, split, or assign reviewers",
          expectedImpact: 'Reduce delivery risk from aging open work',
          priority: 'high',
        });
        break;

      case 'knowledge_concentration':
        recommendations.push({
          id: String(id++),
          rootCause: cause.type,
          action: cause.affectedEngineers?.[0]
            ? `Pair a second engineer with ${cause.affectedEngineers[0]} on their highest-load area`
            : 'Add a backup owner for the most concentrated service area',
          expectedImpact: 'Reduce bus factor and review bottleneck risk',
          priority: 'medium',
          assignee: cause.affectedEngineers?.[0],
        });
        break;
    }
  }

  return recommendations;
}
