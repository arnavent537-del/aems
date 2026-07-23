import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { authorize } from "@/lib/authorize";

export async function GET(request: Request) {
  try {
    const session = await authorize(["admin", "accountant"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");

    const whereClause: any = {};
    if (clientId) {
      whereClause.clientId = clientId;
    }

    const employees = await prisma.employee.findMany({
      where: whereClause,
      include: {
        client: {
          select: { name: true },
        },
      },
      orderBy: { employeeCode: "asc" },
    });

    const rows = employees.map((e) => ({
      Client: e.client?.name || "",
      EmployeeCode: e.employeeCode,
      Name: e.name,
      Gender: e.gender || "",
      DOB: e.dob,
      DateOfJoining: e.dateOfJoining,
      MobileNo: e.phoneNo || "",
      Address: e.address,
      SalaryRate: e.salaryRate,
      OTRate: e.otRateMultiplier,
      Aadhar_No: e.aadharNo || "",
      PAN_No: e.panNo || "",
      BankAccountNo: e.bankAccountNo || "",
      IFSC_Code: e.ifscCode || "",
      BankName: e.bankName || "",
      Branch: e.branch || "",
      ESIC_No: e.esicNo || "",
      UAN_No: e.uanNo || "",
      PF_No: e.pfNo || "",
      Uniform: e.safetyApronIssued ? "Yes" : "No",
      DocumentStatus: e.documentStatus,
      DateofExit: e.dateOfExit || "",
      ExitReason: e.exitReason || "",
      Status: e.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const clientName = clientId
      ? employees[0]?.client?.name || "AllClients"
      : "AllClients";
    const fileName = `Employees_${clientName}_${new Date().toISOString().split("T")[0]}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Export Employees Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
