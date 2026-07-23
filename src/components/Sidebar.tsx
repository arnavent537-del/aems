"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Wallet,
  Receipt,
  ShieldCheck,
  UserCog,
  LogOut,
  Building2,
} from "lucide-react";
import type { SessionUser } from "@/lib/types";

interface MenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

const MENU: MenuItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "accountant", "supervisor", "employee"] },
  { href: "/dashboard/employees", label: "Employees", icon: Users, roles: ["admin", "accountant"] },
  { href: "/dashboard/attendance", label: "Attendance", icon: CalendarCheck, roles: ["admin", "accountant", "supervisor", "employee"] },
  { href: "/dashboard/advances", label: "Advances", icon: Wallet, roles: ["admin", "accountant", "supervisor", "employee"] },
  { href: "/dashboard/salary", label: "Salary", icon: Receipt, roles: ["admin", "accountant", "supervisor", "employee"] },
  { href: "/dashboard/clients", label: "Clients", icon: Building2, roles: ["admin"] },
  { href: "/dashboard/compliance", label: "Compliance", icon: ShieldCheck, roles: ["admin", "accountant"] },
  { href: "/dashboard/users", label: "Users", icon: UserCog, roles: ["admin"] },
];

export default function Sidebar({ user, onClose }: { user: SessionUser; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const items = MENU.filter((m) => m.roles.includes(user.role));

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
  }

  return (
    <aside className="flex h-full w-64 flex-col bg-slate-900 text-slate-100">
      <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">AEMS</p>
          <p className="text-[11px] text-slate-400">Arnav Enterprises</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 px-3 py-4">
        <div className="mb-3 px-3">
          <p className="text-sm font-semibold capitalize">{user.name || user.username}</p>
          <p className="text-[11px] capitalize text-slate-400">{user.role}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-red-600 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
