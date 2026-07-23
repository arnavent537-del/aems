import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { authorize } from "@/lib/authorize";

export async function POST(request: Request) {
  try {
    const session = await authorize(["admin", "accountant"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const clientId = form.get("clientId") as string;

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Excel/CSV file is required" }, { status: 400 });
    }

    if (!clientId) {
      return NextResponse.json({ error: "Client ID is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await (file as Blob).arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, any>[];

    if (!rows.length) {
      return NextResponse.json({ error: "No rows found in the uploaded file" }, { status: 400 });
    }

    // Get all employees for this client with their codes
    const employees = await prisma.employee.findMany({
      where: { clientId },
      select: { id: true, employeeCode: true },
    });

    const employeeByCode = new Map(employees.map((e) => [e.employeeCode, e]));

    // Get the client to check PF/ESIC/PT applicability
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { pfApplicable: true, esicApplicable: true, ptApplicable: true },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 400 });
    }

    const created: string[] = [];
    const errors: string[] = [];

    for (const row of rows) {
      const employeeCode = String(row.EmployeeCode || "").trim();
      const month = String(row.Month || "").trim();
      const paidDays = parseFloat(row.PaidDays || "0");
      const basicSalary = parseFloat(row.BasicSalary || "0");

      if (!employeeCode || !month || isNaN(paidDays) || isNaN(basicSalary)) {
        errors.push(`Skipped row ${employeeCode || "(no code)"}: missing required fields (EmployeeCode, Month, PaidDays, BasicSalary).`);
        continue;
      }

      const employee = employeeByCode.get(employeeCode);
      if (!employee) {
        errors.push(`Skipped ${employeeCode}: employee not found in client.`);
        continue;
      }

      // Check if salary record already exists for this employee and month
      const existingSalary = await prisma.salary.findFirst({
        where: {
          employeeId: employee.id,
          month,
        },
      });

      if (existingSalary) {
        errors.push(`Skipped ${employeeCode} (${month}): salary already recorded for this month.`);
        continue;
      }

      const otHours = parseFloat(row.OTHours || "0");
      const otSalary = parseFloat(row.OTSalary || "0");
      const advanceDeduction = parseFloat(row.AdvanceDeduction || "0");
      const otherDeductions = parseFloat(row.OtherDeductions || "0");

      // Calculate deductions based on client rules
      const grossSalary = basicSalary + otSalary;

      let pfDeduction = 0;
      let esicDeduction = 0;
      let ptDeduction = 0;

      if (client.pfApplicable && grossSalary > 15000) {
        pfDeduction = grossSalary * 0.12;
      }

      if (client.esicApplicable && grossSalary <= 21000) {
        esicDeduction = grossSalary * 0.0075;
      }

      if (client.ptApplicable && grossSalary > 25000) {
        ptDeduction = 200; // Professional tax fixed amount
      }

      const netPaid = grossSalary - pfDeduction - esicDeduction - ptDeduction - advanceDeduction - otherDeductions;

      try {
        await prisma.salary.create({
          data: {
            employeeId: employee.id,
            clientId,
            month,
            paidDays,
            otHours,
            basicSalary,
            otSalary,
            grossSalary,
            pfDeduction,
            esicDeduction,
            ptDeduction,
            advanceDeduction,
            otherDeductions,
            netPaid,
            createdBy: session.userId,
          },
        });

        created.push(`${employeeCode} (${month})`);
      } catch (error: any) {
        errors.push(`Failed for ${employeeCode} (${month}): ${error.message}`);
      }
    }

    return NextResponse.json({ created: created.length, records: created, errors }, { status: 201 });
  } catch (error: any) {
    console.error("Bulk Salary Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
