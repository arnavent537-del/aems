import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, setSession } from "@/lib/auth";
import { logActivity, updateLastActive } from "@/lib/activityLogger";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { clientLinks: { select: { clientId: true } } },
    });

    if (user) {
      const hashedPassword = hashPassword(password);
      if (user.passwordHash === hashedPassword) {
        // Set the session cookie
        const linkIds = user.clientLinks.map((l: any) => l.clientId);
        await setSession({
          userId: user.id,
          username: user.username,
          role: user.role,
          assignedClientId: user.assignedClientId,
          assignedClientIds: linkIds.length ? linkIds : (user.assignedClientId ? [user.assignedClientId] : []),
        });

        // Update lastActive timestamp
        await updateLastActive(user.id);

        // Log activity
        await logActivity({
          userId: user.id,
          action: "LOGIN",
          details: `User ${user.username} logged in successfully.`,
          userAgent: request.headers.get("user-agent") || undefined,
        });

        // Write to audit trail
        await prisma.auditTrail.create({
          data: {
            userId: user.id,
            action: "LOGIN",
            details: `User ${user.username} logged in successfully.`,
          },
        });

        return NextResponse.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            assignedClientId: user.assignedClientId,
            assignedClientIds: linkIds.length ? linkIds : (user.assignedClientId ? [user.assignedClientId] : []),
          },
        });
      }
    }

    // Fallback: employee login by mobile number
    const employee = await prisma.employee.findFirst({
      where: { phoneNo: username },
      select: { id: true, name: true, passwordHash: true, phoneNo: true, clientId: true },
    });

    if (employee && employee.passwordHash) {
      const hashedPassword = hashPassword(password);
      if (employee.passwordHash === hashedPassword) {
        await setSession({
          userId: employee.id,
          username: employee.phoneNo!,
          role: "employee",
          assignedClientId: employee.clientId,
          assignedClientIds: [employee.clientId],
        });

        // Update lastActive timestamp for employee
        await prisma.employee.update({
          where: { id: employee.id },
          data: { updatedAt: new Date() },
        });

        // Log activity
        await logActivity({
          userId: employee.id,
          action: "LOGIN",
          details: `Employee ${employee.name} (${employee.phoneNo}) logged in successfully.`,
          userAgent: request.headers.get("user-agent") || undefined,
        });

        await prisma.auditTrail.create({
          data: {
            userId: employee.id,
            action: "LOGIN",
            details: `Employee ${employee.name} (${employee.phoneNo}) logged in successfully.`,
          },
        });

        return NextResponse.json({
          success: true,
          user: {
            id: employee.id,
            username: employee.phoneNo,
            role: "employee",
            assignedClientId: employee.clientId,
            assignedClientIds: [employee.clientId],
          },
        });
      }
    }

    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 }
    );
  } catch (error: any) {
    console.error("Login API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
