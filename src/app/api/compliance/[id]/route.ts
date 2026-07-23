import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize } from "@/lib/authorize";

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

    const body = await request.json();
    const existing = await prisma.compliance.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Compliance record not found" }, { status: 404 });
    }

    const updateData: any = {};
    const fields = [
      "pfFilingStatus",
      "esicFilingStatus",
      "pfChallanUrl",
      "esicChallanUrl",
      "napsComplianceStatus",
      "showCauseNoticesCount",
    ];
    for (const f of fields) {
      if (body[f] !== undefined) updateData[f] = body[f];
    }

    const updated = await prisma.compliance.update({
      where: { id: params.id },
      data: updateData,
    });

    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: "UPDATE_COMPLIANCE",
        details: `Updated compliance record ${params.id} (${existing.month}). PF: ${updated.pfFilingStatus}, ESIC: ${updated.esicFilingStatus}, NAPS: ${updated.napsComplianceStatus}.`,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PUT Compliance Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const session = await authorize(["admin"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const existing = await prisma.compliance.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Compliance record not found" }, { status: 404 });
    }

    await prisma.compliance.delete({ where: { id: params.id } });

    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: "DELETE_COMPLIANCE",
        details: `Deleted compliance record ${params.id}.`,
      },
    });

    return NextResponse.json({ success: true, message: "Compliance record deleted" });
  } catch (error: any) {
    console.error("DELETE Compliance Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
