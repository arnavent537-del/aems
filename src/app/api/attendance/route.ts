import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize, supervisorClientIds, getSelfEmployeeId, isArnavClient } from "@/lib/authorize";
import { getTbkStartDate, getTbkEndDate } from "@/lib/tbkMonth";

// GET: Fetch attendance records for a client and date/month
export async function GET(request: Request) {
  try {
    const session = await authorize(["admin", "accountant", "supervisor", "employee"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date"); // YYYY-MM-DD
    const month = searchParams.get("month"); // YYYY-MM
    const employeeId = searchParams.get("employeeId");
    const clientId = searchParams.get("clientId");

    const whereClause: any = {};

    if (session.role === "employee") {
      const emp = await prisma.employee.findUnique({
        where: { id: session.userId },
        select: { id: true, clientId: true },
      });
      if (!emp) {
        return NextResponse.json({ error: "No employee record linked to this account" }, { status: 403 });
      }
      whereClause.clientId = emp.clientId;
      whereClause.employeeId = emp.id;
    } else if (session.role === "supervisor") {
      const allowed = supervisorClientIds(session);
      if (!allowed || allowed.length === 0) {
        return NextResponse.json([]);
      }
      if (clientId && !allowed.includes(clientId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      whereClause.clientId = clientId ?? { in: allowed };
      if (employeeId) whereClause.employeeId = employeeId;

      // Arnav self-restriction for supervisor in Arnav
      if (clientId && await isArnavClient(clientId)) {
        const selfEmpId = await getSelfEmployeeId(session);
        if (selfEmpId) {
          whereClause.employeeId = selfEmpId;
        } else {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    } else {
      if (!clientId) {
        return NextResponse.json({ error: "clientId is required" }, { status: 400 });
      }
      whereClause.clientId = clientId;
      if (employeeId) whereClause.employeeId = employeeId;

      // Arnav self-restriction for accountants
      if (session.role !== "admin" && await isArnavClient(clientId)) {
        const selfEmpId = await getSelfEmployeeId(session);
        if (selfEmpId) {
          whereClause.employeeId = selfEmpId;
        } else {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    if (date) {
      whereClause.date = date;
    } else if (month) {
      // Find records in TBK month date range (26th to 25th)
      const tbkStart = getTbkStartDate(month);
      const tbkEnd = getTbkEndDate(month);
      whereClause.date = {
        gte: tbkStart,
        lte: tbkEnd,
      };
    } else {
      return NextResponse.json({ error: "date or month parameter is required" }, { status: 400 });
    }

    // Get attendance records
    const attendanceRecords = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            employeeCode: true,
            name: true,
            dateOfExit: true,
          },
        },
      },
      orderBy: [
        { date: "asc" },
        { employee: { employeeCode: "asc" } },
      ],
    });

    // Filter out exited employees for supervisors just in case (though they shouldn't have active records anyway)
    const filteredRecords = session.role === "supervisor"
      ? attendanceRecords.filter(r => r.employee.dateOfExit === null)
      : attendanceRecords;

    return NextResponse.json(filteredRecords);
  } catch (error) {
    console.error("GET Attendance Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Bulk upsert attendance records
export async function POST(request: Request) {
  try {
    const session = await authorize(["admin", "accountant", "supervisor"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.role === "employee") {
      return NextResponse.json({ error: "Forbidden: employees cannot modify attendance" }, { status: 403 });
    }

    const body = await request.json();
    const { clientId, records } = body; // records: Array of { employeeId, date, status, otHours }

    if (!clientId || !records || !Array.isArray(records)) {
      return NextResponse.json({ error: "clientId and records array are required" }, { status: 400 });
    }

    // Supervisor boundary check
    if (session.role === "supervisor") {
      const allowed = supervisorClientIds(session);
      if (!allowed || allowed.length === 0 || !allowed.includes(clientId)) {
        return NextResponse.json({ error: "Forbidden: Cannot record attendance for this client" }, { status: 403 });
      }
    }

    // Block non-admin users from creating attendance records in Arnav Enterprises
    if (session.role !== "admin" && await isArnavClient(clientId)) {
      return NextResponse.json({ error: "Forbidden: Cannot modify attendance for Arnav Enterprises" }, { status: 403 });
    }

    // Bulk upsert records using Prisma transaction
    const upserts = records.map((record) => {
      const otHours = parseFloat(record.otHours || 0.0);
      const workHours = record.workHours !== undefined && record.workHours !== null && record.workHours !== ""
        ? parseFloat(record.workHours)
        : null;
      return prisma.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: record.employeeId,
            date: record.date,
          },
        },
        update: {
          status: record.status,
          otHours: otHours,
          workHours: workHours,
          createdBy: session.userId,
        },
        create: {
          employeeId: record.employeeId,
          clientId: clientId,
          date: record.date,
          status: record.status,
          otHours: otHours,
          workHours: workHours,
          createdBy: session.userId,
        },
      });
    });

    await prisma.$transaction(upserts);

    // Log to audit trail
    const recordCount = records.length;
    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: "RECORD_ATTENDANCE",
        details: `Saved ${recordCount} attendance records for client ID ${clientId} on/for date/month context.`,
      },
    });

    return NextResponse.json({ success: true, count: recordCount });
  } catch (error: any) {
    console.error("POST Attendance Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
