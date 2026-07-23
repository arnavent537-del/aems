import crypto from "crypto";

interface OtpEntry {
  otp: string;
  expiresAt: number;
  verified: boolean;
  attempts: number;
}

// In-memory store: phone -> OtpEntry. Suitable for single-instance dev.
const store = new Map<string, OtpEntry>();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function generateOtp(phone: string): string {
  const otp = String(crypto.randomInt(100000, 1000000)); // 6-digit
  store.set(phone, {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    verified: false,
    attempts: 0,
  });
  return otp;
}

export function verifyOtp(phone: string, otp: string): { ok: boolean; reason?: string } {
  const entry = store.get(phone);
  if (!entry) return { ok: false, reason: "No OTP requested for this number" };
  if (Date.now() > entry.expiresAt) {
    store.delete(phone);
    return { ok: false, reason: "OTP expired. Please request a new one." };
  }
  if (entry.attempts >= 5) {
    store.delete(phone);
    return { ok: false, reason: "Too many attempts. Please request a new OTP." };
  }
  entry.attempts += 1;
  if (entry.otp !== otp) {
    return { ok: false, reason: "Invalid OTP" };
  }
  entry.verified = true;
  return { ok: true };
}

export function isPhoneVerified(phone: string): boolean {
  const entry = store.get(phone);
  return !!entry && entry.verified && Date.now() <= entry.expiresAt;
}

export function consumeVerification(phone: string): void {
  store.delete(phone);
}
