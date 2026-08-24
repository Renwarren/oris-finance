/**
 * REMEDIATION-PLAN.md PR3: form delivery, abstracted behind one interface so the two handlers
 * never know or care which provider ends up behind `env.MAIL_DELIVERY` — see wrangler.toml's
 * "Form delivery" comment and worker/lib/env.ts for why that binding doesn't exist yet (D1).
 */

export interface MailAttachment {
  filename: string;
  contentType: string;
  content: ArrayBuffer;
}

export interface MailMessage {
  /** Where a reply should go — the submitter's own address, so whoever reads MAIL_DELIVERY's
   *  destination can hit "reply" directly. Not necessarily the SMTP envelope sender: most
   *  providers (and Cloudflare Email Routing) require the *from* address to be a verified domain
   *  the account owns, not an arbitrary visitor's address. */
  replyTo: string;
  subject: string;
  /** Plain text only. Nothing here is rendered back into any admin UI (this is a fully static
   *  site with none), but keeping it plain text is still the safer default for whatever the
   *  provider's escaping rules turn out to be. */
  body: string;
  attachments?: MailAttachment[];
}

export interface MailDelivery {
  send(message: MailMessage): Promise<void>;
}

/**
 * Used whenever `env.MAIL_DELIVERY` is undefined — which is always, until D1 is answered and
 * wrangler.toml gains a real binding (see the comment there). Submissions are still fully
 * validated and anti-spam-checked before reaching here; this only stands in for the last step
 * (actually delivering the message), so the form's success/error UX and every server-side check
 * can be built and tested end to end today, without picking a provider in this PR.
 *
 * Logs via `console.warn` (visible in `wrangler tail` / the `wrangler dev` console) rather than
 * silently dropping the message, so a submission during this window is at least observable —
 * but nothing here is a substitute for real delivery. Do not ship this to a production launch;
 * wire a real MAIL_DELIVERY first.
 */
export function createFallbackMailDelivery(): MailDelivery {
  return {
    async send(message) {
      console.warn(
        "[form] MAIL_DELIVERY is not configured (D1 unanswered) — submission logged only, not delivered.",
        {
          replyTo: message.replyTo,
          subject: message.subject,
          bodyLength: message.body.length,
          attachmentCount: message.attachments?.length ?? 0,
        },
      );
    },
  };
}
