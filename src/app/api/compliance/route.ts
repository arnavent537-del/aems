import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize, supervisorClientIds } from "@/lib/authorize";

export async function GET(request: Request) {
  try {
    const session = await authorize(["admin", "accountant", "supervisor"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const month = searchParams.get("month");

    const whereClause: any = {};
    if (session.role === "supervisor") {
      const allowed = supervisorClientIds(session);
      if (!allowed || allowed.length === 0) {
        return NextResponse.json([]);
      }
      if (clientId) {
        if (!allowed.includes(clientId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        whereClause.clientId = clientId;
      } else {
        whereClause.clientId = { in: allowed };
      }
    } else if (clientId) {
      whereClause.clientId = clientId;
    }
    if (month) whereClause.month = month;

    const compliance = await prisma.compliance.findMany({
      where: whereClause,
      include: { client: { select: { name: true } } },
      orderBy: [{ month: "desc" }, { client: { name: "asc" } }],
    });

    return NextResponse.json(compliance);
  } catch (error: any) {
    console.error("GET Compliance Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await authorize(["admin", "accountant"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { clientId, month } = body;

    if (!clientId || !month) {
      return NextResponse.json({ error: "clientId and month are required" }, { status: 400 });
    }

    const existing = await prisma.compliance.findUnique({
      where: { clientId_month: { clientId, month } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Compliance record for this client and month already exists" },
        { status: 400 }
      );
    }

    const compliance = await prisma.compliance.create({
      data: {
        clientId,
        month,
      },
    });

    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: "CREATE_COMPLIANCE",
        details: `Created compliance record for client ${clientId} for ${month}.`,
      },
    });

    return NextResponse.json(compliance, { status: 201 });
  } catch (error: any) {
    console.error("POST Compliance Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
