import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
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

    if (!clientId || !month) {
      return NextResponse.json({ error: "clientId and month are required" }, { status: 400 });
    }

    if (session.role === "supervisor") {
      const allowed = supervisorClientIds(session);
      if (!allowed || allowed.length === 0 || !allowed.includes(clientId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const salaries = await prisma.salary.findMany({
      where: { clientId, month },
      include: {
        employee: { select: { employeeCode: true, name: true } },
      },
      orderBy: { employee: { employeeCode: "asc" } },
    });

    const headers = ["Employee Code", "Name", "Paid Days", "OT Hours", "Basic Salary", "OT Salary", "Gross Salary"];
    if (client.pfApplicable) headers.push("PF Deduction");
    if (client.esicApplicable) headers.push("ESIC Deduction");
    if (client.ptApplicable) headers.push("PT Deduction");
    headers.push("Advance Deduction", "Other Deductions", "Net Paid");

    const rows = salaries.map((s) => {
      const row: (string | number)[] = [
        s.employee.employeeCode,
        s.employee.name,
        s.paidDays,
        s.otHours,
        s.basicSalary,
        s.otSalary,
        s.grossSalary,
      ];
      if (client.pfApplicable) row.push(s.pfDeduction);
      if (client.esicApplicable) row.push(s.esicDeduction);
      if (client.ptApplicable) row.push(s.ptDeduction);
      row.push(s.advanceDeduction, s.otherDeductions, s.netPaid);
      return row;
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    worksheet["!cols"] = headers.map(() => ({ wch: 16 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${client.name.slice(0, 28)}_${month}`);

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const safeName = client.name.replace(/[^a-z0-9]/gi, "_");
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="salary_${safeName}_${month}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Export Salary Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
