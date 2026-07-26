import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyOtp, consumeVerification } from "@/lib/otp";
import { setSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { phone, otp } = await request.json();
    if (!phone || !otp) {
      return NextResponse.json({ error: "Mobile number and OTP are required" }, { status: 400 });
    }

    const result = await verifyOtp(phone.trim(), String(otp).trim(), "login");
    if (!result.ok) {
      return NextResponse.json({ error: result.reason || "Invalid OTP" }, { status: 400 });
    }

    const employee = await prisma.employee.findFirst({ where: { phoneNo: phone.trim() }, select: { id: true, name: true, phoneNo: true, clientId: true } });
    if (!employee) {
      return NextResponse.json({ error: "Employee record not found." }, { status: 404 });
    }

    await setSession({
      userId: employee.id,
      username: employee.phoneNo!,
      role: "employee",
      assignedClientId: employee.clientId,
      assignedClientIds: employee.clientId ? [employee.clientId] : [],
    });

    await prisma.auditTrail.create({
      data: {
        userId: employee.id,
        action: "LOGIN",
        details: `Employee ${employee.name} (${employee.phoneNo}) logged in via OTP.`,
      },
    });

    // Consume verification so OTP can't be reused
    await consumeVerification(phone.trim(), "login");

    return NextResponse.json({
      success: true,
      user: {
        id: employee.id,
        username: employee.phoneNo,
        role: "employee",
        assignedClientId: employee.clientId,
        assignedClientIds: employee.clientId ? [employee.clientId] : [],
      },
    });
  } catch (error: any) {
    console.error("Employee Login With OTP Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
