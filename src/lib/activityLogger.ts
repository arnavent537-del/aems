import { prisma } from "@/lib/db";

export type ActivityAction =
  | "LOGIN"
  | "LOGOUT"
  | "CREATE_EMPLOYEE"
  | "UPDATE_EMPLOYEE"
  | "DELETE_EMPLOYEE"
  | "CREATE_CLIENT"
  | "UPDATE_CLIENT"
  | "DELETE_CLIENT"
  | "CREATE_ATTENDANCE"
  | "UPDATE_ATTENDANCE"
  | "DELETE_ATTENDANCE"
  | "CREATE_ADVANCE"
  | "APPROVE_ADVANCE"
  | "CREATE_SALARY"
  | "UPDATE_SALARY"
  | "IMPORT_EMPLOYEES"
  | "PASSWORD_RESET"
  | "MARK_EXIT"
  | "REACTIVATE_EMPLOYEE";

export async function logActivity({
  userId,
  action,
  details,
  ipAddress,
  userAgent,
}: {
  userId: string;
  action: ActivityAction;
  details: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        details,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

export async function updateLastActive(userId: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastActive: new Date() },
    });
  } catch (error) {
    console.error("Error updating last active:", error);
  }
}

export async function getOnlineUsers(timeoutMinutes: number = 5): Promise<any[]> {
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

  return prisma.user.findMany({
    where: {
      lastActive: {
        gte: cutoff,
      },
    },
    select: {
      id: true,
      username: true,
      role: true,
      lastActive: true,
      createdAt: true,
      _count: {
        select: {
          clientLinks: true,
        },
      },
    },
    orderBy: { lastActive: "desc" },
  });
}

export async function getOfflineUsers(timeoutMinutes: number = 5): Promise<any[]> {
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

  return prisma.user.findMany({
    where: {
      lastActive: {
        lte: cutoff,
      },
    },
    select: {
      id: true,
      username: true,
      role: true,
      lastActive: true,
      createdAt: true,
      _count: {
        select: {
          clientLinks: true,
        },
      },
    },
    orderBy: { lastActive: "desc" },
  });
}
