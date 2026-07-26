import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyOtp, consumeVerification } from "@/lib/otp";
import { hashPassword } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { phone, otp, password } = await request.json();
    if (!phone || !otp || !password) {
      return NextResponse.json({ error: "Mobile number, OTP and new password are required" }, { status: 400 });
    }

    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const result = await verifyOtp(phone.trim(), String(otp).trim(), "password_reset");
    if (!result.ok) {
      return NextResponse.json({ error: result.reason || "Invalid OTP" }, { status: 400 });
    }

    const employee = await prisma.employee.findFirst({ where: { phoneNo: phone.trim() }, select: { id: true, passwordHash: true, name: true, phoneNo: true } });
    if (!employee) {
      return NextResponse.json({ error: "Employee record not found." }, { status: 404 });
    }

    await prisma.employee.update({ where: { id: employee.id }, data: { passwordHash: hashPassword(password) } });

    // Consume verification so OTP can't be reused
    await consumeVerification(phone.trim(), "password_reset");

    // Non-blocking audit trail (won't fail the request)
    try {
      await prisma.auditTrail.create({ data: { userId: employee.id, action: "PASSWORD_RESET", details: `Employee ${employee.name} (${employee.phoneNo}) reset password via OTP.` } });
    } catch (auditErr) {
      console.error("Audit trail write failed (non-blocking):", auditErr);
    }

    return NextResponse.json({ success: true, message: "Password reset successfully." });
  } catch (error: any) {
    console.error("Employee Password Reset Error:", error);
    return NextResponse.json({ error: "Internal server error", detail: error?.message || String(error) }, { status: 500 });
  }
}
