import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize } from "@/lib/authorize";

// GET: List all clients
export async function GET() {
  try {
    const session = await authorize(["admin", "accountant", "supervisor"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Supervisors can only list their assigned clients
    let clients: any[];
    if (session.role === "supervisor") {
      if (!session.assignedClientIds || session.assignedClientIds.length === 0) {
        // Fallback to assignedClientId if assignedClientIds is empty
        if (!session.assignedClientId) {
          clients = [];
        } else {
          clients = await prisma.client.findMany({
            where: { id: session.assignedClientId },
          });
        }
      } else {
        clients = await prisma.client.findMany({
          where: { id: { in: session.assignedClientIds } },
        });
      }
    } else {
      clients = await prisma.client.findMany({
        orderBy: { name: "asc" },
      });
    }

    return NextResponse.json(clients);
  } catch (error: any) {
    console.error("GET Clients Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Create a new client
export async function POST(request: Request) {
  try {
    const session = await authorize(["admin"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, pfApplicable, esicApplicable, ptApplicable, isInfinity } = await request.json();

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Client name is required" }, { status: 400 });
    }

    const existingClient = await prisma.client.findUnique({
      where: { name: name.trim() },
    });

    if (existingClient) {
      return NextResponse.json({ error: "Client with this name already exists" }, { status: 400 });
    }

    const client = await prisma.client.create({
      data: {
        name: name.trim(),
        pfApplicable: pfApplicable ?? true,
        esicApplicable: esicApplicable ?? true,
        ptApplicable: ptApplicable ?? true,
        isInfinity: isInfinity ?? false,
      },
    });

    // Log to audit trail
    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: "CREATE_CLIENT",
        details: `Created client ${client.name}.`,
      },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error: any) {
    console.error("POST Client Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
