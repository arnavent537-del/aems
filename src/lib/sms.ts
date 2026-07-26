import "dotenv/config";

/** Normalise a phone number to E.164 (+91 India). Accepts 10-digit or prefixed. */
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.startsWith("0")) return `+91${digits.slice(1)}`;
  return digits.startsWith("+") ? `+${digits.slice(1)}` : phone;
}

export async function sendSms(to: string, message: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const enabled = process.env.TWILIO_ENABLED === "true";
    console.log(`[SMS] TWILIO_ENABLED=${process.env.TWILIO_ENABLED}, resolved=${enabled}`);
    if (!enabled) {
      console.log(`SMS disabled. Would send to ${to}: ${message}`);
      return { ok: false };
    }

    // Attempt dynamic import of Twilio to avoid hard dependency in dev
    const { default: Twilio } = await import("twilio");
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM;

    if (!accountSid || !authToken || !from) {
      console.error("[SMS] Twilio not fully configured:", { accountSid: !!accountSid, authToken: !!authToken, from });
      return { ok: false, error: "Twilio not fully configured" };
    }

    console.log(`[SMS] Sending to ${formatPhone(to)} from ${from}`);
    const client = Twilio(accountSid, authToken);
    await client.messages.create({ body: message, from, to: formatPhone(to) });
    console.log(`[SMS] Sent successfully to ${formatPhone(to)}`);
    return { ok: true };
  } catch (err: any) {
    console.error("sendSms error:", err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}
