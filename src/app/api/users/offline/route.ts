import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const offlineUsers = await prisma.user.findMany({
      where: {
        lastActive: {
          lte: fiveMinutesAgo,
        },
      },
      select: {
        id: true,
        username: true,
        role: true,
        lastActive: true,
        createdAt: true,
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
      count: offlineUsers.length,
      users: offlineUsers.map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        lastActive: u.lastActive,
        createdAt: u.createdAt,
        clients: u.clientLinks.map((cl) => cl.client.name),
      })),
    });
  } catch (error) {
    console.error("Get Offline Users Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
