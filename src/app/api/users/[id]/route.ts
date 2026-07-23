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
    const session = await authorize(["admin"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const existing = await prisma.user.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Determine the target client link set (supervisors only)
    let linkIds: string[] | null = null;
    if (body.role) {
      if (!["admin", "accountant", "supervisor"].includes(body.role)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      linkIds = body.role === "supervisor"
        ? (Array.isArray(body.assignedClientIds) && body.assignedClientIds.length
            ? body.assignedClientIds
            : (body.assignedClientId ? [body.assignedClientId] : []))
        : [];
    } else if (body.assignedClientIds !== undefined || body.assignedClientId !== undefined) {
      linkIds = Array.isArray(body.assignedClientIds) && body.assignedClientIds.length
        ? body.assignedClientIds
        : (body.assignedClientId ? [body.assignedClientId] : []);
    }

    const updateData: any = {};
    if (body.username !== undefined && body.username !== existing.username) {
      const clash = await prisma.user.findUnique({ where: { username: body.username } });
      if (clash) {
        return NextResponse.json({ error: "Username already exists" }, { status: 400 });
      }
      updateData.username = body.username;
    }
    if (body.password) updateData.passwordHash = hashPassword(body.password);
    if (body.role) updateData.role = body.role;
    if (linkIds !== null) {
      updateData.assignedClientId = linkIds.length ? linkIds[0] : null;
    }

    // Handle employeeId update
    if (body.employeeId !== undefined) {
      if (body.employeeId === null) {
        updateData.employeeId = null;
      } else {
        const emp = await prisma.employee.findUnique({ where: { id: body.employeeId }, select: { id: true } });
        if (!emp) {
          return NextResponse.json({ error: "Employee not found" }, { status: 400 });
        }
        const existingLink = await prisma.user.findFirst({ where: { employeeId: body.employeeId, NOT: { id: params.id } }, select: { id: true } });
        if (existingLink) {
          return NextResponse.json({ error: "Employee is already linked to another user" }, { status: 400 });
        }
        updateData.employeeId = body.employeeId;
      }
    }

    if (linkIds !== null) {
      await prisma.$transaction([
        prisma.userClient.deleteMany({ where: { userId: params.id } }),
        prisma.userClient.createMany({
          data: linkIds.map((cid: string) => ({ userId: params.id, clientId: cid })),
        }),
        prisma.user.update({ where: { id: params.id }, data: updateData }),
      ]);
    } else {
      await prisma.user.update({ where: { id: params.id }, data: updateData });
    }

    const updated = await prisma.user.findUnique({
      where: { id: params.id },
    });
    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: "UPDATE_USER",
        details: `Updated user ${updated.username}.`,
      },
    });

    return NextResponse.json({ id: updated.id, username: updated.username, role: updated.role });
  } catch (error: any) {
    console.error("PUT User Error:", error);
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

    const existing = await prisma.user.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (existing.id === session.userId) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    await prisma.user.delete({ where: { id: params.id } });

    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: "DELETE_USER",
        details: `Deleted user ${existing.username}.`,
      },
    });

    return NextResponse.json({ success: true, message: "User deleted" });
  } catch (error: any) {
    console.error("DELETE User Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
