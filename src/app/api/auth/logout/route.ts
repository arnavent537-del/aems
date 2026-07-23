import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activityLogger";

export async function POST() {
  try {
    const session = await getSession();
    if (session) {
      // Log activity
      await logActivity({
        userId: session.userId,
        action: "LOGOUT",
        details: `User ${session.username} logged out.`,
      });

      // Log logout in audit trail
      await prisma.auditTrail.create({
        data: {
          userId: session.userId,
          action: "LOGOUT",
          details: `User ${session.username} logged out.`,
        },
      });
    }

    const res = NextResponse.json({ success: true });
    // Explicitly expire the session cookie so the browser clears it
    res.cookies.set("aems_session", "", {
      httpOnly: true,
      secure: process.env.HTTPS === "true",
      sameSite: "strict",
      expires: new Date(0),
      path: "/",
    });

    return res;
  } catch (error) {
    console.error("Logout API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
