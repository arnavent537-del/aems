import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize, supervisorClientIds, getSelfEmployeeId, isArnavClient } from "@/lib/authorize";
import { round2 } from "@/lib/payroll";

export async function GET(request: Request) {
  try {
    const session = await authorize(["admin", "accountant", "supervisor", "employee"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const clientId = searchParams.get("clientId");
    const statusFilter = searchParams.get("status");

    if (!employeeId && !clientId) {
      return NextResponse.json({ error: "employeeId or clientId is required" }, { status: 400 });
    }

    const whereClause: any = {};

    if (session.role === "employee") {
      const emp = await prisma.employee.findFirst({
        where: { phoneNo: session.username },
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
      if (clientId) {
        if (!allowed.includes(clientId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        whereClause.clientId = clientId;
      } else {
        whereClause.clientId = { in: allowed };
      }
      if (employeeId) whereClause.employeeId = employeeId;

      // Arnav self-restriction for supervisor
      if (whereClause.clientId && !(typeof whereClause.clientId === "object" && "in" in whereClause.clientId)) {
        if (await isArnavClient(whereClause.clientId)) {
          const selfEmpId = await getSelfEmployeeId(session);
          if (selfEmpId) {
            whereClause.employeeId = selfEmpId;
          } else {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
          }
        }
      } else if (typeof whereClause.clientId === "object" && "in" in whereClause.clientId) {
        // Filter Arnav out and handle self separately
        const arnavClient = await prisma.client.findUnique({ where: { name: "Arnav Enterprises" }, select: { id: true } });
        if (arnavClient) {
          const selfEmpId = await getSelfEmployeeId(session);
          if (selfEmpId) {
            // Include Arnav records only for self + other clients
            whereClause.OR = [
              { clientId: { in: whereClause.clientId.in.filter((id: string) => id !== arnavClient.id) }, employeeId: undefined },
              { clientId: arnavClient.id, employeeId: selfEmpId },
            ];
            delete whereClause.clientId;
            delete whereClause.employeeId;
          } else {
            whereClause.clientId.in = whereClause.clientId.in.filter((id: string) => id !== arnavClient.id);
            if (whereClause.clientId.in.length === 0) return NextResponse.json([]);
          }
        }
      }
    } else if (clientId) {
      whereClause.clientId = clientId;
    }

    if (employeeId && session.role !== "employee") {
      whereClause.employeeId = employeeId;
    }

    // Arnav self-restriction for accountants
    if (session.role === "accountant" && clientId && await isArnavClient(clientId)) {
      const selfEmpId = await getSelfEmployeeId(session);
      if (selfEmpId) {
        whereClause.employeeId = selfEmpId;
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (statusFilter) {
      whereClause.status = statusFilter;
    }

    const advances = await prisma.advance.findMany({
      where: whereClause,
      include: {
        employee: { select: { employeeCode: true, name: true } },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });

    const balances: Record<string, number> = {};
    const ledger = advances.map((a) => {
      const signed = a.type === "recovery" ? -Math.abs(a.amount) : Math.abs(a.amount);
      balances[a.employeeId] = round2((balances[a.employeeId] || 0) + signed);
      return { ...a, signedAmount: signed, runningBalance: balances[a.employeeId] };
    });

    return NextResponse.json(ledger);
  } catch (error: any) {
    console.error("GET Advances Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await authorize(["admin", "accountant", "supervisor", "employee"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    let { employeeId, clientId, date, amount, type, remarks } = body;

    // Employees create pending requests; they cannot specify employeeId/clientId
    if (session.role === "employee") {
      const emp = await prisma.employee.findFirst({
        where: { phoneNo: session.username },
        select: { id: true, clientId: true },
      });
      if (!emp) {
        return NextResponse.json({ error: "No employee record linked to this account" }, { status: 403 });
      }
      employeeId = emp.id;
      clientId = emp.clientId;
      type = "given";
    }

    if (!employeeId || !clientId || !date || amount === undefined || !type) {
      return NextResponse.json(
        { error: "employeeId, clientId, date, amount, type are required" },
        { status: 400 }
      );
    }

    if (session.role === "supervisor") {
      const allowed = supervisorClientIds(session);
      if (!allowed || allowed.length === 0 || !allowed.includes(clientId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Block non-admin users from creating advances in Arnav Enterprises
    if (session.role !== "employee" && session.role !== "admin" && await isArnavClient(clientId)) {
      return NextResponse.json({ error: "Forbidden: Cannot create advances for Arnav Enterprises" }, { status: 403 });
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
    }

    const [empRecord, clientRecord] = await Promise.all([
      prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } }),
      prisma.client.findUnique({ where: { id: clientId }, select: { id: true } }),
    ]);
    if (!empRecord) {
      return NextResponse.json({ error: "Employee not found" }, { status: 400 });
    }
    if (!clientRecord) {
      return NextResponse.json({ error: "Client not found" }, { status: 400 });
    }

    const storedAmount = type === "recovery" ? -numericAmount : numericAmount;
    const status = session.role === "employee" ? "pending" : "paid";

    const advance = await prisma.advance.create({
      data: {
        employeeId,
        clientId,
        date,
        amount: storedAmount,
        type,
        status,
        remarks: remarks || null,
        createdBy: session.userId,
      },
    });

    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: "CREATE_ADVANCE",
        details: `Recorded ${status === "pending" ? "advance request" : type} of ${numericAmount} for employee ${employeeId} on ${date}.`,
      },
    });

    return NextResponse.json(advance, { status: 201 });
  } catch (error: any) {
    console.error("POST Advance Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
