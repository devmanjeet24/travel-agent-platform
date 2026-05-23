/** Local calendar date as YYYY-MM-DD (avoids UTC off-by-one). */
export function toIsoDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseIsoDateString(value: string): Date | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (!match) return undefined
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export function formatIsoDateDisplay(iso: string): string {
  const date = parseIsoDateString(iso)
  if (!date) return ''
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
