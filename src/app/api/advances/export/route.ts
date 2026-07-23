import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { authorize, supervisorClientIds } from "@/lib/authorize";
import { round2 } from "@/lib/payroll";

export async function GET(request: Request) {
  try {
    const session = await authorize(["admin", "accountant", "supervisor"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");
    const clientId = searchParams.get("clientId");

    if (!employeeId && !clientId) {
      return NextResponse.json({ error: "employeeId or clientId is required" }, { status: 400 });
    }

    const whereClause: any = {};
    if (session.role === "supervisor") {
      const allowed = supervisorClientIds(session);
      if (!allowed || allowed.length === 0 || (clientId && !allowed.includes(clientId))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      whereClause.clientId = clientId ?? { in: allowed };
    } else if (clientId) {
      whereClause.clientId = clientId;
    }
    if (employeeId) whereClause.employeeId = employeeId;

    const advances = await prisma.advance.findMany({
      where: whereClause,
      include: {
        employee: { select: { employeeCode: true, name: true } },
        client: { select: { name: true } },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });

    const headers = [
      "Date",
      "Employee Code",
      "Employee Name",
      "Client",
      "Type",
      "Amount",
      "Running Balance",
      "Remarks",
    ];

    let runningBalance = 0;
    const rows = advances.map((a) => {
      const signed = a.type === "recovery" ? -Math.abs(a.amount) : Math.abs(a.amount);
      runningBalance = round2(runningBalance + signed);
      return [
        a.date,
        a.employee.employeeCode,
        a.employee.name,
        a.client.name,
        a.type,
        Math.abs(a.amount),
        runningBalance,
        a.remarks || "",
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    worksheet["!cols"] = headers.map(() => ({ wch: 18 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Advance_Ledger");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="advance_ledger.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Export Advance Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
