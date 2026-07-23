import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize, supervisorClientIds, isArnavClient } from "@/lib/authorize";

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["approved", "rejected"],
  approved: ["paid", "hold", "rejected"],
  paid: [],
  hold: ["paid", "rejected"],
  rejected: [],
};

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const session = await authorize(["admin", "accountant", "supervisor"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { status } = await request.json();
    const validStatuses = ["pending", "approved", "paid", "hold", "rejected"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const advance = await prisma.advance.findUnique({
      where: { id: params.id },
    });

    if (!advance) {
      return NextResponse.json({ error: "Advance not found" }, { status: 404 });
    }

    // Block non-admin from managing Arnav advances
    if (session.role !== "admin" && await isArnavClient(advance.clientId)) {
      return NextResponse.json({ error: "Forbidden: Cannot modify Arnav Enterprises advances" }, { status: 403 });
    }

    // Supervisor can only manage advances of their clients
    if (session.role === "supervisor") {
      const allowed = supervisorClientIds(session);
      if (!allowed || allowed.length === 0 || !allowed.includes(advance.clientId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!["approved", "rejected"].includes(status)) {
        return NextResponse.json({ error: "Supervisor can only approve or reject" }, { status: 403 });
      }
    }

    // Validate status transition
    const allowedTransitions = VALID_TRANSITIONS[advance.status] || [];
    if (!allowedTransitions.includes(status)) {
      return NextResponse.json(
        { error: `Cannot transition from '${advance.status}' to '${status}'` },
        { status: 400 }
      );
    }

    const updateData: any = { status };

    if (status === "approved") {
      updateData.approvedBy = session.userId;
      updateData.approvedAt = new Date();
    } else if (["paid", "hold", "rejected"].includes(status)) {
      updateData.processedBy = session.userId;
      updateData.processedAt = new Date();
    }

    const updated = await prisma.advance.update({
      where: { id: params.id },
      data: updateData,
    });

    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: `ADVANCE_${status.toUpperCase()}`,
        details: `Advance ${status} for employee ${advance.employeeId} (₹${Math.abs(advance.amount)}).`,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PUT Advance Status Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
