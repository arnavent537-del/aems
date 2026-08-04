import { prisma } from "@/lib/db";

// Each client gets a fixed block of 10,000 codes. Matching is
// case-insensitive substring so short names match full legal names.
const CLIENT_CODE_MAP: Record<string, number> = {
  "ashtvinayak": 10001,
  "infinity": 20001,
  "sai packing": 30001,
  "inled": 40001,
  "tbk": 50001,
  "arun": 60001,
  "arnav": 1,  // Will start from 00001
};

function findBaseCode(clientName: string): number | null {
  const normalized = clientName.toLowerCase();
  for (const [key, base] of Object.entries(CLIENT_CODE_MAP)) {
    if (normalized.includes(key)) return base;
  }
  return null;
}

// Assign the next free block for clients not in CLIENT_CODE_MAP so that
// code generation never fails for newly created clients.
async function nextFreeBlock(): Promise<number> {
  const all = await prisma.employee.findMany({
    select: { employeeCode: true },
  });
  let maxBlockStart = 0;
  for (const emp of all) {
    const num = parseInt(emp.employeeCode, 10);
    if (!isNaN(num)) {
      const blockStart = Math.floor(num / 10000) * 10000 + 1;
      if (blockStart > maxBlockStart) maxBlockStart = blockStart;
    }
  }
  return maxBlockStart === 0 ? 10001 : maxBlockStart + 10000;
}

export async function generateEmployeeCode(clientId: string): Promise<string> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true },
  });

  if (!client) {
    throw new Error(`Client not found: ${clientId}`);
  }

  const baseCode = findBaseCode(client.name) ?? (await nextFreeBlock());

  // Get all employees for this client
  const employees = await prisma.employee.findMany({
    where: { clientId },
    select: { employeeCode: true },
    orderBy: { employeeCode: "desc" },
  });

  let nextSequence = 1;

  if (employees.length > 0) {
    // Find the highest existing employee code for this client
    for (const emp of employees) {
      const empNum = parseInt(emp.employeeCode, 10);
      if (!isNaN(empNum)) {
        // For Arnav Enterprises (baseCode = 1)
        if (baseCode === 1 && empNum >= 1 && empNum < 10000) {
          const sequence = empNum - baseCode + 1;
          if (sequence >= nextSequence) {
            nextSequence = sequence + 1;
          }
        }
        // For other clients (baseCode = 10001, 20001, etc.)
        else if (empNum >= baseCode && empNum < baseCode + 10000) {
          const sequence = empNum - baseCode + 1;
          if (sequence >= nextSequence) {
            nextSequence = sequence + 1;
          }
        }
      }
    }
  }

  // Calculate the final employee code
  const employeeCode = baseCode + nextSequence - 1;

  // Format as 5-digit string
  return String(employeeCode).padStart(5, "0");
}
