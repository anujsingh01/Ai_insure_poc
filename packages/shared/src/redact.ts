/**
 * Log redaction paths (pino syntax). Anything that can carry credentials or personal data
 * must be listed here so it never reaches log storage.
 */
export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.token',
  '*.secret',
  '*.otp',
  '*.code',
  '*.pan',
  '*.aadhaar',
  '*.dob',
  '*.email',
  '*.phone',
];

const AADHAAR = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
const PAN = /\b[A-Z]{5}\d{4}[A-Z]\b/g;
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
const PHONE_IN = /(?:\+91[\s-]?)?\b[6-9]\d{9}\b/g;

/** Masks identity numbers and contact details inside free text (messages, error strings). */
export function redactText(input: string): string {
  return input
    .replace(AADHAAR, (m) => `XXXX-XXXX-${m.replace(/\s/g, '').slice(-4)}`)
    .replace(PAN, (m) => `${m.slice(0, 2)}XXXXXX${m.slice(-2)}`)
    .replace(EMAIL, '[email]')
    .replace(PHONE_IN, '[phone]');
}
