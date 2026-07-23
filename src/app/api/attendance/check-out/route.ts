import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employeeId, date, outLocation, outTime } = body;

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

    // Validate location if employee has assigned location
    if (employee.assignedLocation && outLocation) {
      const isValidLocation = validateLocation(employee.assignedLocation, outLocation);
      if (!isValidLocation) {
        return NextResponse.json(
          { error: "You are not at the assigned work location. Please go to the correct location to check out." },
          { status: 403 }
        );
      }
    }

    // Get current time if not provided
    const now = new Date();
    const currentTime = outTime || now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
    const currentLocation = outLocation || null;

    // Find attendance record for today
    const record = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date } },
    });

    if (!record) {
      return NextResponse.json(
        { error: "No check-in record found for today. Please check in first." },
        { status: 400 }
      );
    }

    if (!record.inTime) {
      return NextResponse.json(
        { error: "Please check in first before checking out." },
        { status: 400 }
      );
    }

    if (record.outTime) {
      return NextResponse.json(
        { error: "Already checked out for today", outTime: record.outTime },
        { status: 409 }
      );
    }

    // Calculate work hours
    const workHours = calculateWorkHours(record.inTime, currentTime);

    // Update record with check-out
    const updated = await prisma.attendance.update({
      where: { id: record.id },
      data: {
        status: "P",
        outTime: currentTime,
        outLocation: currentLocation,
        workHours: workHours,
        createdBy: employeeId,
      },
      include: { employee: { select: { name: true } } },
    });

    return NextResponse.json({
      success: true,
      message: "Check-out successful",
      outTime: updated.outTime,
      workHours: updated.workHours,
      location: updated.outLocation,
    });
  } catch (error: any) {
    console.error("Check-out Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function calculateWorkHours(inTime: string, outTime: string): number | null {
  try {
    const [inHour, inMinute] = inTime.split(":").map(Number);
    const [outHour, outMinute] = outTime.split(":").map(Number);

    const inMinutes = inHour * 60 + inMinute;
    const outMinutes = outHour * 60 + outMinute;

    const diffMinutes = outMinutes - inMinutes;
    if (diffMinutes < 0) return 0;

    return Math.round((diffMinutes / 60) * 100) / 100; // Round to 2 decimal places
  } catch {
    return null;
  }
}

// Validate if employee is within 100 meters of assigned location
function validateLocation(assignedLocation: string, currentLocation: string): boolean {
  try {
    const [assignedLat, assignedLng] = assignedLocation.split(",").map(Number);
    const [currentLat, currentLng] = currentLocation.split(",").map(Number);

    const distance = getDistanceInMeters(assignedLat, assignedLng, currentLat, currentLng);

    // Allow within 100 meters
    return distance <= 100;
  } catch {
    return true; // If parsing fails, allow check-out
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

