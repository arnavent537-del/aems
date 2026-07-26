import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/otp";

export async function POST(request: Request) {
  try {
    const { phone, otp } = await request.json();
    if (!phone || !otp) {
      return NextResponse.json({ error: "Mobile number and OTP are required" }, { status: 400 });
    }

    const result = await verifyOtp(phone.trim(), String(otp).trim(), "signup");
    if (!result.ok) {
      return NextResponse.json({ error: result.reason || "Invalid OTP" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Mobile number verified." });
  } catch (error: any) {
    console.error("Employee Signup Verify OTP Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
