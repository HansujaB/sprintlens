/**
 * Slack delivery — DISABLED (not wired to any command yet).
 *
 * Email delivery via SMTP works for all report types (report, digest, executive, dora).
 * Slack DM delivery is more complex to set up (requires a Bot token with
 * channels:read + chat:write, per-user Slack ID mapping, and a workspace app install)
 * and is left here as a future extension point.
 *
 * To enable: wire `deliverToSlack` into runReport / runExecutive with a --slack flag
 * and add a [delivery.slack] section to sprintlens.toml.
 */

import type { DeliveryPayload, DeliveryResult, SlackDeliveryConfig } from '../types/report.js';

/** Deliver a rendered report to Slack via webhook. No analysis or LLM calls. */
export async function deliverToSlack(
  payload: DeliveryPayload,
  config: SlackDeliveryConfig,
): Promise<DeliveryResult> {
  if (!config.webhookUrl) {
    return {
      channel: 'slack',
      success: false,
      error: 'Slack webhook URL is not configured',
    };
  }

  try {
    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: config.channel,
        text: payload.subject,
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: payload.markdown ?? payload.body },
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return { channel: 'slack', success: false, error: body };
    }

    return { channel: 'slack', success: true };
  } catch (err) {
    return {
      channel: 'slack',
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
