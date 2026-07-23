import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize } from "@/lib/authorize";

// Helper to extract id from route params. Next.js 16 uses Promise-based params for route handlers.
export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const session = await authorize(["admin", "accountant"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await prisma.client.findUnique({
      where: { id: params.id },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error("GET Client By ID Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const session = await authorize(["admin"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, pfApplicable, esicApplicable, ptApplicable, isInfinity } = body;

    const existingClient = await prisma.client.findUnique({
      where: { id: params.id },
    });

    if (!existingClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (name && name.trim() !== existingClient.name) {
      const duplicateClient = await prisma.client.findUnique({
        where: { name: name.trim() },
      });
      if (duplicateClient) {
        return NextResponse.json({ error: "Client with this name already exists" }, { status: 400 });
      }
    }

    const updatedClient = await prisma.client.update({
      where: { id: params.id },
      data: {
        name: name ? name.trim() : undefined,
        pfApplicable: pfApplicable !== undefined ? pfApplicable : undefined,
        esicApplicable: esicApplicable !== undefined ? esicApplicable : undefined,
        ptApplicable: ptApplicable !== undefined ? ptApplicable : undefined,
        isInfinity: isInfinity !== undefined ? isInfinity : undefined,
      },
    });

    // Log to audit trail
    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: "UPDATE_CLIENT",
        details: `Updated client ${updatedClient.name}. Modifications: PF=${updatedClient.pfApplicable}, ESIC=${updatedClient.esicApplicable}, PT=${updatedClient.ptApplicable}`,
      },
    });

    return NextResponse.json(updatedClient);
  } catch (error) {
    console.error("PUT Client Error:", error);
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

    const client = await prisma.client.findUnique({
      where: { id: params.id },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    await prisma.client.delete({
      where: { id: params.id },
    });

    // Log to audit trail
    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: "DELETE_CLIENT",
        details: `Deleted client ${client.name} and all its cascading records.`,
      },
    });

    return NextResponse.json({ success: true, message: "Client deleted successfully" });
  } catch (error) {
    console.error("DELETE Client Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
