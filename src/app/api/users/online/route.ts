import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    // Get current timestamp
    const now = new Date();

    // Users who have been active in the last 5 minutes are considered online
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const onlineUsers = await prisma.user.findMany({
      where: {
        lastActive: {
          gte: fiveMinutesAgo,
        },
      },
      select: {
        id: true,
        username: true,
        role: true,
        lastActive: true,
        clientLinks: {
          select: {
            clientId: true,
            client: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { lastActive: "desc" },
    });

    return NextResponse.json({
      timestamp: now,
      count: onlineUsers.length,
      users: onlineUsers.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        lastActive: u.lastActive,
        clients: u.clientLinks.map((cl) => cl.client.name),
      })),
    });
  } catch (error) {
    console.error("Get Online Users Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
