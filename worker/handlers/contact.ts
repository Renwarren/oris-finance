import type { Env } from "../lib/env";
import { redirectTo } from "../lib/response";
import { getClientIp, isRateLimited } from "../lib/rate-limit";
import { passesAntiSpam } from "../lib/spam-check";
import { validateContact } from "../lib/validate";
import { createFallbackMailDelivery } from "../lib/mail";

const SUCCESS_PATH = "/contacts/merci/";
const ERROR_PATH = "/contacts/erreur/";

/** POST /api/contact — REMEDIATION-PLAN.md PR3. */
export async function handleContact(request: Request, env: Env): Promise<Response> {
  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    console.warn("[form] contact: rate-limited", ip);
    return redirectTo(ERROR_PATH);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    console.warn("[form] contact: could not parse form data", error);
    return redirectTo(ERROR_PATH);
  }

  if (!(await passesAntiSpam(request, formData, env, ip))) {
    return redirectTo(ERROR_PATH);
  }

  const result = validateContact(formData);
  if (!result.ok) {
    console.warn("[form] contact: validation failed —", result.reason);
    return redirectTo(ERROR_PATH);
  }

  const mail = env.MAIL_DELIVERY ?? createFallbackMailDelivery();
  try {
    await mail.send({
      replyTo: result.data.email,
      subject: `[Site web] Contact — ${result.data.subject}`,
      body: [
        `Nom : ${result.data.name}`,
        `Email : ${result.data.email}`,
        `Sujet : ${result.data.subject}`,
        "",
        result.data.message,
      ].join("\n"),
    });
  } catch (error) {
    console.error("[form] contact: delivery failed", error);
    return redirectTo(ERROR_PATH);
  }

  return redirectTo(SUCCESS_PATH);
}
