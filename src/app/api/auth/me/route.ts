import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    let extra: { employeeId?: string; clientId?: string; name?: string } = {};
    if (session.role === "employee") {
      const emp = await prisma.employee.findFirst({
        where: { phoneNo: session.username },
        select: { id: true, clientId: true, name: true },
      });
      if (emp) extra = { employeeId: emp.id, clientId: emp.clientId, name: emp.name };
    } else {
      // For staff users (admin/accountant/supervisor), return linked employeeId
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { employeeId: true },
      });
      extra = { employeeId: user?.employeeId ?? undefined, name: session.username };
    }

    return NextResponse.json({
      success: true,
      user: {
        ...session,
        ...extra,
        assignedClientIds: session.assignedClientIds || []
      },
    });
  } catch (error) {
    console.error("Auth Me API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
