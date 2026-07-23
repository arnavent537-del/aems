import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { isPhoneVerified, consumeVerification } from "@/lib/otp";

export async function POST(request: Request) {
  try {
    const { phone, password } = await request.json();
    if (!phone || !password) {
      return NextResponse.json({ error: "Mobile number and password are required" }, { status: 400 });
    }

    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    if (!isPhoneVerified(phone.trim())) {
      return NextResponse.json(
        { error: "Mobile number not verified. Please verify your OTP first." },
        { status: 403 }
      );
    }

    const employee = await prisma.employee.findFirst({
      where: { phoneNo: phone.trim() },
      select: { id: true, passwordHash: true },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee record not found." }, { status: 404 });
    }

    if (employee.passwordHash) {
      consumeVerification(phone.trim());
      return NextResponse.json({ error: "This mobile number is already registered." }, { status: 409 });
    }

    await prisma.employee.update({
      where: { id: employee.id },
      data: { passwordHash: hashPassword(password) },
    });

    consumeVerification(phone.trim());

    return NextResponse.json({ success: true, message: "Password created successfully." });
  } catch (error: any) {
    console.error("Employee Signup Set Password Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
