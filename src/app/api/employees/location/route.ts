import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize } from "@/lib/authorize";

export async function PUT(request: Request) {
  try {
    const session = await authorize(["admin", "accountant"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { employeeId, location } = body;

    if (!employeeId || !location) {
      return NextResponse.json(
        { error: "employeeId and location are required" },
        { status: 400 }
      );
    }

    // Validate location format (should be "lat,lng")
    const locationParts = location.split(",");
    if (locationParts.length !== 2) {
      return NextResponse.json(
        { error: "Location must be in format: lat,lng" },
        { status: 400 }
      );
    }

    const lat = parseFloat(locationParts[0]);
    const lng = parseFloat(locationParts[1]);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: "Invalid latitude or longitude" },
        { status: 400 }
      );
    }

    // Get employee and verify it's Arnav Enterprises
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { client: { select: { name: true } } },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    if (employee.client.name !== "Arnav Enterprises") {
      return NextResponse.json(
        { error: "Location assignment is only available for Arnav Enterprises employees" },
        { status: 403 }
      );
    }

    // Update employee location
    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: { assignedLocation: location },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        assignedLocation: true,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "UPDATE_EMPLOYEE",
        details: `Updated location for employee ${employee.name} (${employee.employeeCode}) to ${location}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Location updated successfully",
      employee: updated,
    });
  } catch (error: any) {
    console.error("Update Location Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await authorize(["admin", "accountant"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");

    if (!employeeId) {
      return NextResponse.json(
        { error: "employeeId is required" },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        assignedLocation: true,
        client: { select: { name: true } },
      },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    return NextResponse.json(employee);
  } catch (error: any) {
    console.error("Get Location Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
