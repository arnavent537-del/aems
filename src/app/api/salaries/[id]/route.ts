import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize } from "@/lib/authorize";
import { computePayroll, round2 } from "@/lib/payroll";

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const session = await authorize(["admin", "accountant"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const existing = await prisma.salary.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Salary record not found" }, { status: 404 });
    }

    const client = await prisma.client.findUnique({ where: { id: existing.clientId } });

    const basic = body.basicSalary !== undefined ? parseFloat(body.basicSalary) : existing.basicSalary;
    const ot = body.otSalary !== undefined ? parseFloat(body.otSalary) : existing.otSalary;
    const adv = body.advanceDeduction !== undefined ? parseFloat(body.advanceDeduction || 0) : existing.advanceDeduction;
    const other =
      body.otherDeductions !== undefined ? parseFloat(body.otherDeductions || 0) : existing.otherDeductions;

    const payroll = computePayroll(
      { basicSalary: basic, otSalary: ot, clientRules: client! },
      round2(Math.abs(adv)),
      round2(Math.abs(other))
    );

    const updated = await prisma.salary.update({
      where: { id: params.id },
      data: {
        paidDays: body.paidDays !== undefined ? parseFloat(body.paidDays) : existing.paidDays,
        otHours: body.otHours !== undefined ? parseFloat(body.otHours || 0) : existing.otHours,
        basicSalary: basic,
        otSalary: ot,
        grossSalary: payroll.grossSalary,
        pfDeduction: payroll.pfDeduction,
        esicDeduction: payroll.esicDeduction,
        ptDeduction: payroll.ptDeduction,
        advanceDeduction: payroll.advanceDeduction,
        otherDeductions: payroll.otherDeductions,
        netPaid: payroll.netPaid,
      },
    });

    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: "UPDATE_SALARY",
        details: `Updated salary record ${params.id} for ${existing.month}. Net paid: ${payroll.netPaid}.`,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PUT Salary Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const session = await authorize(["admin", "accountant"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await prisma.salary.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Salary record not found" }, { status: 404 });
    }

    await prisma.salary.delete({ where: { id: params.id } });

    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: "DELETE_SALARY",
        details: `Deleted salary record ${params.id}.`,
      },
    });

    return NextResponse.json({ success: true, message: "Salary record deleted" });
  } catch (error: any) {
    console.error("DELETE Salary Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
