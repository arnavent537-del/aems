import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize, supervisorClientIds, getSelfEmployeeId, isArnavClient } from "@/lib/authorize";
import { getTbkStartDate, getTbkEndDate, getCurrentTbkMonth } from "@/lib/tbkMonth";

const PRESENT = new Set(["P", "P/2", "P-2"]);
const ABSENT = new Set(["A"]);

function dayValue(status: string): number {
  if (status === "PH") return 1;
  if (status === "P") return 1;
  if (status === "P/2" || status === "P-2") return 0.5;
  return 0;
}

export async function GET(request: Request) {
  try {
    const session = await authorize(["admin", "accountant", "supervisor"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let clientId = searchParams.get("clientId");
    const month = searchParams.get("month");

    if (session.role === "supervisor") {
      const allowed = supervisorClientIds(session);
      if (!clientId && allowed && allowed.length > 0) clientId = allowed[0];
      if (!allowed || allowed.length === 0 || (clientId && !allowed.includes(clientId))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (session.role === "employee") {
      const emp = await prisma.employee.findFirst({
        where: { employeeCode: session.username },
        select: { clientId: true },
      });
      clientId = emp?.clientId || null;
    }
    if (!clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    // Arnav self-restriction: filter stats to own records only
    let employeeFilter: any = undefined;
    if (session.role !== "admin" && await isArnavClient(clientId)) {
      const selfEmpId = await getSelfEmployeeId(session);
      if (selfEmpId) {
        employeeFilter = selfEmpId;
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const activeMonth = month || getCurrentTbkMonth();
    const tbkStart = getTbkStartDate(activeMonth);
    const tbkEnd = getTbkEndDate(activeMonth);

    const todayWhere: any = { clientId, date: today };
    const monthWhere: any = { clientId, date: { gte: tbkStart, lte: tbkEnd } };
    if (employeeFilter) {
      todayWhere.employeeId = employeeFilter;
      monthWhere.employeeId = employeeFilter;
    }

    const [todayRecs, monthRecs] = await Promise.all([
      prisma.attendance.findMany({ where: todayWhere }),
      prisma.attendance.findMany({ where: monthWhere }),
    ]);

    const presentToday = todayRecs.reduce((sum, r) => sum + dayValue(r.status), 0);
    const absentToday = todayRecs.filter((r) => ABSENT.has(r.status)).length;
    const presentMonth = monthRecs.reduce((sum, r) => sum + dayValue(r.status), 0);
    const absentMonth = monthRecs.filter((r) => ABSENT.has(r.status)).length;

    return NextResponse.json({ presentToday, absentToday, presentMonth, absentMonth });
  } catch (error) {
    console.error("Attendance Stats Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
