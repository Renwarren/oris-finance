/**
 * REMEDIATION-PLAN.md PR3: server-side validation for both forms. The two Astro pages already
 * carry `required`/`type="email"` etc., which a compliant browser enforces on its own even with
 * JavaScript disabled (that's native HTML form validation, not a script) — these checks exist as
 * the backstop for a direct POST that skips the browser entirely (curl, a bot, a broken client),
 * not as the primary UX.
 *
 * A field-specific reason is returned for `console.warn` logging only; both handlers redirect
 * every validation failure to the same generic /erreur/ page (see that page's header comment for
 * why) rather than surfacing which field was wrong.
 */
import { accountTypeOptions } from "../../src/lib/account-types";

export interface ValidationOk<T> {
  ok: true;
  data: T;
}
export interface ValidationFail {
  ok: false;
  reason: string;
}
export type ValidationResult<T> = ValidationOk<T> | ValidationFail;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readTrimmedString(formData: FormData, field: string, maxLength: number): string | null {
  const value = formData.get(field);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return null;
  return trimmed;
}

export interface ContactSubmission {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export function validateContact(formData: FormData): ValidationResult<ContactSubmission> {
  const name = readTrimmedString(formData, "name", 200);
  if (!name) return { ok: false, reason: "name missing or too long" };

  const email = readTrimmedString(formData, "email", 254);
  if (!email || !EMAIL_PATTERN.test(email)) return { ok: false, reason: "email missing or invalid" };

  const subject = readTrimmedString(formData, "subject", 200);
  if (!subject) return { ok: false, reason: "subject missing or too long" };

  const message = readTrimmedString(formData, "message", 5000);
  if (!message) return { ok: false, reason: "message missing or too long" };

  return { ok: true, data: { name, email, subject, message } };
}

export interface AccountOpeningSubmission {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  amount: string;
  accountType: string;
  city: string;
  district: string;
  message: string;
  attachment: File | null;
}

/** 5 Mo, matching the live form (REMEDIATION-PLAN.md PR3 scope) and the label on the page. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** KYC-document-shaped types only: a scan/photo of an ID or a PDF. Anything else (a script, an
 *  executable masquerading via a renamed extension, an office document with macros) is rejected
 *  outright rather than forwarded as an email attachment. */
export const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function validateAttachment(formData: FormData): ValidationResult<File | null> {
  const value = formData.get("attachment");
  // An empty file input still submits a zero-byte File named "" with the browser's default
  // enctype behaviour — treat that the same as "no attachment", not a validation failure.
  if (!(value instanceof File) || value.size === 0) return { ok: true, data: null };

  if (value.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, reason: `attachment too large (${value.size} bytes)` };
  }
  if (!ALLOWED_ATTACHMENT_TYPES.has(value.type)) {
    return { ok: false, reason: `attachment content-type not allowed (${value.type})` };
  }
  return { ok: true, data: value };
}

export function validateAccountOpening(
  formData: FormData,
): ValidationResult<AccountOpeningSubmission> {
  const name = readTrimmedString(formData, "name", 200);
  if (!name) return { ok: false, reason: "name missing or too long" };

  const email = readTrimmedString(formData, "email", 254);
  if (!email || !EMAIL_PATTERN.test(email)) return { ok: false, reason: "email missing or invalid" };

  const phone = readTrimmedString(formData, "phone", 30);
  if (!phone) return { ok: false, reason: "phone missing or too long" };

  const whatsapp = readTrimmedString(formData, "whatsapp", 30);
  if (!whatsapp) return { ok: false, reason: "whatsapp missing or too long" };

  const amount = readTrimmedString(formData, "amount", 50);
  if (!amount) return { ok: false, reason: "amount missing or too long" };

  const accountType = readTrimmedString(formData, "accountType", 100);
  if (!accountType || !(accountTypeOptions as readonly string[]).includes(accountType)) {
    return { ok: false, reason: "accountType missing or not a recognised option" };
  }

  const city = readTrimmedString(formData, "city", 100);
  if (!city) return { ok: false, reason: "city missing or too long" };

  const district = readTrimmedString(formData, "district", 100);
  if (!district) return { ok: false, reason: "district missing or too long" };

  // Optional field: absent/empty is valid, just capped in length when present.
  const messageRaw = formData.get("message");
  const message = typeof messageRaw === "string" ? messageRaw.trim().slice(0, 5000) : "";

  const consent = formData.get("consent");
  if (consent !== "on" && consent !== "true") {
    return { ok: false, reason: "consent not given" };
  }

  const attachmentResult = validateAttachment(formData);
  if (!attachmentResult.ok) return attachmentResult;

  return {
    ok: true,
    data: {
      name,
      email,
      phone,
      whatsapp,
      amount,
      accountType,
      city,
      district,
      message,
      attachment: attachmentResult.data,
    },
  };
}
