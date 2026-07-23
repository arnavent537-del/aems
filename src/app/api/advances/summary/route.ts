import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize, supervisorClientIds, getSelfEmployeeId } from "@/lib/authorize";

export async function GET(_request: Request) {
  try {
    const session = await authorize(["admin", "accountant", "supervisor"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const where: any = { status: "paid" };
    if (session.role === "supervisor") {
      const allowed = supervisorClientIds(session);
      if (!allowed || allowed.length === 0) return NextResponse.json([]);
      where.clientId = { in: allowed };
    }

    // Arnav self-restriction for non-admin users: only show own advances
    if (session.role !== "admin") {
      const selfEmpId = await getSelfEmployeeId(session);
      if (selfEmpId) {
        where.employeeId = selfEmpId;
      }
    }

    const advances = await prisma.advance.findMany({
      where,
      include: { client: { select: { name: true } } },
    });

    const byClient: Record<string, { clientId: string; name: string; outstanding: number }> = {};
    for (const a of advances) {
      const signed = a.type === "recovery" ? -Math.abs(a.amount) : Math.abs(a.amount);
      if (!byClient[a.clientId]) {
        byClient[a.clientId] = { clientId: a.clientId, name: a.client?.name || "", outstanding: 0 };
      }
      byClient[a.clientId].outstanding += signed;
    }

    const result = Object.values(byClient).map((c) => ({
      ...c,
      outstanding: Math.round(c.outstanding * 100) / 100,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Advance Summary Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
