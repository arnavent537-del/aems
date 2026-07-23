import { prisma } from "@/lib/db";

const CLIENT_CODE_MAP: Record<string, number> = {
  "Shree Ashtvinayak": 10001,
  "Infinity Technology": 20001,
  "Sai Packing": 30001,
  "Inled Technology": 40001,
  "TBK India": 50001,
  "Arun Enterprises": 60001,
  "Arnav Enterprises": 1,  // Will start from 00001
};

export async function generateEmployeeCode(clientId: string): Promise<string> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true },
  });

  if (!client) {
    throw new Error(`Client not found: ${clientId}`);
  }

  const baseCode = CLIENT_CODE_MAP[client.name];
  if (!baseCode) {
    throw new Error(`Client code not found for: ${client.name}. Available clients: ${Object.keys(CLIENT_CODE_MAP).join(", ")}`);
  }

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
        if (baseCode === 1 && empNum >= 1 && empNum < 99999) {
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
