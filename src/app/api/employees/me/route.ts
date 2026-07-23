import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize } from "@/lib/authorize";

export async function GET() {
  try {
    const session = await authorize(["employee"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const employee = await prisma.employee.findFirst({
      where: { phoneNo: session.username },
      include: { client: { select: { name: true } } },
    });

    if (!employee) {
      return NextResponse.json({ error: "No employee record linked to this account" }, { status: 403 });
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error("Employee Me Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
