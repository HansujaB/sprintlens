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

/** Send email using sprintlens.toml SMTP config — throws on failure. */
export async function sendConfiguredEmail(
  config: SprintLensConfig,
  to: string[],
  payload: DeliveryPayload,
): Promise<string> {
  const emailConfig = buildEmailConfig(config, to);
  if (!emailConfig) {
    throw new Error(
      'Email delivery requires [delivery.smtp] host to be set in sprintlens.toml.\n' +
      'Credentials are optional — only set SPRINTLENS_SMTP_USER/PASS if your relay requires auth.',
    );
  }

  const result = await deliverToEmail(payload, emailConfig);
  if (!result.success) {
    throw new Error(result.error ?? 'Email delivery failed');
  }

  return result.messageId ?? 'sent';
}
