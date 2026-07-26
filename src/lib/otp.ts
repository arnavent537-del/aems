import crypto from "crypto";
import { prisma } from "./db";

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

export type OtpPurpose = "signup" | "login" | "password_reset";

export async function generateOtp(phone: string, purpose: OtpPurpose): Promise<string> {
  const otp = String(crypto.randomInt(100000, 1000000)); // 6-digit
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.otpRecord.upsert({
    where: { phone_purpose: { phone, purpose } },
    create: { phone, purpose, otp, expiresAt },
    update: { otp, expiresAt, attempts: 0, verified: false },
  });

  return otp;
}

export async function verifyOtp(
  phone: string,
  otp: string,
  purpose: OtpPurpose
): Promise<{ ok: boolean; reason?: string }> {
  const entry = await prisma.otpRecord.findUnique({
    where: { phone_purpose: { phone, purpose } },
  });
  if (!entry) return { ok: false, reason: "No OTP requested for this number" };
  if (Date.now() > entry.expiresAt.getTime()) {
    await prisma.otpRecord.delete({ where: { id: entry.id } }).catch(() => {});
    return { ok: false, reason: "OTP expired. Please request a new one." };
  }
  if (entry.attempts >= MAX_ATTEMPTS) {
    await prisma.otpRecord.delete({ where: { id: entry.id } }).catch(() => {});
    return { ok: false, reason: "Too many attempts. Please request a new OTP." };
  }

  await prisma.otpRecord.update({
    where: { id: entry.id },
    data: { attempts: { increment: 1 } },
  });

  if (entry.otp !== otp) return { ok: false, reason: "Invalid OTP" };

  await prisma.otpRecord.update({
    where: { id: entry.id },
    data: { verified: true },
  });
  return { ok: true };
}

export async function isPhoneVerified(phone: string, purpose: OtpPurpose): Promise<boolean> {
  const entry = await prisma.otpRecord.findUnique({
    where: { phone_purpose: { phone, purpose } },
  });
  return !!entry && entry.verified && Date.now() <= entry.expiresAt.getTime();
}

export async function consumeVerification(phone: string, purpose: OtpPurpose): Promise<void> {
  await prisma.otpRecord
    .deleteMany({ where: { phone, purpose } })
    .catch(() => {});
}
