import { getSession, SessionData } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Validates session and checks if the user role is authorized.
 * Returns SessionData if authorized, otherwise returns null.
 */
export async function authorize(allowedRoles: string[]): Promise<SessionData | null> {
  const session = await getSession();
  if (!session) return null;
  if (!allowedRoles.includes(session.role)) return null;
  return session;
}

/**
 * Returns the set of client IDs a supervisor is allowed to access.
 * For admins/accountants this returns null (no restriction).
 */
export function supervisorClientIds(session: SessionData | null): string[] | null {
  if (!session) return null;
  if (session.role === "supervisor") {
    return session.assignedClientIds ?? (session.assignedClientId ? [session.assignedClientId] : []);
  }
  return null;
}

/**
 * Checks if the client is restricted to admins only.
 * @deprecated Use getArnavAccess() for more granular access control.
 */
export async function isArnavRestricted(clientId: string): Promise<boolean> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true },
  });
  return client?.name === "Arnav Enterprises";
}

/**
 * Checks if a client is "Arnav Enterprises" by ID.
 */
export async function isArnavClient(clientId: string): Promise<boolean> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true },
  });
  return client?.name === "Arnav Enterprises";
}

/**
 * Returns the user's Arnav Enterprises access level:
 * - "full": admin — can see/manage all data
 * - "self": non-admin with linked employee — can see only own data
 * - "blocked": non-admin without linked employee — no access
 */
export async function getArnavAccess(session: SessionData | null): Promise<"full" | "self" | "blocked"> {
  if (!session) return "blocked";
  if (session.role === "admin") return "full";

  // Check if user has a linked employee record
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { employeeId: true },
  });

  return user?.employeeId ? "self" : "blocked";
}

/**
 * Returns the linked Employee ID for the current staff user.
 * Only works for non-employee roles (admin/accountant/supervisor).
 * Returns null if no employee is linked.
 */
export async function getSelfEmployeeId(session: SessionData | null): Promise<string | null> {
  if (!session) return null;
  if (session.role === "employee") return null; // employee role uses different lookup

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { employeeId: true },
  });

  return user?.employeeId ?? null;
}
