import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize } from "@/lib/authorize";
import { hashPassword } from "@/lib/auth";

export async function GET(_request: Request) {
  try {
    const session = await authorize(["admin"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        assignedClientId: true,
        employeeId: true,
        createdAt: true,
        assignedClient: { select: { name: true } },
        clientLinks: { select: { clientId: true } },
      },
      orderBy: { username: "asc" },
    });

    return NextResponse.json(users);
  } catch (error: any) {
    console.error("GET Users Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await authorize(["admin"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { username, password, role, assignedClientId, assignedClientIds, employeeId } = body;

    if (!username || !password || !role) {
      return NextResponse.json({ error: "username, password, role are required" }, { status: 400 });
    }

    if (!["admin", "accountant", "supervisor", "employee"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: "Username already exists" }, { status: 400 });
    }

    // Validate employeeId if provided
    if (employeeId) {
      const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
      if (!emp) {
        return NextResponse.json({ error: "Employee not found" }, { status: 400 });
      }
      // Check if employee is already linked to another user
      const existingLink = await prisma.user.findFirst({ where: { employeeId }, select: { id: true } });
      if (existingLink) {
        return NextResponse.json({ error: "Employee is already linked to another user" }, { status: 400 });
      }
    }

    const ids = role === "supervisor"
      ? Array.isArray(assignedClientIds) && assignedClientIds.length
        ? assignedClientIds
        : (assignedClientId ? [assignedClientId] : [])
      : [];

    const user = await prisma.user.create({
      data: {
        username,
        passwordHash: hashPassword(password),
        role,
        assignedClientId: ids.length ? ids[0] : null,
        employeeId: employeeId || null,
        clientLinks: ids.length
          ? { create: ids.map((cid: string) => ({ clientId: cid })) }
          : undefined,
      },
    });

    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: "CREATE_USER",
        details: `Created user ${username} with role ${role}.`,
      },
    });

    return NextResponse.json({ id: user.id, username: user.username, role: user.role }, { status: 201 });
  } catch (error: any) {
    console.error("POST User Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
