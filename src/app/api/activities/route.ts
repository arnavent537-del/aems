import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const actionFilter = searchParams.get("action");
    const userIdFilter = searchParams.get("userId");

    const whereClause: any = {};
    if (actionFilter) {
      whereClause.action = actionFilter;
    }
    if (userIdFilter) {
      whereClause.userId = userIdFilter;
    }

    const total = await prisma.activityLog.count({ where: whereClause });
    const activities = await prisma.activityLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            username: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    return NextResponse.json({
      total,
      limit,
      offset,
      activities: activities.map((a) => ({
        id: a.id,
        userId: a.userId,
        username: a.user?.username || "Unknown",
        role: a.user?.role || "Unknown",
        action: a.action,
        details: a.details,
        ipAddress: a.ipAddress,
        userAgent: a.userAgent,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get Activities Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, action, details, ipAddress, userAgent } = body;

    if (!userId || !action || !details) {
      return NextResponse.json(
        { error: "Missing required fields: userId, action, details" },
        { status: 400 }
      );
    }

    const activity = await prisma.activityLog.create({
      data: {
        userId,
        action,
        details,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error("Create Activity Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
