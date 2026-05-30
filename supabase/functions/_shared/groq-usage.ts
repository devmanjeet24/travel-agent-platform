/** Structured Groq token usage logging for Edge Functions. */

export type GroqUsageLog = {
  type: 'groq_usage';
  label: string;
  model: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  conversation_id?: string;
  user_id?: string;
  step?: number;
};

export function logGroqUsage(
  label: string,
  data: Record<string, unknown>,
  model: string,
  extra?: Omit<GroqUsageLog, 'type' | 'label' | 'model'>,
): void {
  const usage = data?.usage as Record<string, number> | undefined;
  if (!usage || typeof usage.total_tokens !== 'number') return;

  const entry: GroqUsageLog = {
    type: 'groq_usage',
    label,
    model,
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
    ...extra,
  };
  console.log(JSON.stringify(entry));
}
