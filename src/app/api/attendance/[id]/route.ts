import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize, isArnavClient } from "@/lib/authorize";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authorize(["admin", "accountant"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { inTime, outTime } = body;

    const record = await prisma.attendance.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, clientId: true, name: true, client: { select: { id: true, name: true } } },
        },
      },
    });

    if (!record) {
      return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
    }

    // Only allow editing Arnav Enterprises attendance
    if (record.employee.client.name !== "Arnav Enterprises") {
      return NextResponse.json({ error: "Time reset is only available for Arnav Enterprises attendance" }, { status: 403 });
    }

    // Non-admin accountants are restricted to self-view in Arnav
    if (session.role !== "admin" && await isArnavClient(record.employee.clientId)) {
      return NextResponse.json({ error: "Forbidden: Only admin can reset Arnav times" }, { status: 403 });
    }

    const finalInTime = inTime !== undefined ? (inTime || null) : record.inTime;
    const finalOutTime = outTime !== undefined ? (outTime || null) : record.outTime;

    // Recalculate work hours if both times are present
    let workHours: number | null = record.workHours;
    if (finalInTime && finalOutTime) {
      workHours = calculateWorkHours(finalInTime, finalOutTime);
    } else if (inTime !== undefined || outTime !== undefined) {
      workHours = null;
    }

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        inTime: finalInTime,
        outTime: finalOutTime,
        workHours,
      },
      include: { employee: { select: { name: true } } },
    });

    // Audit trail
    const systemUser = await prisma.user.findFirst({ where: { role: "admin" } });
    if (systemUser) {
      await prisma.auditTrail.create({
        data: {
          userId: systemUser.id,
          action: "UPDATE_ATTENDANCE_TIME",
          details: `Reset times for ${record.employee.name} on ${record.date}: inTime=${finalInTime}, outTime=${finalOutTime}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      inTime: updated.inTime,
      outTime: updated.outTime,
      workHours: updated.workHours,
    });
  } catch (error: any) {
    console.error("Update Attendance Time Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function calculateWorkHours(inTime: string, outTime: string): number | null {
  try {
    const [inHour, inMinute] = inTime.split(":").map(Number);
    const [outHour, outMinute] = outTime.split(":").map(Number);
    const inMinutes = inHour * 60 + inMinute;
    const outMinutes = outHour * 60 + outMinute;
    const diffMinutes = outMinutes - inMinutes;
    if (diffMinutes < 0) return 0;
    return Math.round((diffMinutes / 60) * 100) / 100;
  } catch {
    return null;
  }
}
