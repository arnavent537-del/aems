export async function sendSms(to: string, message: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const enabled = process.env.TWILIO_ENABLED === "true";
    if (!enabled) {
      // Not configured — log for dev and return ok=false so callers can return dev OTP
      console.log(`SMS disabled. Would send to ${to}: ${message}`);
      return { ok: false };
    }

    // Attempt dynamic import of Twilio to avoid hard dependency in dev
    const { default: Twilio } = await import("twilio");
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM;

    if (!accountSid || !authToken || !from) {
      return { ok: false, error: "Twilio not fully configured" };
    }

    const client = Twilio(accountSid, authToken);
    await client.messages.create({ body: message, from, to });
    return { ok: true };
  } catch (err: any) {
    console.error("sendSms error:", err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}
