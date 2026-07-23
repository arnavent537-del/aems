import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { authorize, supervisorClientIds } from "@/lib/authorize";

const PRESENT = new Set(["P", "P/2", "P-2"]);

function dayValue(status: string): number {
  if (status === "PH") return 1;
  if (status === "P") return 1;
  if (status === "P/2" || status === "P-2") return 0.5;
  return 0;
}

export async function GET(request: Request) {
  try {
    const session = await authorize(["admin", "accountant", "supervisor"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let clientId = searchParams.get("clientId");
    const month = searchParams.get("month");

    if (session.role === "supervisor") {
      const allowed = supervisorClientIds(session);
      if (!clientId && allowed && allowed.length > 0) clientId = allowed[0];
      if (!allowed || allowed.length === 0 || (clientId && !allowed.includes(clientId))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
    if (!clientId || !month) {
      return NextResponse.json({ error: "clientId and month are required" }, { status: 400 });
    }

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const [y, m] = month.split("-").map(Number);
    const dayCount = new Date(y, m, 0).getDate();

    const employees = await prisma.employee.findMany({
      where: { clientId, dateOfExit: null },
      orderBy: { employeeCode: "asc" },
    });
    const recs = await prisma.attendance.findMany({
      where: { clientId, date: { startsWith: month + "-" } },
    });

    const map = new Map<string, { status: string; otHours: number; workHours: number | null }>();
    for (const r of recs) {
      map.set(`${r.employeeId}__${r.date}`, { status: r.status, otHours: r.otHours, workHours: r.workHours ?? null });
    }

    const headers = [
      "Employee Code",
      "Name",
      ...Array.from({ length: dayCount }, (_, i) => String(i + 1)),
      "Days Present",
      "OT Hours",
    ];

    const rows = employees.map((e) => {
      let present = 0;
      let ot = 0;
      const row: (string | number)[] = [e.employeeCode, e.name];
      for (let d = 1; d <= dayCount; d++) {
        const ds = `${month}-${String(d).padStart(2, "0")}`;
        const rec = map.get(`${e.id}__${ds}`);
        const st = rec ? rec.status : "";
        row.push(st);
        present += dayValue(st);
        ot += rec ? rec.otHours || 0 : 0;
      }
      row.push(present, Math.round(ot * 100) / 100);
      return row;
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    worksheet["!cols"] = headers.map((h) => ({ wch: h.length > 3 ? 12 : 6 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${client.name.slice(0, 20)}_${month}`);

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const safeName = client.name.replace(/[^a-z0-9]/gi, "_");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="attendance_${safeName}_${month}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Export Attendance Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
