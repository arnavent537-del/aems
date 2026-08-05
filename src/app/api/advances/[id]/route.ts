import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize, supervisorClientIds, isArnavClient } from "@/lib/authorize";

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

    const body = await request.json();
    const { date, amount, type, remarks } = body;

    const advance = await prisma.advance.findUnique({ where: { id: params.id } });
    if (!advance) {
      return NextResponse.json({ error: "Advance record not found" }, { status: 404 });
    }

    if (session.role !== "admin" && (await isArnavClient(advance.clientId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (session.role === "supervisor") {
      const allowed = supervisorClientIds(session);
      if (!allowed || !allowed.includes(advance.clientId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (type !== undefined && type !== "given" && type !== "recovery") {
      return NextResponse.json({ error: "type must be 'given' or 'recovery'" }, { status: 400 });
    }
    const numericAmount = amount === undefined || amount === "" ? null : parseFloat(amount);
    if (numericAmount !== null && (isNaN(numericAmount) || numericAmount <= 0)) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }

    const updateData: any = {};
    if (date !== undefined) updateData.date = date;
    if (type !== undefined) updateData.type = type;
    if (numericAmount !== null) {
      const effectiveType = type || advance.type;
      updateData.amount = effectiveType === "recovery" ? -numericAmount : numericAmount;
    }
    if (remarks !== undefined) updateData.remarks = remarks || null;

    const updated = await prisma.advance.update({
      where: { id: params.id },
      data: updateData,
    });

    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: "UPDATE_ADVANCE",
        details: `Updated advance ${params.id} for ${updated.date}: ₹${Math.abs(updated.amount).toLocaleString("en-IN")} (${updated.type}).`,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PUT Advance Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
