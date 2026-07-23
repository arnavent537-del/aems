import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize, supervisorClientIds, getSelfEmployeeId } from "@/lib/authorize";

export async function GET(request: Request) {
  try {
    const session = await authorize(["admin", "accountant", "supervisor"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    const where: any = {};
    if (session.role === "supervisor") {
      const allowed = supervisorClientIds(session);
      if (!allowed || allowed.length === 0) return NextResponse.json([]);
      where.clientId = { in: allowed };
    }

    // Arnav self-restriction for non-admin users: only show own salaries
    if (session.role !== "admin") {
      const selfEmpId = await getSelfEmployeeId(session);
      if (selfEmpId) {
        where.employeeId = selfEmpId;
      }
    }

    if (month) where.month = month;

    const salaries = await prisma.salary.findMany({
      where,
      include: { client: { select: { name: true } } },
    });

    const byClient: Record<string, { clientId: string; name: string; grossSalary: number; netPaid: number; count: number }> = {};
    for (const s of salaries) {
      if (!byClient[s.clientId]) {
        byClient[s.clientId] = { clientId: s.clientId, name: s.client?.name || "", grossSalary: 0, netPaid: 0, count: 0 };
      }
      byClient[s.clientId].grossSalary += s.grossSalary;
      byClient[s.clientId].netPaid += s.netPaid;
      byClient[s.clientId].count += 1;
    }

    const result = Object.values(byClient).map((c) => ({
      ...c,
      grossSalary: Math.round(c.grossSalary * 100) / 100,
      netPaid: Math.round(c.netPaid * 100) / 100,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Salary Summary Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
