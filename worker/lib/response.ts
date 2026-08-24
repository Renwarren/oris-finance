/**
 * REMEDIATION-PLAN.md PR3: "validate, verify the anti-spam check, deliver, then 303 redirect to
 * a success page." 303 (not 302) so a browser resubmitting via back/refresh re-issues a GET
 * against the redirect target instead of re-POSTing the form — the standard "POST/redirect/GET"
 * pattern, and necessary for the JS-disabled path to behave sanely on refresh.
 */
export function redirectTo(path: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: path },
  });
}
