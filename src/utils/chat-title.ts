/** Client-side fallback title when server title is not yet available. */
export function deriveChatTitle(firstMessage: string): string {
  const cleaned = firstMessage
    .replace(/\[Attachments:[^\]]+\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return 'New trip chat';

  const sentence = cleaned.split(/[.!?]/)[0]?.trim() ?? cleaned;
  const words = sentence.split(/\s+/).slice(0, 8).join(' ');
  const title = words.length > 48 ? `${words.slice(0, 45)}…` : words;
  return title.charAt(0).toUpperCase() + title.slice(1);
}
