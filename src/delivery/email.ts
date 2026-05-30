import nodemailer from 'nodemailer';
import type { SprintLensConfig } from '../types/config.js';
import type {
  DeliveryPayload,
  DeliveryResult,
  EmailDeliveryConfig,
} from '../types/report.js';
import { getSmtpCredentials } from '../config/loadConfig.js';

/** Build SMTP delivery config for a set of recipients. */
export function buildEmailConfig(
  config: SprintLensConfig,
  to: string[],
): EmailDeliveryConfig | null {
  const smtp = config.delivery?.smtp;
  if (!smtp) return null;

  const { user, pass } = getSmtpCredentials();

  return {
    to,
    from: smtp.from,
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    user,
    pass,
  };
}


/** Deliver a rendered report via SMTP. No analysis or LLM calls. */
export async function deliverToEmail(
  payload: DeliveryPayload,
  config: EmailDeliveryConfig,
): Promise<DeliveryResult> {
  if (config.to.length === 0) {
    return {
      channel: 'email',
      success: false,
      error: 'No email recipients configured',
    };
  }

  if (!config.host) {
    return {
      channel: 'email',
      success: false,
      error: 'SMTP host is not configured in sprintlens.toml [delivery.smtp]',
    };
  }

  try {
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth:
        config.user && config.pass
          ? { user: config.user, pass: config.pass }
          : undefined,
    });

    const info = await transport.sendMail({
      from: config.from,
      to: config.to.join(', '),
      subject: payload.subject,
      text: payload.body,
    });

    return {
      channel: 'email',
      success: true,
      messageId: info.messageId,
    };
  } catch (err) {
    return {
      channel: 'email',
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
