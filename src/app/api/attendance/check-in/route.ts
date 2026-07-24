import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employeeId, date, inLocation, inTime } = body;

    if (!employeeId || !date) {
      return NextResponse.json(
        { error: "employeeId and date are required" },
        { status: 400 }
      );
    }

    // Find the employee
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, clientId: true, name: true, assignedLocation: true, client: { select: { name: true } } },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Check if client is Arnav Enterprises
    const isArnav = employee.client.name === "Arnav Enterprises";

    if (!isArnav) {
      return NextResponse.json(
        { error: "Location-based attendance is only available for Arnav Enterprises" },
        { status: 403 }
      );
    }

    // Auto-set work location on first check-in if none assigned yet
    if (!employee.assignedLocation && inLocation) {
      await prisma.employee.update({
        where: { id: employeeId },
        data: { assignedLocation: inLocation },
      });
    }

    // Validate location if employee has assigned location
    if (employee.assignedLocation && inLocation) {
      const isValidLocation = validateLocation(employee.assignedLocation, inLocation);
      if (!isValidLocation) {
        return NextResponse.json(
          { error: "You are not at the assigned work location. Please go to the correct location to check in." },
          { status: 403 }
        );
      }
    }

    // Find a system user for the createdBy foreign key requirement
    const systemUser = await prisma.user.findFirst({ where: { role: "admin" } });
    if (!systemUser) {
      return NextResponse.json({ error: "No admin user found in the system" }, { status: 500 });
    }

    // Get current time if not provided
    const now = new Date();
    const currentTime = inTime || now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
    const currentLocation = inLocation || null;

    // Check if attendance record exists for today
    const existingRecord = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date } },
    });

    if (existingRecord) {
      if (existingRecord.inTime) {
        return NextResponse.json(
          { error: "Already checked in for today", inTime: existingRecord.inTime },
          { status: 409 }
        );
      }

      // Update existing record with check-in
      const updated = await prisma.attendance.update({
        where: { id: existingRecord.id },
        data: {
          status: "P",
          inTime: currentTime,
          inLocation: currentLocation,
          createdBy: systemUser.id,
        },
        include: { employee: { select: { name: true } } },
      });

      return NextResponse.json({
        success: true,
        message: "Check-in successful",
        inTime: updated.inTime,
        location: updated.inLocation,
      });
    }

    // Create new attendance record with check-in
    const record = await prisma.attendance.create({
      data: {
        employeeId,
        clientId: employee.clientId,
        date,
        status: "P",
        inTime: currentTime,
        inLocation: currentLocation,
        createdBy: systemUser.id,
      },
      include: { employee: { select: { name: true } } },
    });

    return NextResponse.json({
      success: true,
      message: "Check-in successful",
      inTime: record.inTime,
      location: record.inLocation,
    });
  } catch (error: any) {
    console.error("Check-in Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Validate if employee is within 100 meters of assigned location
function validateLocation(assignedLocation: string, currentLocation: string): boolean {
  try {
    const [assignedLat, assignedLng] = assignedLocation.split(",").map(Number);
    const [currentLat, currentLng] = currentLocation.split(",").map(Number);

    const distance = getDistanceInMeters(assignedLat, assignedLng, currentLat, currentLng);

    // Allow check-in within 200 meters (accounts for GPS accuracy variation)
    return distance <= 200;
  } catch {
    return true; // If parsing fails, allow check-in
  }
}

// Calculate distance between two coordinates using Haversine formula
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

