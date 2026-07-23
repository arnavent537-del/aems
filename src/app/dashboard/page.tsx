"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, Badge } from "@/components/ui";
import type { Client, Employee, SalaryRecord, ComplianceRecord, SessionUser, ClientAdvanceSummary } from "@/lib/types";
import { Building2, Users, Receipt, ShieldAlert, Wallet, UserMinus, UserPlus, HandCoins } from "lucide-react";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthYearOf(dmy: string): string {
  const parts = dmy.split("-");
  return parts.length === 3 ? `${parts[2]}-${parts[1]}` : "";
}

const PRESENT = new Set(["P", "P/2", "P-2"]);

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [compliance, setCompliance] = useState<ComplianceRecord[]>([]);
  const [advanceSummary, setAdvanceSummary] = useState<ClientAdvanceSummary[]>([]);
  const [employeeStats, setEmployeeStats] = useState<{ present: number; outstanding: number; lastSalary: SalaryRecord | null } | null>(null);
  const [loading, setLoading] = useState(true);

  const month = currentMonth();

  useEffect(() => {
    api
      .getMe()
      .then(setUser)
      .catch(() => router.push("/login"));
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const currentUser = user;
    async function load() {
      try {
        if (currentUser.role === "employee") {
          const myId = currentUser.employeeId;
          const clientId = currentUser.clientId || "";
          const [att, adv, sal] = await Promise.all([
            api.listAttendance({ employeeId: myId || "", month }).catch(() => []),
            api.listAdvances({ employeeId: myId || "" }).catch(() => []),
            api.listSalaries(clientId, undefined, myId || "").catch(() => []),
          ]);
          const present = att.filter((r: any) => PRESENT.has(r.status)).length;
          const outstanding = adv.reduce(
            (sum: number, a: any) => sum + (a.type === "recovery" ? -Math.abs(a.amount) : Math.abs(a.amount)),
            0
          );
          const sorted = [...sal].sort((a: any, b: any) => (a.month > b.month ? -1 : 1));
          setEmployeeStats({
            present,
            outstanding: Math.round(outstanding * 100) / 100,
            lastSalary: sorted[0] || null,
          });
          return;
        }

        const [cl, emp] = await Promise.all([
          api.listClients(),
          api.listEmployees({ includeExited: false }),
        ]);
        setClients(cl);
        setEmployees(emp);

        if (currentUser.role === "supervisor") {
          const all = await api.listEmployees({ includeExited: true });
          setAllEmployees(all);
        }

        const salaryPromises = cl.map((c) => api.listSalaries(c.id, month).catch(() => []));
        const compPromises = cl.map((c) => api.listCompliance({ clientId: c.id, month }).catch(() => []));
        const [sal, comp] = await Promise.all([Promise.all(salaryPromises), Promise.all(compPromises)]);
        setSalaries(sal.flat());
        setCompliance(comp.flat());

        if (currentUser.role === "admin") {
          const adv = await api.advanceSummary().catch(() => []);
          setAdvanceSummary(adv);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, month]);

  if (loading || !user) {
    return <p className="text-slate-500">Loading dashboard...</p>;
  }

  const isSupervisor = user.role === "supervisor";
  const isEmployeeRole = user.role === "employee";
  const isAdmin = user.role === "admin";
  const totalAdvance = advanceSummary.reduce((sum, c) => sum + c.outstanding, 0);
  const leftEmployees = allEmployees.filter((e) => e.dateOfExit);
  const newJoinees = allEmployees.filter(
    (e) => !e.dateOfExit && monthYearOf(e.dateOfJoining) === month
  );

  const monthlySalary = salaries.reduce((sum, s) => sum + s.netPaid, 0);
  const pendingCompliance = compliance.filter(
    (c) => c.pfFilingStatus !== "Paid" || c.esicFilingStatus !== "Paid"
  ).length;

  const supervisorStats = [
    { label: "Clients", value: clients.length, icon: Building2, color: "text-indigo-600 bg-indigo-50" },
    { label: "Active Employees", value: employees.length, icon: Users, color: "text-emerald-600 bg-emerald-50" },
    { label: "Left Employees", value: leftEmployees.length, icon: UserMinus, color: "text-rose-600 bg-rose-50" },
  ];

  const adminStats = [
    { label: "Clients", value: clients.length, icon: Building2, color: "text-indigo-600 bg-indigo-50" },
    { label: "Active Employees", value: employees.length, icon: Users, color: "text-emerald-600 bg-emerald-50" },
    { label: "Monthly Salary", value: `₹${monthlySalary.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, icon: Receipt, color: "text-purple-600 bg-purple-50" },
    { label: "Pending Compliance", value: pendingCompliance, icon: ShieldAlert, color: "text-amber-600 bg-amber-50" },
  ];

  if (isAdmin) {
    adminStats.push({
      label: "Total Advance",
      value: `₹${totalAdvance.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
      icon: HandCoins,
      color: "text-rose-600 bg-rose-50",
    });
  }

  const stats = isSupervisor ? supervisorStats : adminStats;

  if (isEmployeeRole) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome, {user.name || user.username}</h1>
          <p className="text-sm text-slate-500">Your personal attendance, advance and salary overview.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="flex flex-col">
            <p className="text-sm text-slate-500">Present Days — {month}</p>
            <p className="text-2xl font-bold text-emerald-600">{employeeStats?.present ?? 0}</p>
            <p className="text-xs text-slate-400">Days marked present this month</p>
          </Card>
          <Card className="flex flex-col">
            <p className="text-sm text-slate-500">Outstanding Advance</p>
            <p className="text-2xl font-bold text-rose-600">
              ₹{Math.abs(employeeStats?.outstanding ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-slate-400">
              {employeeStats && employeeStats.outstanding >= 0 ? "Amount due to you" : "Amount recovered"}
            </p>
          </Card>
          <Card className="flex flex-col">
            <p className="text-sm text-slate-500">Last Salary</p>
            <p className="text-2xl font-bold text-purple-600">
              {employeeStats?.lastSalary
                ? `₹${employeeStats.lastSalary.netPaid.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                : "—"}
            </p>
            <p className="text-xs text-slate-400">
              {employeeStats?.lastSalary ? `Net paid for ${employeeStats.lastSalary.month}` : "No salary recorded yet"}
            </p>
          </Card>
        </div>

        <Card>
          <p className="text-sm text-slate-600">
            Use the <span className="font-semibold">Attendance</span>, <span className="font-semibold">Advances</span>, and{" "}
            <span className="font-semibold">Salary</span> tabs in the sidebar to view your own records.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          {isSupervisor ? `Welcome, ${user.username}` : "Dashboard"}
        </h1>
        <p className="text-sm text-slate-500">
          {isSupervisor
            ? "Your attendance workspace for the assigned client."
            : `Overview for ${month}`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${s.color}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{s.label}</p>
                <p className="text-xl font-bold text-slate-800">{s.value}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {isSupervisor ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-slate-800">New Joinees</h2>
            </div>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Date of Joining</th>
                    <th className="py-2">Assigned Client</th>
                  </tr>
                </thead>
                <tbody>
                  {newJoinees.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-slate-400">
                        No new joinees this month.
                      </td>
                    </tr>
                  )}
                  {newJoinees.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-medium text-slate-800">{e.name}</td>
                      <td className="py-2 pr-4 text-slate-600">{e.dateOfJoining}</td>
                      <td className="py-2 text-slate-600">{e.client?.name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-2">
              <UserMinus className="h-5 w-5 text-rose-600" />
              <h2 className="text-lg font-semibold text-slate-800">Left Employees</h2>
            </div>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Date of Leaving</th>
                    <th className="py-2">Last Client</th>
                  </tr>
                </thead>
                <tbody>
                  {leftEmployees.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-slate-400">
                        No employees have left.
                      </td>
                    </tr>
                  )}
                  {leftEmployees.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-medium text-slate-800">{e.name}</td>
                      <td className="py-2 pr-4 text-slate-600">{e.dateOfExit}</td>
                      <td className="py-2 text-slate-600">{e.client?.name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        <>
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <h2 className="text-lg font-semibold text-slate-800">Compliance Status — {month}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-4">Client</th>
                    <th className="py-2 pr-4">PF</th>
                    <th className="py-2 pr-4">ESIC</th>
                    <th className="py-2">NAPS</th>
                  </tr>
                </thead>
                <tbody>
                  {compliance.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400">
                        No compliance records for this month yet.
                      </td>
                    </tr>
                  )}
                  {compliance.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-medium text-slate-700">{c.client?.name}</td>
                      <td className="py-2 pr-4">
                        <Badge color={c.pfFilingStatus === "Paid" ? "green" : c.pfFilingStatus === "Filed" ? "blue" : "amber"}>
                          {c.pfFilingStatus}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge color={c.esicFilingStatus === "Paid" ? "green" : c.esicFilingStatus === "Filed" ? "blue" : "amber"}>
                          {c.esicFilingStatus}
                        </Badge>
                      </td>
                      <td className="py-2">
                        <Badge color={c.napsComplianceStatus === "Done" ? "green" : "amber"}>
                          {c.napsComplianceStatus}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-slate-800">Salary Summary — {month}</h2>
            </div>
            {salaries.length === 0 ? (
              <p className="text-sm text-slate-400">No salary records for this month yet.</p>
            ) : (
              <p className="text-sm text-slate-600">
                {salaries.length} employees paid · Total net payout{" "}
                <span className="font-semibold text-slate-800">
                  ₹{monthlySalary.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
