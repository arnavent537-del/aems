"use client";

import React, { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Card, Button, Toast, Modal } from "@/components/ui";
import type { Client, Employee, AttendanceStats } from "@/lib/types";
import { Save, Download } from "lucide-react";

const STATUSES = ["P", "A", "P/2", "W-O", "PH"];
const PRESENT = new Set(["P", "P/2", "P-2"]);

const STATUS_COLORS: Record<string, string> = {
  P: "bg-emerald-500",
  A: "bg-red-500",
  "P/2": "bg-amber-500",
  "P-2": "bg-amber-500",
  "W-O": "bg-blue-500",
  PH: "bg-purple-500",
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

type Cell = { status: string; otHours: number; workHours?: number; inTime?: string | null; outTime?: string | null };

export default function AttendancePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tab, setTab] = useState<"daily" | "monthly">("daily");
  const [date, setDate] = useState(todayStr());
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<string>("admin");
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [advanceByEmp, setAdvanceByEmp] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<{ msg: string; type: "error" | "success" }>({ msg: "", type: "error" });
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [arnavClientName, setArnavClientName] = useState<string>("");

  const [popup, setPopup] = useState<{ empId: string; empName: string; ds: string; status: string; ot: number; workHours?: number } | null>(null);

  const isAdmin = role === "admin" || role === "accountant";
  const isEmployee = role === "employee";
  const showSalary = role === "admin" || role === "accountant";
  const canEditOt = role === "admin" || role === "accountant" || role === "supervisor";
  const maxDate = todayStr();
  // Check if viewing Arnav as non-admin staff (read-only view)
  const isArnavRestrictedView = role !== "admin" && role !== "employee" && employeeId !== null &&
    clients.find(c => c.id === clientId)?.name === "Arnav Enterprises";

  const loadClients = useCallback(async () => {
    const cl = await api.listClients();
    setClients(cl);
    return cl;
  }, []);

  useEffect(() => {
    api
      .getMe()
      .then(async (u) => {
        setRole(u.role);
        setEmployeeId(u.employeeId || null);
        if (u.role === "employee") {
          if (u.employeeId) {
            try {
              const me = await api.myEmployee();
              setClientId(me.clientId || "");
              setEmployees([me]);
            } catch {
              /* ignore */
            }
          }
          setLoading(false);
          return;
        }
        const cl = await loadClients();
        if (cl.length) setClientId(cl[0].id);
      })
      .catch(() => {});
  }, [loadClients]);

  useEffect(() => {
    if (!clientId || isEmployee) return;
    setLoading(true);
    api
      .listEmployees({ clientId })
      .then(setEmployees)
      .finally(() => setLoading(false));
  }, [clientId, isEmployee]);

  useEffect(() => {
    if (!clientId) return;
    const myId = isEmployee ? employees[0]?.id : undefined;
    const param = tab === "daily"
      ? isEmployee
        ? { employeeId: myId, date }
        : { clientId, date }
      : isEmployee
        ? { employeeId: myId, month }
        : { clientId, month };
    api.listAttendance(param).then((recs) => {
      const map: Record<string, Cell> = {};
      for (const r of recs) {
        map[`${r.employeeId}__${r.date}`] = { status: r.status, otHours: r.otHours, workHours: r.workHours, inTime: r.inTime, outTime: r.outTime };
      }
      setCells(map);
    });

    if (tab === "monthly" && !isEmployee) {
      api.listAdvances({ clientId }).then((advs) => {
        const byEmp: Record<string, number> = {};
        for (const a of advs) {
          if (!a.date.startsWith(month)) continue;
          const signed = a.type === "recovery" ? -Math.abs(a.amount) : Math.abs(a.amount);
          byEmp[a.employeeId] = (byEmp[a.employeeId] || 0) + signed;
        }
        setAdvanceByEmp(byEmp);
      }).catch(() => setAdvanceByEmp({}));
    } else {
      setAdvanceByEmp({});
    }
  }, [clientId, tab, date, month, isEmployee, employees]);

  useEffect(() => {
    if (!clientId || !isAdmin) {
      setStats(null);
      return;
    }
    api.attendanceStats(clientId, month).then(setStats).catch(() => setStats(null));
  }, [clientId, month, isAdmin]);

  function key(empId: string, d: string): string {
    return `${empId}__${d}`;
  }

  function setCell(empId: string, d: string, patch: Partial<Cell>) {
    setCells((prev) => ({
      ...prev,
      [key(empId, d)]: { status: prev[key(empId, d)]?.status || "", otHours: prev[key(empId, d)]?.otHours || 0, workHours: prev[key(empId, d)]?.workHours, inTime: prev[key(empId, d)]?.inTime, outTime: prev[key(empId, d)]?.outTime, ...patch },
    }));
  }

  function openPopup(empId: string, empName: string, ds: string) {
    if (isEmployee || isArnavRestrictedView) return;
    if (ds > maxDate) {
      setToast({ msg: "Future attendance cannot be marked.", type: "error" });
      return;
    }
    const c = cells[key(empId, ds)] || { status: "", otHours: 0, workHours: undefined };
    setPopup({ empId, empName, ds, status: c.status, ot: c.otHours, workHours: c.workHours });
  }

  function chooseStatus(status: string) {
    if (!popup) return;
    setPopup({ ...popup, status });
  }

  async function savePopup() {
    if (!popup) return;
    setSaving(true);
    try {
      await api.saveAttendance(clientId, [
        { employeeId: popup.empId, date: popup.ds, status: popup.status, otHours: canEditOt ? popup.ot : 0 },
      ]);
      setCell(popup.empId, popup.ds, { status: popup.status, otHours: canEditOt ? popup.ot : 0 });
      setToast({ msg: "Attendance saved", type: "success" });
      setPopup(null);
    } catch (e: any) {
      setToast({ msg: e.message || "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function clearPopup() {
    if (!popup) return;
    setSaving(true);
    try {
      await api.saveAttendance(clientId, [
        { employeeId: popup.empId, date: popup.ds, status: "", otHours: 0 },
      ]);
      setCell(popup.empId, popup.ds, { status: "", otHours: 0 });
      setToast({ msg: "Attendance cleared", type: "success" });
      setPopup(null);
    } catch (e: any) {
      setToast({ msg: e.message || "Clear failed", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const bulk: any[] = [];
      const pushCell = (empId: string, ds: string, c: Cell) => {
        bulk.push({ employeeId: empId, date: ds, status: c.status, otHours: canEditOt ? c.otHours : 0 });
      };
      if (tab === "daily") {
        for (const e of employees) {
          const c = cells[key(e.id, date)];
          if (c?.status) pushCell(e.id, date, c);
        }
      } else {
        const [y, m] = month.split("-").map(Number);
        const total = daysInMonth(y, m);
        for (const e of employees) {
          for (let d = 1; d <= total; d++) {
            const ds = `${month}-${String(d).padStart(2, "0")}`;
            const c = cells[key(e.id, ds)];
            if (c?.status) pushCell(e.id, ds, c);
          }
        }
      }
      await api.saveAttendance(clientId, bulk);
      setToast({ msg: "Attendance saved", type: "success" });
    } catch (e: any) {
      setToast({ msg: e.message || "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  function exportExcel() {
    const qs = new URLSearchParams({ clientId, month });
    window.location.href = `/api/attendance/export?${qs.toString()}`;
  }

  const y = Number(month.split("-")[0]);
  const m = Number(month.split("-")[1]);
  const dayCount = daysInMonth(y, m);
  const dayLabels = Array.from({ length: dayCount }, (_, i) => i + 1);

  function dayValue(status: string): number {
    if (status === "PH") return 1;
    if (status === "P") return 1;
    if (status === "P/2" || status === "P-2") return 0.5;
    return 0;
  }

  function daysPresent(empId: string): number {
    let count = 0;
    for (let d = 1; d <= dayCount; d++) {
      const c = cells[key(empId, `${month}-${String(d).padStart(2, "0")}`)];
      if (c?.status) count += dayValue(c.status);
    }
    return count;
  }

  function totalOt(empId: string): number {
    let ot = 0;
    for (let d = 1; d <= dayCount; d++) {
      const c = cells[key(empId, `${month}-${String(d).padStart(2, "0")}`)];
      ot += c?.otHours || 0;
    }
    return Math.round(ot * 100) / 100;
  }

  function advanceTotal(empId: string): number {
    const amt = advanceByEmp[empId] || 0;
    return Math.round(amt * 100) / 100;
  }

  function presentSalary(empId: string): number {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return 0;
    return Math.round((emp.salaryRate / 26) * daysPresent(empId) * 100) / 100;
  }

  function otAmount(empId: string): number {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return 0;
    return Math.round((emp.salaryRate / 26 / 8) * totalOt(empId) * 100) / 100;
  }

  function totalSalary(empId: string): number {
    return presentSalary(empId) + otAmount(empId);
  }

  function netSalary(empId: string): number {
    return Math.round((totalSalary(empId) - advanceTotal(empId)) * 100) / 100;
  }

  function grandOt(): { hours: number; amount: number } {
    let hours = 0;
    let amount = 0;
    for (const e of employees) {
      const otHrs = totalOt(e.id);
      hours += otHrs;
      const rate = e.salaryRate || 0;
      amount += (rate / 26 / 8) * otHrs;
    }
    return { hours: Math.round(hours * 100) / 100, amount: Math.round(amount * 100) / 100 };
  }

  function grandAdvance(): number {
    let total = 0;
    for (const e of employees) total += advanceTotal(e.id);
    return Math.round(total * 100) / 100;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Attendance</h1>
          <p className="text-sm text-slate-500">Mark daily attendance and overtime for your client.</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="secondary" onClick={exportExcel}>
              <Download className="h-4 w-4" /> Export Excel
            </Button>
          )}
          {!isEmployee && !isArnavRestrictedView && (
            <Button onClick={save} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Attendance"}
            </Button>
          )}
          {isArnavRestrictedView && (
            <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
              Viewing your personal data only
            </span>
          )}
        </div>
      </div>

      {isAdmin && stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card className="flex flex-col">
            <p className="text-sm text-slate-500">Present Today</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.presentToday}</p>
            <p className="text-xs text-slate-400">Total present today</p>
          </Card>
          <Card className="flex flex-col">
            <p className="text-sm text-slate-500">Absent Today</p>
            <p className="text-2xl font-bold text-rose-600">{stats.absentToday}</p>
            <p className="text-xs text-slate-400">Total absent today</p>
          </Card>
          <Card className="flex flex-col">
            <p className="text-sm text-slate-500">Present This Month</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.presentMonth}</p>
            <p className="text-xs text-slate-400">Cumulative present days</p>
          </Card>
          <Card className="flex flex-col">
            <p className="text-sm text-slate-500">Absent This Month</p>
            <p className="text-2xl font-bold text-rose-600">{stats.absentMonth}</p>
            <p className="text-xs text-slate-400">Cumulative absent days</p>
          </Card>
        </div>
      )}

      <Card className="flex flex-wrap items-end gap-3">
        {!isEmployee && (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Client</label>
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex rounded-lg border border-slate-300 p-0.5">
          {!isEmployee && (
            <button
              onClick={() => setTab("daily")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "daily" ? "bg-indigo-600 text-white" : "text-slate-600"}`}
            >
              Daily
            </button>
          )}
          <button
            onClick={() => setTab("monthly")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === "monthly" ? "bg-indigo-600 text-white" : "text-slate-600"}`}
          >
            Monthly
          </button>
        </div>
        {tab === "daily" ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Date</label>
            <input
              type="date"
              max={maxDate}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={date}
              onChange={(e) => {
                if (e.target.value > maxDate) {
                  setToast({ msg: "Future attendance cannot be marked.", type: "error" });
                  return;
                }
                setDate(e.target.value);
              }}
            />
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Month</label>
            <input
              type="month"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <span className={`h-3 w-3 rounded-full ${STATUS_COLORS[s]}`} />
            {s}
            {s === "P/2" && " (Half Day)"}
          </span>
        ))}
      </div>

      <Card className="overflow-x-auto p-0">
        {loading ? (
          <p className="px-4 py-6 text-center text-slate-400">Loading...</p>
        ) : employees.length === 0 ? (
          <p className="px-4 py-6 text-center text-slate-400">No active employees for this client.</p>
        ) : tab === "daily" ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const c = cells[key(e.id, date)] || { status: "", otHours: 0 };
                return (
                  <tr key={e.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{e.employeeCode}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{e.name}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openPopup(e.id, e.name, date)}
                        className={`h-8 min-w-[3.5rem] rounded-lg px-3 text-sm font-medium text-white ${c.status ? STATUS_COLORS[c.status] : "bg-slate-100 text-slate-600"}`}
                      >
                        {c.status || "—"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3">Employee</th>
                {dayLabels.map((d) => (
                  <th key={d} className="px-1 py-3 text-center text-xs">
                    {d}
                  </th>
                ))}
                <th className="px-2 py-3 text-center text-xs font-semibold text-slate-700">In</th>
                <th className="px-2 py-3 text-center text-xs font-semibold text-slate-700">Out</th>
                <th className="px-2 py-3 text-center text-xs font-semibold text-slate-700">Days Present</th>
                <th className="px-2 py-3 text-center text-xs font-semibold text-slate-700">Total OT</th>
                {showSalary && <th className="px-2 py-3 text-center text-xs font-semibold text-slate-700">Monthly Salary</th>}
                {showSalary && <th className="px-2 py-3 text-center text-xs font-semibold text-slate-700">OT Amount</th>}
                {showSalary && <th className="px-2 py-3 text-center text-xs font-semibold text-slate-700">Total Salary</th>}
                {showSalary && <th className="px-2 py-3 text-center text-xs font-semibold text-slate-700">Monthly Advance</th>}
                {showSalary && <th className="px-2 py-3 text-center text-xs font-semibold text-slate-700">Net Salary</th>}
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <React.Fragment key={e.id}>
                  <tr className="border-b border-slate-100">
                    <td className="sticky left-0 z-10 bg-white px-4 py-2 text-xs font-medium text-slate-700">
                      <span className="font-mono text-slate-400">{e.employeeCode}</span>
                      <br />
                      {e.name}
                    </td>
                    {dayLabels.map((d) => {
                      const ds = `${month}-${String(d).padStart(2, "0")}`;
                      const c = cells[key(e.id, ds)] || { status: "", otHours: 0 };
                      return (
                        <td key={d} className="px-1 py-1 text-center">
                          <button
                            onClick={() => openPopup(e.id, e.name, ds)}
                            className={`h-7 w-14 rounded text-xs font-medium ${c.status ? STATUS_COLORS[c.status] : "bg-slate-100 text-slate-500"}`}
                            title={ds}
                          >
                            {c.status || "·"}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-center text-[11px] text-slate-600 whitespace-nowrap">
                      {(() => {
                        // Show the most recent inTime from any day this month
                        for (let d = dayCount; d >= 1; d--) {
                          const ds = `${month}-${String(d).padStart(2, "0")}`;
                          const c = cells[key(e.id, ds)];
                          if (c?.inTime) return c.inTime;
                        }
                        return "—";
                      })()}
                    </td>
                    <td className="px-2 py-1 text-center text-[11px] text-slate-600 whitespace-nowrap">
                      {(() => {
                        for (let d = dayCount; d >= 1; d--) {
                          const ds = `${month}-${String(d).padStart(2, "0")}`;
                          const c = cells[key(e.id, ds)];
                          if (c?.outTime) return c.outTime;
                        }
                        return "—";
                      })()}
                    </td>
                    <td className="px-2 py-1 text-center text-sm font-semibold text-emerald-700">{daysPresent(e.id)}</td>
                    <td className="px-2 py-1 text-center text-sm font-semibold text-indigo-700">{totalOt(e.id)}</td>
                    {showSalary && <td className="px-2 py-1 text-center text-sm text-slate-600">₹{presentSalary(e.id)}</td>}
                    {showSalary && <td className="px-2 py-1 text-center text-sm font-bold text-blue-600">₹{otAmount(e.id)}</td>}
                    {showSalary && <td className="px-2 py-1 text-center text-sm font-semibold text-emerald-700">₹{totalSalary(e.id)}</td>}
                    {showSalary && <td className="px-2 py-1 text-center text-sm text-amber-700">{advanceTotal(e.id) || "—"}</td>}
                    {showSalary && <td className="px-2 py-1 text-center text-sm font-bold text-emerald-700">₹{netSalary(e.id)}</td>}
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="sticky left-0 z-10 bg-white px-4 py-1" />
                    {dayLabels.map((d) => {
                      const ds = `${month}-${String(d).padStart(2, "0")}`;
                      const c = cells[key(e.id, ds)] || { status: "", otHours: 0 };
                      return (
                        <td key={d} className="px-1 py-1 text-center">
                          {c.otHours > 0 ? (
                            <span className="text-xs font-bold text-blue-600">{c.otHours}</span>
                          ) : (
                            <span className="text-[10px] text-slate-300">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 text-center text-[10px] text-slate-300">—</td>
                    <td className="px-2 py-1 text-center text-[10px] text-slate-300">—</td>
                    <td className="px-2 py-1 text-center text-[10px] text-slate-300">—</td>
                    {showSalary && <td className="px-2 py-1 text-center text-[10px] text-slate-300">—</td>}
                    {showSalary && <td className="px-2 py-1 text-center text-[10px] text-slate-300">—</td>}
                    {showSalary && <td className="px-2 py-1 text-center text-[10px] text-slate-300">—</td>}
                    {showSalary && <td className="px-2 py-1 text-center text-[10px] text-slate-300">—</td>}
                    {showSalary && <td className="px-2 py-1 text-center text-[10px] text-slate-300">—</td>}
                  </tr>
                </React.Fragment>
              ))}

            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={!!popup}
        title={popup ? `Mark Attendance — ${popup.empName}` : ""}
        onClose={() => setPopup(null)}
        footer={
          <>
            <Button onClick={savePopup} disabled={saving}>
              Save
            </Button>
            <Button variant="danger" onClick={clearPopup} disabled={saving}>
              Clear
            </Button>
            <Button variant="secondary" onClick={() => setPopup(null)}>
              Cancel
            </Button>
          </>
        }
      >
        {popup && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Date: <span className="font-medium text-slate-700">{popup.ds}</span></p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => chooseStatus(s)}
                  className={`h-10 rounded-lg text-sm font-medium text-white ${STATUS_COLORS[s]} ${popup?.status === s ? "ring-2 ring-offset-2 ring-slate-800" : ""}`}
                >
                  {s}
                </button>
              ))}
            </div>
            {canEditOt && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-600">OT Hours</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={popup.ot}
                  onChange={(ev) => setPopup({ ...popup, ot: parseFloat(ev.target.value) || 0 })}
                />
              </label>
            )}
          </div>
        )}
      </Modal>

      <Toast message={toast.msg} type={toast.type} />
    </div>
  );
}
