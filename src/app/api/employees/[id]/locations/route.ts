import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize } from "@/lib/authorize";

// GET /api/employees/{id}/locations — list all locations for an employee
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

    const employee = await prisma.employee.findUnique({
      where: { id: params.id },
      select: { id: true, clientId: true, assignedLocation: true, client: { select: { name: true } } },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Auto-migrate legacy assignedLocation if employee has it but no locations yet
    if (employee.assignedLocation && employee.client.name === "Arnav Enterprises") {
      const existingLocations = await prisma.employeeLocation.count({
        where: { employeeId: params.id },
      });

      if (existingLocations === 0 && employee.assignedLocation.includes(",")) {
        const [lat, lng] = employee.assignedLocation.split(",");
        await prisma.employeeLocation.create({
          data: {
            employeeId: params.id,
            locationName: "Main Location",
            latitude: lat.trim(),
            longitude: lng.trim(),
            inTime: "09:00",
            outTime: "18:00",
            isDefault: true,
            sortOrder: 0,
          },
        });
      }
    }

    const locations = await prisma.employeeLocation.findMany({
      where: { employeeId: params.id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(locations);
  } catch (error: any) {
    console.error("GET Employee Locations Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/employees/{id}/locations — add a new location
export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const session = await authorize(["admin", "accountant"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { locationName, latitude, longitude, inTime, outTime, isDefault } = body;

    if (!locationName || !latitude || !longitude) {
      return NextResponse.json(
        { error: "locationName, latitude, and longitude are required" },
        { status: 400 }
      );
    }

    // Validate coordinates
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      return NextResponse.json({ error: "Invalid latitude (-90 to 90)" }, { status: 400 });
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      return NextResponse.json({ error: "Invalid longitude (-180 to 180)" }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Get current max sort order
    const maxSort = await prisma.employeeLocation.aggregate({
      where: { employeeId: params.id },
      _max: { sortOrder: true },
    });

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.employeeLocation.updateMany({
        where: { employeeId: params.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const location = await prisma.employeeLocation.create({
      data: {
        employeeId: params.id,
        locationName,
        latitude,
        longitude,
        inTime: inTime || null,
        outTime: outTime || null,
        isDefault: isDefault || false,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "CREATE_EMPLOYEE_LOCATION",
        details: `Created location "${locationName}" for employee ${params.id}`,
      },
    });

    return NextResponse.json(location, { status: 201 });
  } catch (error: any) {
    console.error("POST Employee Location Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/employees/{id}/locations — batch update all locations
export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const session = await authorize(["admin", "accountant"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { locations } = body;

    if (!Array.isArray(locations)) {
      return NextResponse.json({ error: "locations array is required" }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Delete all existing locations and recreate
    await prisma.employeeLocation.deleteMany({
      where: { employeeId: params.id },
    });

    if (locations.length > 0) {
      await prisma.employeeLocation.createMany({
        data: locations.map((loc: any, index: number) => ({
          employeeId: params.id,
          locationName: loc.locationName,
          latitude: loc.latitude,
          longitude: loc.longitude,
          inTime: loc.inTime || null,
          outTime: loc.outTime || null,
          isDefault: loc.isDefault || false,
          sortOrder: index,
        })),
      });
    }

    const updated = await prisma.employeeLocation.findMany({
      where: { employeeId: params.id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PUT Employee Locations Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/employees/{id}/locations?locationId=X — delete a location
export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const session = await authorize(["admin", "accountant"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get("locationId");

    if (!locationId) {
      return NextResponse.json({ error: "locationId is required" }, { status: 400 });
    }

    const location = await prisma.employeeLocation.findUnique({
      where: { id: locationId },
    });

    if (!location || location.employeeId !== params.id) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    await prisma.employeeLocation.delete({
      where: { id: locationId },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.userId,
        action: "DELETE_EMPLOYEE_LOCATION",
        details: `Deleted location "${location.locationName}" for employee ${params.id}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE Employee Location Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
