export type ParsedTripContext = {
  destination?: string;
  origin?: string;
  startDate?: string;
  endDate?: string;
  budgetUsd?: number;
  travelers?: number;
};

/** Best-effort extraction from a natural-language chat message. */
export function parseTripContextFromMessage(text: string): ParsedTripContext {
  const ctx: ParsedTripContext = {};

  const destMatch = text.match(
    /(?:to|in|visit|trip to|going to)\s+([A-Za-z][A-Za-z\s,]{2,40}?)(?:\s+in\s+|\s+for\s+|\s+with\s+|\.|,|$)/i,
  );
  if (destMatch) ctx.destination = destMatch[1].trim();

  const budgetMatch = text.match(/\$?\s*(\d{3,6})\s*(?:usd|dollars?|budget)?/i);
  if (budgetMatch) ctx.budgetUsd = Number(budgetMatch[1]);

  const travelersMatch = text.match(/(\d+)\s*(?:people|travelers|travellers|guests|pax)/i);
  if (travelersMatch) ctx.travelers = Number(travelersMatch[1]);

  const originMatch = text.match(
    /(?:from|flying from|leaving)\s+([A-Za-z][A-Za-z\s]{2,30}?)(?:\s+to\s+|\s+in\s+|\.|,|$)/i,
  );
  if (originMatch) ctx.origin = originMatch[1].trim();

  const isoDate = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoDate) ctx.startDate = isoDate[1];

  return ctx;
}
