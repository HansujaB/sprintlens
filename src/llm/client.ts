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

/** Call the Anthropic Messages API — writing only, no reasoning. */
export async function callClaude(
  messages: LlmMessage[],
  apiKey: string,
  maxTokens = 2048,
): Promise<string> {
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

  if (!response.ok) {
    const body = await response.text();
    throw new LlmError(`Anthropic API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  const text = data.content.find((b) => b.type === 'text')?.text;
  if (!text) {
    throw new LlmError('Anthropic API returned no text content');
  }

  return text;
}
