import { t } from '@/constants/inter-typography'

/** Type scale — aligned with Expo Web (Inter + same sizes). */
export const typography = {
  display: t({
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 36,
  }),
  h1: t({
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 30,
  }),
  h2: t({
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 24,
  }),
  h3: t({
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.15,
    lineHeight: 22,
  }),
  body: t({
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
  }),
  bodyMedium: t({
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  }),
  bodySm: t({
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  }),
  caption: t({
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
    letterSpacing: 0.2,
  }),
  eyebrow: t({
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  }),
  label: t({
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  }),
  button: t({
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.05,
  }),
  buttonSm: t({
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.05,
  }),
} as const
