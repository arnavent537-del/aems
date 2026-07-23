import crypto from "crypto";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET || "aems-super-secret-key-1234567890-aems";

export interface SessionData {
  userId: string;
  username: string;
  role: string;
  assignedClientId: string | null;
  assignedClientIds: string[];
}

export function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, "salt-aems", 1000, 64, "sha512").toString("hex");
}

export function signToken(data: SessionData): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    ...data,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24 hours
  })).toString("base64url");
  
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
    
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): SessionData | null {
  try {
    const [headerB64, payloadB64, signature] = token.split(".");
    if (!headerB64 || !payloadB64 || !signature) return null;
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");
      
    if (signature !== expectedSignature) return null;
    
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    
    return {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
      assignedClientId: payload.assignedClientId ?? ((Array.isArray(payload.assignedClientIds) && payload.assignedClientIds[0]) || null),
      assignedClientIds: Array.isArray(payload.assignedClientIds) ? payload.assignedClientIds : (payload.assignedClientId ? [payload.assignedClientId] : [])
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("aems_session")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function setSession(data: SessionData) {
  const token = signToken(data);
  const cookieStore = await cookies();
  cookieStore.set("aems_session", token, {
    httpOnly: true,
    secure: process.env.HTTPS === "true",
    sameSite: "strict",
    maxAge: 60 * 60 * 24, // 1 day
    path: "/"
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete("aems_session");
}
