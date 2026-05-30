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
