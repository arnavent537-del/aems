import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize, supervisorClientIds, getArnavAccess, getSelfEmployeeId, isArnavClient } from "@/lib/authorize";
import { generateEmployeeCode } from "@/lib/employeeCodeGenerator";

// GET: Fetch employees list
export async function GET(request: Request) {
  try {
    const session = await authorize(["admin", "accountant", "supervisor"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const includeExited = searchParams.get("includeExited") === "true";

    const whereClause: any = {};

    // Apply Supervisor restrictions
    if (session.role === "supervisor") {
      const allowed = supervisorClientIds(session);
      if (!allowed || allowed.length === 0) {
        return NextResponse.json([]); // No client assigned, see nobody
      }
      if (clientId) {
        if (!allowed.includes(clientId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        whereClause.clientId = clientId;
      } else {
        whereClause.clientId = { in: allowed };
      }
      whereClause.dateOfExit = null; // Supervisors cannot see exited employees
    } else {
      // Admin/Accountant can filter by client
      if (clientId) {
        whereClause.clientId = clientId;
      }

      // Filter exited employees if requested
      if (!includeExited) {
        whereClause.dateOfExit = null;
      }
    }

    // Arnav Enterprises self-restriction for non-admin users
    if (session.role !== "admin") {
      const arnavAccess = await getArnavAccess(session);

      if (arnavAccess === "blocked") {
        // No linked employee — cannot see Arnav data at all
        if (clientId && await isArnavClient(clientId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        // Exclude Arnav from list queries
        if (whereClause.clientId && typeof whereClause.clientId === "object" && "in" in whereClause.clientId) {
          const arnavClient = await prisma.client.findUnique({ where: { name: "Arnav Enterprises" }, select: { id: true } });
          if (arnavClient) {
            whereClause.clientId.in = whereClause.clientId.in.filter((id: string) => id !== arnavClient.id);
            if (whereClause.clientId.in.length === 0) return NextResponse.json([]);
          }
        } else if (!whereClause.clientId) {
          const arnavClient = await prisma.client.findUnique({ where: { name: "Arnav Enterprises" }, select: { id: true } });
          if (arnavClient) {
            whereClause.NOT = { clientId: arnavClient.id };
          }
        }
      } else if (arnavAccess === "self") {
        // Linked employee — can only see own record in Arnav
        const selfEmpId = await getSelfEmployeeId(session);
        if (!selfEmpId) {
          return NextResponse.json({ error: "No employee record linked" }, { status: 403 });
        }

        if (clientId && await isArnavClient(clientId)) {
          // Requesting Arnav specifically — return only self
          whereClause.id = selfEmpId;
          whereClause.clientId = clientId;
        } else if (!clientId) {
          // No clientId specified — return self for Arnav, exclude Arnav from other clients
          const arnavClient = await prisma.client.findUnique({ where: { name: "Arnav Enterprises" }, select: { id: true } });
          if (arnavClient) {
            // Return self record (which is in Arnav) + employees from other clients
            whereClause.OR = [
              { id: selfEmpId },
              { clientId: { not: arnavClient.id } },
            ];
          }
        }
        // If clientId is specified and it's NOT Arnav, normal behavior applies
      }
    }

    const employees = await prisma.employee.findMany({
      where: whereClause,
      select: {
        id: true,
        employeeCode: true,
        clientId: true,
        name: true,
        dob: true,
        address: true,
        documentStatus: true,
        safetyApronIssued: true,
        punchingNo: true,
        passwordHash: true,
        dateOfJoining: true,
        dateOfExit: true,
        exitReason: true,
        status: true,
        gender: true,
        branch: true,
        bankName: true,
        bankAccountNo: true,
        ifscCode: true,
        pfNo: true,
        esicNo: true,
        uanNo: true,
        phoneNo: true,
        aadharNo: true,
        panNo: true,
        salaryRate: true,
        otRateMultiplier: true,
        assignedLocation: true,
        client: {
          select: { name: true },
        },
      },
      orderBy: { employeeCode: "asc" },
    });

    const result = employees.map(({ passwordHash, ...rest }) => ({
      ...rest,
      isRegistered: passwordHash !== null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET Employees Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Add a new employee
export async function POST(request: Request) {
  try {
    const session = await authorize(["admin", "accountant"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      clientId,
      name,
      dob,
      address,
      documentStatus,
      safetyApronIssued,
      punchingNo,
      dateOfJoining,
      dateOfExit,
      exitReason,
      gender,
      branch,
      bankName,
      bankAccountNo,
      ifscCode,
      pfNo,
      esicNo,
      uanNo,
      phoneNo,
      aadharNo,
      panNo,
      salaryRate,
      otRateMultiplier,
    } = body;

    // Validation
    if (!clientId || !name || !dob || !address || !documentStatus || !dateOfJoining || salaryRate === undefined) {
      return NextResponse.json(
        { error: "Mandatory fields: client, name, dob, address, documentStatus, dateOfJoining, salaryRate" },
        { status: 400 }
      );
    }

    // Block non-admin users from creating employees in Arnav Enterprises
    if (session.role !== "admin" && await isArnavClient(clientId)) {
      return NextResponse.json({ error: "Forbidden: Cannot create employees in Arnav Enterprises" }, { status: 403 });
    }

    // Auto-generate employee code based on client
    let employeeCode;
    try {
      employeeCode = await generateEmployeeCode(clientId);
    } catch (error: any) {
      console.error("Error generating employee code:", error);
      return NextResponse.json(
        { error: `Failed to generate employee code: ${error.message}` },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.create({
      data: {
        employeeCode,
        clientId,
        name: name.trim(),
        status: dateOfExit ? "Left" : "Active",
        dob,
        address: address.trim(),
        documentStatus,
        safetyApronIssued: !!safetyApronIssued,
        punchingNo: punchingNo ? punchingNo.trim() : null,
        dateOfJoining,
        dateOfExit: dateOfExit || null,
        exitReason: exitReason ? exitReason.trim() : null,
        gender: gender || null,
        branch: branch ? branch.trim() : null,
        bankName: bankName ? bankName.trim() : null,
        bankAccountNo: bankAccountNo ? bankAccountNo.trim() : null,
        ifscCode: ifscCode ? ifscCode.trim() : null,
        pfNo: pfNo ? pfNo.trim() : null,
        esicNo: esicNo ? esicNo.trim() : null,
        uanNo: uanNo ? uanNo.trim() : null,
        phoneNo: phoneNo ? phoneNo.trim() : null,
        aadharNo: aadharNo ? aadharNo.trim() : null,
        panNo: panNo ? panNo.trim() : null,
        salaryRate: parseFloat(salaryRate),
        otRateMultiplier: parseFloat(otRateMultiplier || 2.0),
      },
    });

    // Log to audit trail
    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: "CREATE_EMPLOYEE",
        details: `Created employee ${employee.name} (${employee.employeeCode}) under client ${clientId}.`,
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error: any) {
    console.error("POST Employee Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
