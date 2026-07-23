import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize, supervisorClientIds, getSelfEmployeeId, isArnavClient } from "@/lib/authorize";
import { computePayroll, round2 } from "@/lib/payroll";

export async function GET(request: Request) {
  try {
    const session = await authorize(["admin", "accountant", "supervisor", "employee"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const month = searchParams.get("month");
    const employeeId = searchParams.get("employeeId");

    const whereClause: any = {};

    if (session.role === "employee") {
      const emp = await prisma.employee.findFirst({
        where: { employeeCode: session.username },
        select: { id: true, clientId: true },
      });
      if (!emp) {
        return NextResponse.json({ error: "No employee record linked to this account" }, { status: 403 });
      }
      whereClause.clientId = emp.clientId;
      whereClause.employeeId = emp.id;
    } else {
      if (!clientId) {
        return NextResponse.json({ error: "clientId is required" }, { status: 400 });
      }
      whereClause.clientId = clientId;
      if (employeeId) whereClause.employeeId = employeeId;
      if (session.role === "supervisor") {
        const allowed = supervisorClientIds(session);
        if (!allowed || allowed.length === 0 || !allowed.includes(clientId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      // Arnav self-restriction for non-admin users
      if (session.role !== "admin" && await isArnavClient(clientId)) {
        const selfEmpId = await getSelfEmployeeId(session);
        if (selfEmpId) {
          whereClause.employeeId = selfEmpId;
        } else {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    if (month) whereClause.month = month;

    const salaries = await prisma.salary.findMany({
      where: whereClause,
      include: {
        employee: {
          select: { employeeCode: true, name: true, salaryRate: true, otRateMultiplier: true },
        },
        client: {
          select: { name: true, pfApplicable: true, esicApplicable: true, ptApplicable: true },
        },
      },
      orderBy: { employee: { employeeCode: "asc" } },
    });

    return NextResponse.json(salaries);
  } catch (error: any) {
    console.error("GET Salaries Error:", error);
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
    const {
      employeeId,
      clientId,
      month,
      paidDays,
      otHours,
      basicSalary,
      otSalary,
      advanceDeduction,
      otherDeductions,
    } = body;

    if (!employeeId || !clientId || !month) {
      return NextResponse.json(
        { error: "employeeId, clientId, month are required" },
        { status: 400 }
      );
    }

    // Block non-admin from creating salaries in Arnav
    if (session.role !== "admin" && await isArnavClient(clientId)) {
      return NextResponse.json({ error: "Forbidden: Cannot create salary records for Arnav Enterprises" }, { status: 403 });
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const basic = parseFloat(basicSalary);
    const ot = parseFloat(otSalary);
    const adv = parseFloat(advanceDeduction || 0);
    const other = parseFloat(otherDeductions || 0);

    if (isNaN(basic) || isNaN(ot)) {
      return NextResponse.json({ error: "basicSalary and otSalary must be numbers" }, { status: 400 });
    }

    const payroll = computePayroll(
      { basicSalary: basic, otSalary: ot, clientRules: client },
      round2(Math.abs(adv)),
      round2(Math.abs(other))
    );

    const salary = await prisma.salary.upsert({
      where: { employeeId_month: { employeeId, month } },
      update: {
        paidDays: parseFloat(paidDays),
        otHours: parseFloat(otHours || 0),
        basicSalary: basic,
        otSalary: ot,
        grossSalary: payroll.grossSalary,
        pfDeduction: payroll.pfDeduction,
        esicDeduction: payroll.esicDeduction,
        ptDeduction: payroll.ptDeduction,
        advanceDeduction: payroll.advanceDeduction,
        otherDeductions: payroll.otherDeductions,
        netPaid: payroll.netPaid,
        createdBy: session.userId,
      },
      create: {
        employeeId,
        clientId,
        month,
        paidDays: parseFloat(paidDays),
        otHours: parseFloat(otHours || 0),
        basicSalary: basic,
        otSalary: ot,
        grossSalary: payroll.grossSalary,
        pfDeduction: payroll.pfDeduction,
        esicDeduction: payroll.esicDeduction,
        ptDeduction: payroll.ptDeduction,
        advanceDeduction: payroll.advanceDeduction,
        otherDeductions: payroll.otherDeductions,
        netPaid: payroll.netPaid,
        createdBy: session.userId,
      },
      include: { employee: { select: { employeeCode: true, name: true } } },
    });

    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: "CREATE_SALARY",
        details: `Recorded salary for employee ${employeeId} for ${month}. Net paid: ${payroll.netPaid}.`,
      },
    });

    return NextResponse.json(salary, { status: 201 });
  } catch (error: any) {
    console.error("POST Salary Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
