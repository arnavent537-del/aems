import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize } from "@/lib/authorize";
import { hashPassword } from "@/lib/auth";

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

    const { password } = await request.json();

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: params.id },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id: params.id },
      data: { passwordHash: hashPassword(password) },
    });

    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: "RESET_EMPLOYEE_PASSWORD",
        details: `Reset password for employee ${updatedEmployee.name} (${updatedEmployee.employeeCode}).`,
      },
    });

    return NextResponse.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error("PUT Reset Employee Password Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
