import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { authorize, supervisorClientIds, isArnavClient } from "@/lib/authorize";

// Converts any common date value to YYYY-MM-DD (Advance.date storage format)
function excelDateToYYYYMMDD(val: unknown): string {
  if (!val) return "";
  if (val instanceof Date && !isNaN(val.getTime())) {
    const dd = String(val.getDate()).padStart(2, "0");
    const mm = String(val.getMonth() + 1).padStart(2, "0");
    return `${val.getFullYear()}-${mm}-${dd}`;
  }
  const s = String(val).trim();
  // Excel serial number (integer days since 1900-01-01)
  if (/^\d+$/.test(s) && s.length <= 5) {
    const d = new Date((parseInt(s, 10) - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      return `${d.getFullYear()}-${mm}-${dd}`;
    }
  }
  // YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // DD-MM-YYYY
  m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // DD/MM/YYYY
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return "";
}

export async function POST(request: Request) {
  try {
    const session = await authorize(["admin", "accountant", "supervisor"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const clientId = String(form.get("clientId") || "");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Excel/CSV file is required" }, { status: 400 });
    }
    if (!clientId) {
      return NextResponse.json({ error: "clientId is required" }, { status: 400 });
    }

    if (session.role === "supervisor") {
      const allowed = supervisorClientIds(session);
      if (!allowed || allowed.length === 0 || !allowed.includes(clientId)) {
        return NextResponse.json({ error: "Forbidden: Cannot import advances for this client" }, { status: 403 });
      }
    }

    // Block non-admin users from importing advances in Arnav Enterprises
    if (session.role !== "admin" && await isArnavClient(clientId)) {
      return NextResponse.json({ error: "Forbidden: Cannot import advances for Arnav Enterprises" }, { status: 403 });
    }

    const buffer = Buffer.from(await (file as Blob).arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, any>[];

    if (!rows.length) {
      return NextResponse.json({ error: "No rows found in the uploaded file" }, { status: 400 });
    }

    const employees = await prisma.employee.findMany({
      where: { clientId },
      select: { id: true, employeeCode: true, name: true },
    });
    const byCode = new Map(employees.map((e) => [e.employeeCode.toLowerCase(), e]));
    const byName = new Map(employees.map((e) => [e.name.toLowerCase(), e]));

    const created: string[] = [];
    const errors: string[] = [];

    for (const row of rows) {
      const employeeCode = String(row["Employee Code"] || row.EmployeeCode || row.Employee || "").trim();
      const employeeName = String(row["Employee Name"] || row.EmployeeName || "").trim();
      const date = excelDateToYYYYMMDD(row.Date);
      const amount = parseFloat(row.Amount);
      const type = String(row.Type || "given").trim().toLowerCase() === "recovery" ? "recovery" : "given";
      const remarks = String(row.Remarks || "").trim() || null;

      if (!employeeCode && !employeeName) {
        errors.push(`Skipped row: no Employee Code or Employee Name provided.`);
        continue;
      }
      if (!date) {
        errors.push(`Skipped "${employeeCode || employeeName}": invalid or missing Date.`);
        continue;
      }
      if (isNaN(amount) || amount <= 0) {
        errors.push(`Skipped "${employeeCode || employeeName}": Amount must be a positive number.`);
        continue;
      }

      const emp =
        byCode.get(employeeCode.toLowerCase()) ||
        (employeeName ? byName.get(employeeName.toLowerCase()) : undefined);
      if (!emp) {
        errors.push(`Skipped "${employeeCode || employeeName}": employee not found in this client.`);
        continue;
      }

      await prisma.advance.create({
        data: {
          employeeId: emp.id,
          clientId,
          date,
          amount: type === "recovery" ? -amount : amount,
          type,
          remarks,
          status: "paid",
          createdBy: session.userId,
        },
      });

      created.push(emp.employeeCode);
    }

    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: "BULK_CREATE_ADVANCE",
        details: `Imported ${created.length} advance records for client ID ${clientId}.`,
      },
    });

    return NextResponse.json({ created: created.length, codes: created, errors }, { status: 201 });
  } catch (error: any) {
    console.error("Bulk Advance Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
