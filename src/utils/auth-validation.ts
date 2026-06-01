/** Client-side auth field validation (trim, format, length). */

export const AUTH_PASSWORD_MIN_LENGTH = 8
export const AUTH_PASSWORD_MAX_LENGTH = 72
export const AUTH_NAME_MAX_LENGTH = 80
export const AUTH_NAME_MIN_LENGTH = 2

/** Practical email check — not exhaustive RFC 5322. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type AuthFieldErrors = {
  email?: string
  password?: string
  confirmPassword?: string
  fullName?: string
}

export function trimAuthField(value: string): string {
  return value.trim()
}

export function isBlankAfterTrim(value: string): boolean {
  return trimAuthField(value).length === 0
}

/** True when the user typed something but it is only whitespace. */
export function isWhitespaceOnly(value: string): boolean {
  return value.length > 0 && /^\s+$/.test(value)
}

export function validateEmail(email: string): string | null {
  const trimmed = trimAuthField(email)
  if (!trimmed) {
    if (isWhitespaceOnly(email)) return 'Email cannot be only spaces.'
    return 'Email is required.'
  }
  if (trimmed.length > 254) return 'Email is too long.'
  if (!EMAIL_REGEX.test(trimmed)) return 'Enter a valid email address.'
  return null
}

/** Sign-in: require a non-empty password (do not trim — spaces may be intentional). */
export function validateSignInPassword(password: string): string | null {
  if (!password) return 'Password is required.'
  if (isWhitespaceOnly(password)) return 'Password cannot be only spaces.'
  return null
}

/** Sign-up / reset: length and whitespace rules. */
export function validatePassword(
  password: string,
  options?: { minLength?: number },
): string | null {
  const minLength = options?.minLength ?? AUTH_PASSWORD_MIN_LENGTH
  if (!password) return 'Password is required.'
  if (isWhitespaceOnly(password)) return 'Password cannot be only spaces.'
  if (password.length < minLength) {
    return `Password must be at least ${minLength} characters.`
  }
  if (password.length > AUTH_PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${AUTH_PASSWORD_MAX_LENGTH} characters.`
  }
  return null
}

export function validatePasswordConfirmation(
  password: string,
  confirmPassword: string,
): string | null {
  if (!confirmPassword) return 'Please confirm your password.'
  if (isWhitespaceOnly(confirmPassword)) return 'Password cannot be only spaces.'
  if (password !== confirmPassword) return 'Passwords do not match.'
  return null
}

export function validateFullName(name: string, required = false): string | null {
  const trimmed = trimAuthField(name)
  if (!trimmed) {
    if (isWhitespaceOnly(name)) return 'Full name cannot be only spaces.'
    return required ? 'Full name is required.' : null
  }
  if (trimmed.length < AUTH_NAME_MIN_LENGTH) {
    return `Name must be at least ${AUTH_NAME_MIN_LENGTH} characters.`
  }
  if (trimmed.length > AUTH_NAME_MAX_LENGTH) {
    return `Name must be at most ${AUTH_NAME_MAX_LENGTH} characters.`
  }
  if (/[\x00-\x1F\x7F]/.test(trimmed)) return 'Name contains invalid characters.'
  if (!/[\p{L}\p{N}]/u.test(trimmed)) {
    return 'Name must include at least one letter or number.'
  }
  return null
}

export function validateSignInFields(
  email: string,
  password: string,
): { ok: true; email: string } | { ok: false; errors: AuthFieldErrors } {
  const errors: AuthFieldErrors = {}
  const emailError = validateEmail(email)
  const passwordError = validateSignInPassword(password)
  if (emailError) errors.email = emailError
  if (passwordError) errors.password = passwordError
  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, email: trimAuthField(email) }
}

export function validateSignUpFields(
  email: string,
  password: string,
  confirmPassword: string,
  fullName: string,
): { ok: true; email: string; fullName: string } | { ok: false; errors: AuthFieldErrors } {
  const errors: AuthFieldErrors = {}
  const emailError = validateEmail(email)
  const passwordError = validatePassword(password)
  const confirmError = validatePasswordConfirmation(password, confirmPassword)
  const nameError = validateFullName(fullName, true)

  if (emailError) errors.email = emailError
  if (passwordError) errors.password = passwordError
  if (confirmError) errors.confirmPassword = confirmError
  if (nameError) errors.fullName = nameError

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    email: trimAuthField(email),
    fullName: trimAuthField(fullName),
  }
}

export function validateResetPasswordEmail(
  email: string,
): { ok: true; email: string } | { ok: false; message: string } {
  const emailError = validateEmail(email)
  if (emailError) return { ok: false, message: emailError }
  return { ok: true, email: trimAuthField(email) }
}
