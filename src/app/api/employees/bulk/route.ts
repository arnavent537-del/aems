import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { authorize } from "@/lib/authorize";
import { generateEmployeeCode } from "@/lib/employeeCodeGenerator";

export async function POST(request: Request) {
  try {
    const session = await authorize(["admin", "accountant"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Excel/CSV file is required" }, { status: 400 });
    }

    function excelDateToDDMMYYYY(val: unknown): string {
      if (!val) return "";
      if (val instanceof Date && !isNaN(val.getTime())) {
        const dd = String(val.getDate()).padStart(2, "0");
        const mm = String(val.getMonth() + 1).padStart(2, "0");
        const yyyy = val.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
      }
      const s = String(val).trim();
      // Handle Excel serial number (integer days since 1900-01-01)
      if (/^\d+$/.test(s) && s.length <= 5) {
        const d = new Date((parseInt(s, 10) - 25569) * 86400 * 1000);
        if (!isNaN(d.getTime())) {
          const dd = String(d.getDate()).padStart(2, "0");
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const yyyy = d.getFullYear();
          return `${dd}-${mm}-${yyyy}`;
        }
      }
      // Convert YYYY-MM-DD → DD-MM-YYYY
      let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return `${m[3]}-${m[2]}-${m[1]}`;
      // Convert DD/MM/YYYY → DD-MM-YYYY
      m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) return `${m[1]}-${m[2]}-${m[3]}`;
      // Convert YYYY/MM/DD → DD-MM-YYYY
      m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
      if (m) return `${m[3]}-${m[2]}-${m[1]}`;
      return s;
    }

    const buffer = Buffer.from(await (file as Blob).arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, any>[];

    if (!rows.length) {
      return NextResponse.json({ error: "No rows found in the uploaded file" }, { status: 400 });
    }

    const clients = await prisma.client.findMany();
    const clientByName = new Map(clients.map((c) => [c.name.toLowerCase(), c]));

    const created: string[] = [];
    const errors: string[] = [];

    for (const row of rows) {
      // Required fields
      const clientName = String(row.Client || "").trim();
      const name = String(row.Name || "").trim();
      const dateOfJoining = excelDateToDDMMYYYY(row.DateOfJoining);
      const salaryRate = parseFloat(row.SalaryRate || "0");

      if (!clientName || !name || !dateOfJoining || isNaN(salaryRate)) {
        errors.push(`Skipped "${name || "(no name)"}": missing required fields (Client, Name, DateOfJoining, SalaryRate).`);
        continue;
      }

      const client = clientByName.get(clientName.toLowerCase());
      if (!client) {
        errors.push(`Skipped "${name}": client "${clientName}" not found.`);
        continue;
      }

      // Employee Code - use provided or auto-generate based on client
      const providedCode = String(row.EmployeeCode || "").trim();
      const employeeCode = providedCode || (await generateEmployeeCode(client.id));

      // Parse Uniform/Safety Apron field
      const uniformValue = String(row.Unifrom || row.Uniform || "").trim().toLowerCase();
      const safetyApronIssued = uniformValue === "yes" || uniformValue === "true" || uniformValue === "1";

      // Parse Date of Exit
      const dateOfExit = excelDateToDDMMYYYY(row.DateofExit || row.DateOfExit) || null;

      await prisma.employee.create({
        data: {
          employeeCode,
          clientId: client.id,
          name,
          gender: String(row.Gender || "").trim() || null,
          dob: excelDateToDDMMYYYY(row.DOB),
          dateOfJoining,
          phoneNo: String(row.MobileNo || row.MobileNo || "").trim() || null,
          address: String(row.Address || "").trim(),
          salaryRate,
          otRateMultiplier: parseFloat(row.OTRate || "2.0") || 2.0,
          aadharNo: String(row.Aadhar_No || row.AadharNo || "").trim() || null,
          panNo: String(row.PAN_No || row.PANNo || "").trim() || null,
          bankAccountNo: String(row.BankAccountNo || row.BankAccount || "").trim() || null,
          ifscCode: String(row.IFSC_Code || row.IFSCCode || "").trim() || null,
          bankName: String(row.BankName || row.Bank || "").trim() || null,
          branch: String(row.Branch || "").trim() || null,
          esicNo: String(row.ESIC_No || row.ESICNo || "").trim() || null,
          uanNo: String(row.UAN_No || row.UANNo || "").trim() || null,
          safetyApronIssued,
          documentStatus: String(row.DocumentStatus || "").trim() || "Pending",
          dateOfExit,
          exitReason: dateOfExit ? String(row.ExitReason || "").trim() || null : null,
          status: dateOfExit ? "Left" : "Active",
        },
      });

      created.push(employeeCode);
    }

    return NextResponse.json({ created: created.length, codes: created, errors }, { status: 201 });
  } catch (error: any) {
    console.error("Bulk Employee Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
