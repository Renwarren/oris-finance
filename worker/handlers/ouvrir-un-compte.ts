import type { Env } from "../lib/env";
import { redirectTo } from "../lib/response";
import { getClientIp, isRateLimited } from "../lib/rate-limit";
import { passesAntiSpam } from "../lib/spam-check";
import { validateAccountOpening } from "../lib/validate";
import { createFallbackMailDelivery, type MailAttachment } from "../lib/mail";

const SUCCESS_PATH = "/ouvrir-un-compte/merci/";
const ERROR_PATH = "/ouvrir-un-compte/erreur/";

/** POST /api/ouvrir-un-compte — REMEDIATION-PLAN.md PR3. */
export async function handleOuvrirUnCompte(request: Request, env: Env): Promise<Response> {
  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    console.warn("[form] ouvrir-un-compte: rate-limited", ip);
    return redirectTo(ERROR_PATH);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    console.warn("[form] ouvrir-un-compte: could not parse form data", error);
    return redirectTo(ERROR_PATH);
  }

  if (!(await passesAntiSpam(request, formData, env, ip))) {
    return redirectTo(ERROR_PATH);
  }

  const result = validateAccountOpening(formData);
  if (!result.ok) {
    console.warn("[form] ouvrir-un-compte: validation failed —", result.reason);
    return redirectTo(ERROR_PATH);
  }

  const { attachment, ...fields } = result.data;
  const attachments: MailAttachment[] = [];
  if (attachment) {
    attachments.push({
      filename: attachment.name || "piece-jointe",
      contentType: attachment.type,
      content: await attachment.arrayBuffer(),
    });
  }

  const mail = env.MAIL_DELIVERY ?? createFallbackMailDelivery();
  try {
    await mail.send({
      replyTo: fields.email,
      subject: `[Site web] Ouverture de compte — ${fields.accountType}`,
      body: [
        `Nom : ${fields.name}`,
        `Email : ${fields.email}`,
        `Téléphone : ${fields.phone}`,
        `WhatsApp : ${fields.whatsapp}`,
        `Montant initial à verser : ${fields.amount}`,
        `Type de compte : ${fields.accountType}`,
        `Ville : ${fields.city}`,
        `Quartier : ${fields.district}`,
        "",
        fields.message || "(aucun message)",
      ].join("\n"),
      attachments,
    });
  } catch (error) {
    console.error("[form] ouvrir-un-compte: delivery failed", error);
    return redirectTo(ERROR_PATH);
  }

  return redirectTo(SUCCESS_PATH);
}
