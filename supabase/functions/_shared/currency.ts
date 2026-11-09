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

function parseBudgetAmountToken(raw: string): number | undefined {
  const n = Number(raw.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** When the user states a per-person budget, multiply by traveler count. */
export function parseBudgetFromText(
  text: string,
  opts?: { travelers?: number },
): number | undefined {
  const travelers = opts?.travelers != null && opts.travelers > 0
    ? Math.round(opts.travelers)
    : undefined;

  const eachBudgetMatch = text.match(
    /\b(?:each|per\s+(?:person|traveler|traveller|friend|guest))\s+(?:having\s+)?(?:a\s+)?budget\s+of\s*(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+|\d{4,7})/i,
  );
  if (eachBudgetMatch) {
    const perPerson = parseBudgetAmountToken(eachBudgetMatch[1]);
    if (perPerson != null) {
      return travelers && travelers > 1 ? perPerson * travelers : perPerson;
    }
  }

  const lakhMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:lakhs?|lac)\b/i);
  if (lakhMatch) return Math.round(Number(lakhMatch[1]) * 100000);

  const kMatch = text.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) return Math.round(Number(kMatch[1]) * 1000);

  const inrMatch = text.match(
    /(?:₹|rs\.?\s*|inr\s*)(\d{1,3}(?:,\d{2,3})+|\d{4,7})/i,
  );
  if (inrMatch) {
    const amount = parseBudgetAmountToken(inrMatch[1]);
    if (amount != null && /\b(?:each|per\s+(?:person|traveler|friend))\b/i.test(text) && travelers && travelers > 1) {
      return amount * travelers;
    }
    if (amount != null) return amount;
  }

  const plainMatch = text.match(
    /(?:budget|under|around|max|total)?\s*(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+|\d{4,7})\s*(?:inr|rupees?|rs\.?|budget)?/i,
  );
  if (plainMatch) {
    const amount = parseBudgetAmountToken(plainMatch[1]);
    if (amount != null && /\b(?:each|per\s+(?:person|traveler|friend))\b/i.test(text) && travelers && travelers > 1) {
      return amount * travelers;
    }
    if (amount != null) return amount;
  }

  const usdMatch = text.match(/\$\s*(\d{3,6})\s*(?:usd|dollars?)?/i);
  if (usdMatch) return Math.round(Number(usdMatch[1]) * 83);

  return undefined;
}
