import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize } from "@/lib/authorize";

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const session = await authorize(["admin", "accountant"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const advance = await prisma.advance.findUnique({ where: { id: params.id } });
    if (!advance) {
      return NextResponse.json({ error: "Advance record not found" }, { status: 404 });
    }

    if (session.role === "supervisor" && advance.clientId !== session.assignedClientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.advance.delete({ where: { id: params.id } });

    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: "DELETE_ADVANCE",
        details: `Deleted advance record ${params.id}.`,
      },
    });

    return NextResponse.json({ success: true, message: "Advance record deleted" });
  } catch (error: any) {
    console.error("DELETE Advance Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
