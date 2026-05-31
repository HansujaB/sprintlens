export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmError';
  }
}

/** HTTP status codes worth retrying — transient Anthropic errors only. */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 529]);

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;

/**
 * Call the Anthropic Messages API with exponential-backoff retry on transient errors.
 *
 * Retries on: 429 (rate-limit), 500, 502, 503, 529 (overloaded) — up to 3 attempts
 * with 1s / 2s / 4s delays between them.
 * Fails immediately on client errors (401 invalid key, 400 bad request, etc.)
 * since retrying won't help.
 */
export async function callClaude(
  messages: LlmMessage[],
  apiKey: string,
  maxTokens = 2048,
): Promise<string> {
  let lastError: LlmError | undefined;

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
    // Exponential backoff before every retry (not before the first attempt)
    if (attempt > 0) {
      const delayMs = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1); // 1s, 2s, 4s
      await new Promise((res) => setTimeout(res, delayMs));
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        messages,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        content: Array<{ type: string; text?: string }>;
      };

      const text = data.content.find((b) => b.type === 'text')?.text;
      if (!text) {
        throw new LlmError('Anthropic API returned no text content');
      }
      return text;
    }

    const body = await response.text();
    lastError = new LlmError(`Anthropic API error ${response.status}: ${body}`);

    // Don't retry on client errors that won't resolve themselves (e.g. 401, 400)
    if (!RETRYABLE_STATUSES.has(response.status)) {
      throw lastError;
    }
  }

  // Exhausted all retries
  throw lastError ?? new LlmError('Anthropic API call failed after retries');
}
