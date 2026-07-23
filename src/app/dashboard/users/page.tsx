"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, Badge, Button, Modal, Field, inputClass, Toast } from "@/components/ui";
import type { Client, SystemUser } from "@/lib/types";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function UsersPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SystemUser | null>(null);
  const [form, setForm] = useState<any>({ username: "", password: "", role: "accountant", assignedClientId: "", assignedClientIds: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "error" | "success" }>({ msg: "", type: "error" });

  async function load() {
    setLoading(true);
    try {
      const [cl, us] = await Promise.all([api.listClients(), api.listUsers()]);
      setClients(cl);
      setUsers(us);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ username: "", password: "", role: "accountant", assignedClientId: "", assignedClientIds: [] });
    setModalOpen(true);
  }

  function openEdit(u: SystemUser) {
    setEditing(u);
    const ids = u.assignedClientIds && u.assignedClientIds.length
      ? u.assignedClientIds
      : (u.clientLinks && u.clientLinks.length
          ? u.clientLinks.map((l) => l.clientId)
          : (u.assignedClientId ? [u.assignedClientId] : []));
    setForm({ username: u.username, password: "", role: u.role, assignedClientId: ids[0] || "", assignedClientIds: ids });
    setModalOpen(true);
  }

  function toggleClient(id: string) {
    setForm((f: any) => {
      const set = new Set(f.assignedClientIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      const next = Array.from(set);
      return { ...f, assignedClientIds: next, assignedClientId: next[0] || "" };
    });
  }

  async function save() {
    if (!form.username || !form.role) {
      setToast({ msg: "Username and role required", type: "error" });
      return;
    }
    if (!editing && !form.password) {
      setToast({ msg: "Password required for new user", type: "error" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        username: form.username,
        role: form.role,
        assignedClientIds: form.role === "supervisor" ? form.assignedClientIds : [],
        assignedClientId: form.role === "supervisor" ? form.assignedClientId || null : null,
      };
      if (form.password) payload.password = form.password;
      if (editing) {
        await api.updateUser(editing.id, payload);
        setToast({ msg: "User updated", type: "success" });
      } else {
        await api.createUser(payload);
        setToast({ msg: "User created", type: "success" });
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      setToast({ msg: e.message || "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(u: SystemUser) {
    if (!confirm(`Delete user ${u.username}?`)) return;
    try {
      await api.deleteUser(u.id);
      setToast({ msg: "User deleted", type: "success" });
      await load();
    } catch (e: any) {
      setToast({ msg: e.message || "Delete failed", type: "error" });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Users</h1>
          <p className="text-sm text-slate-500">Manage accounts and client assignments (admin only).</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add User
        </Button>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Assigned Client(s)</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {!loading && users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{u.username}</td>
                <td className="px-4 py-3">
                  <Badge color={u.role === "admin" ? "purple" : u.role === "supervisor" ? "blue" : "slate"}>
                    {u.role}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {u.role === "supervisor"
                    ? (() => {
                        const ids = u.assignedClientIds && u.assignedClientIds.length
                          ? u.assignedClientIds
                          : (u.clientLinks && u.clientLinks.length
                              ? u.clientLinks.map((l) => l.clientId)
                              : (u.assignedClientId ? [u.assignedClientId] : []));
                        return ids.length > 1
                          ? ids.map((id) => clients.find((c) => c.id === id)?.name).filter(Boolean).join(", ")
                          : (clients.find((c) => c.id === ids[0])?.name || u.assignedClient?.name || "—");
                      })()
                    : u.assignedClient?.name || "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(u.createdAt).toLocaleDateString("en-IN")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => openEdit(u)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(u)} className="rounded p-1.5 text-red-600 hover:bg-red-50" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? "Edit User" : "Add User"}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Username">
            <input className={inputClass} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            {editing && <p className="mt-1 text-xs text-slate-400">Editing the username updates the login ID. The unique record ID stays unchanged.</p>}
          </Field>
          <Field label={editing ? "New Password (leave blank to keep)" : "Password"}>
            <input type="password" className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="Role">
            <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="admin">Admin</option>
              <option value="accountant">Accountant</option>
              <option value="supervisor">Supervisor</option>
              <option value="employee">Employee</option>
            </select>
          </Field>
          {form.role === "supervisor" && (
            <div className="sm:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-600">Assigned Clients</span>
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-300 p-2">
                {clients.length === 0 && (
                  <p className="px-1 py-2 text-xs text-slate-400">No clients available.</p>
                )}
                {clients.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                      checked={form.assignedClientIds.includes(c.id)}
                      onChange={() => toggleClient(c.id)}
                    />
                    <span className="text-slate-700">{c.name}</span>
                  </label>
                ))}
              </div>
              {form.assignedClientIds.length > 0 && (
                <p className="mt-1 text-xs text-slate-400">{form.assignedClientIds.length} client(s) selected.</p>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Toast message={toast.msg} type={toast.type} />
    </div>
  );
}
