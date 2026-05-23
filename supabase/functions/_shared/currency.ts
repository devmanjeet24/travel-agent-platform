/** App currency: DB columns named *_usd store amounts in INR. */

export const CURRENCY_CODE = 'INR';
export const CURRENCY_SYMBOL = '₹';

export const LOW_BUDGET_PER_DAY_INR = 2500;
export const LOW_BUDGET_TOTAL_INR = 20000;
export const MEDIUM_BUDGET_PER_DAY_INR = 5000;
export const MEDIUM_BUDGET_TOTAL_INR = 50000;

export function formatInr(amount: number): string {
  return `${CURRENCY_SYMBOL}${Math.round(amount).toLocaleString('en-IN')}`;
}

export function parseBudgetFromText(text: string): number | undefined {
  const lakhMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:lakhs?|lac)\b/i);
  if (lakhMatch) return Math.round(Number(lakhMatch[1]) * 100000);

  const kMatch = text.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) return Math.round(Number(kMatch[1]) * 1000);

  const inrMatch = text.match(
    /(?:₹|rs\.?\s*|inr\s*)(\d{1,3}(?:,\d{2,3})+|\d{4,7})/i,
  );
  if (inrMatch) return Number(inrMatch[1].replace(/,/g, ''));

  const plainMatch = text.match(
    /(?:budget|under|around|max|total)?\s*(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+|\d{4,7})\s*(?:inr|rupees?|rs\.?|budget)?/i,
  );
  if (plainMatch) return Number(plainMatch[1].replace(/,/g, ''));

  const usdMatch = text.match(/\$\s*(\d{3,6})\s*(?:usd|dollars?)?/i);
  if (usdMatch) return Math.round(Number(usdMatch[1]) * 83);

  return undefined;
}
