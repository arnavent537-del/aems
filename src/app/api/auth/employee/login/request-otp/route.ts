import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateOtp } from "@/lib/otp";
import { sendSms } from "@/lib/sms";

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();
    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "Mobile number is required" }, { status: 400 });
    }

    const clean = phone.trim();

    const employee = await prisma.employee.findFirst({ where: { phoneNo: clean }, select: { id: true, name: true } });
    if (!employee) {
      return NextResponse.json({ error: "This mobile number is not registered with us." }, { status: 404 });
    }

    const otp = await generateOtp(clean, "login");
    const message = `Your AEMS login code is ${otp}. It is valid for 5 minutes.`;
    const sendResult = await sendSms(clean, message);

    const showDevOtp = process.env.NODE_ENV !== "production" || !sendResult.ok;
    const response: any = { success: true, message: "OTP sent to your mobile number." };
    if (showDevOtp) response.devOtp = otp;

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Employee Login Request OTP Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
