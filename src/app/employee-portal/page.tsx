"use client";

import { useEffect, useState } from "react";
import { Card, Button, Badge, Toast } from "@/components/ui";
import { MapPin, Clock, LogIn, LogOut, CalendarDays } from "lucide-react";

export default function EmployeePortalPage() {
  const [employee, setEmployee] = useState<any>(null);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "error" | "success" }>({ msg: "", type: "error" });

  useEffect(() => {
    loadEmployeeData();
    getCurrentLocation();
  }, []);

  async function loadEmployeeData() {
    try {
      const response = await fetch("/api/employees/me");
      const data = await response.json();
      setEmployee(data);

      // Load today's attendance
      const today = new Date().toISOString().split("T")[0];
      const attendanceResponse = await fetch(`/api/attendance?date=${today}&employeeId=${data.id}`);
      const attendanceData = await attendanceResponse.json();

      if (attendanceData && attendanceData.length > 0) {
        setTodayAttendance(attendanceData[0]);
      }
    } catch (error) {
      console.error("Error loading employee data:", error);
    } finally {
      setLoading(false);
    }
  }

  function getCurrentLocation() {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          let msg = "Could not get your location.";
          if (error.code === error.PERMISSION_DENIED) {
            msg = "Location permission denied. Please allow location access in your browser settings and reload.";
          } else if (error.code === error.TIMEOUT) {
            msg = "Location request timed out. Please try again.";
          }
          setToast({ msg, type: "error" });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setToast({ msg: "Geolocation is not supported by your browser", type: "error" });
    }
  }

  async function handleCheckIn() {
    if (!location) {
      setToast({ msg: "Getting your location... Please wait a moment.", type: "error" });
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
          setLocation(loc);
          setToast({ msg: "Location acquired. Try check-in again.", type: "success" });
        },
        () => {
          setToast({ msg: "Location unavailable. Please enable location access and try again.", type: "error" });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
      return;
    }

    setCheckingIn(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.id,
          date: today,
          inLocation: `${location.lat},${location.lng}`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Check-in failed");
      }

      setToast({ msg: data.message, type: "success" });
      await loadEmployeeData();
    } catch (error: any) {
      setToast({ msg: error.message || "Check-in failed", type: "error" });
    } finally {
      setCheckingIn(false);
    }
  }

  async function handleCheckOut() {
    if (!location) {
      setToast({ msg: "Getting your location... Please wait a moment.", type: "error" });
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
          setLocation(loc);
          setToast({ msg: "Location acquired. Try check-out again.", type: "success" });
        },
        () => {
          setToast({ msg: "Location unavailable. Please enable location access and try again.", type: "error" });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
      return;
    }

    setCheckingOut(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await fetch("/api/attendance/check-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employee.id,
          date: today,
          outLocation: `${location.lat},${location.lng}`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Check-out failed");
      }

      setToast({ msg: data.message, type: "success" });
      await loadEmployeeData();
    } catch (error: any) {
      setToast({ msg: error.message || "Check-out failed", type: "error" });
    } finally {
      setCheckingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-500">Employee data not found</p>
      </div>
    );
  }

  const isArnavEmployee = employee.client?.name === "Arnav Enterprises";

  if (!isArnavEmployee) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <p className="text-slate-600">
            Location-based attendance is only available for Arnav Enterprises employees.
          </p>
        </Card>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const currentTime = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto space-y-4 pt-8">
        {/* Header */}
        <Card className="bg-white">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-slate-800">{employee.name}</h1>
            <p className="text-sm text-slate-500">{employee.employeeCode}</p>
            <div className="flex justify-center">
              <Badge color="blue">{employee.client?.name}</Badge>
            </div>
          </div>
        </Card>

        {/* Date & Time */}
        <Card className="bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-indigo-600" />
              <div>
                <p className="text-xs text-slate-500">Date</p>
                <p className="text-sm font-medium text-slate-700">{today}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-600" />
              <div>
                <p className="text-xs text-slate-500">Time</p>
                <p className="text-sm font-medium text-slate-700">{currentTime}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Location Status */}
        <Card className="bg-white">
          <div className="flex items-center gap-3">
            <MapPin className={`h-5 w-5 ${location ? "text-green-600" : "text-red-600"}`} />
            <div>
              <p className="text-sm font-medium text-slate-700">
                {location ? "Location Detected" : "Location Not Available"}
              </p>
              {location && (
                <p className="text-xs text-slate-500">
                  {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Today's Attendance Status */}
        {todayAttendance && (
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Check-In Time</span>
                <Badge color={todayAttendance.inTime ? "green" : "slate"}>
                  {todayAttendance.inTime || "Not checked in"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Check-Out Time</span>
                <Badge color={todayAttendance.outTime ? "green" : "amber"}>
                  {todayAttendance.outTime || "Not checked out"}
                </Badge>
              </div>
              {todayAttendance.workHours && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Work Hours</span>
                  <Badge color="blue">{todayAttendance.workHours.toFixed(2)} hrs</Badge>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleCheckIn}
            disabled={checkingIn || !location || (todayAttendance?.inTime)}
            className="w-full py-6 text-lg"
          >
            <LogIn className="h-6 w-6 mr-2" />
            {checkingIn ? "Checking In..." : todayAttendance?.inTime ? "Already Checked In" : "Check In"}
          </Button>

          <Button
            onClick={handleCheckOut}
            disabled={checkingOut || !location || !todayAttendance?.inTime || todayAttendance?.outTime}
            className="w-full py-6 text-lg"
            variant="secondary"
          >
            <LogOut className="h-6 w-6 mr-2" />
            {checkingOut ? "Checking Out..." : todayAttendance?.outTime ? "Already Checked Out" : "Check Out"}
          </Button>
        </div>

        {!employee.assignedLocation && (
          <Card className="bg-amber-50 border-amber-200">
            <p className="text-sm text-amber-800">
              <strong>Note:</strong> No work location assigned yet. Contact admin to set your work location.
            </p>
          </Card>
        )}
      </div>

      <Toast message={toast.msg} type={toast.type} />
    </div>
  );
}
