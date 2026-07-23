import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorize, supervisorClientIds, getArnavAccess, getSelfEmployeeId, isArnavClient } from "@/lib/authorize";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const session = await authorize(["admin", "accountant", "supervisor"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: params.id },
      include: { client: true },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Arnav Enterprises self-restriction
    if (session.role !== "admin" && await isArnavClient(employee.clientId)) {
      const arnavAccess = await getArnavAccess(session);
      if (arnavAccess === "blocked") {
        return NextResponse.json({ error: "Unauthorized access to employee" }, { status: 403 });
      }
      // "self" access: only allow viewing own record
      const selfEmpId = await getSelfEmployeeId(session);
      if (!selfEmpId || selfEmpId !== employee.id) {
        return NextResponse.json({ error: "Unauthorized access to employee" }, { status: 403 });
      }
    }

    // Supervisors can only view employees of their assigned clients
    if (session.role === "supervisor") {
      const allowed = supervisorClientIds(session);
      if (!allowed || allowed.length === 0 || !allowed.includes(employee.clientId)) {
        return NextResponse.json({ error: "Unauthorized access to employee" }, { status: 403 });
      }
    }

    const { passwordHash, ...employeeData } = employee;

    return NextResponse.json({
      ...employeeData,
      isRegistered: passwordHash !== null,
    });
  } catch (error) {
    console.error("GET Employee By ID Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const session = await authorize(["admin", "accountant"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const existingEmployee = await prisma.employee.findUnique({
      where: { id: params.id },
    });

    if (!existingEmployee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Block non-admin from updating Arnav employees
    if (session.role !== "admin" && await isArnavClient(existingEmployee.clientId)) {
      return NextResponse.json({ error: "Forbidden: Cannot modify Arnav Enterprises employees" }, { status: 403 });
    }

    // Extract update fields
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

    const updatedEmployee = await prisma.employee.update({
      where: { id: params.id },
      data: {
        clientId: clientId || undefined,
        name: name ? name.trim() : undefined,
        dob: dob || undefined,
        address: address ? address.trim() : undefined,
        documentStatus: documentStatus || undefined,
        safetyApronIssued: safetyApronIssued !== undefined ? !!safetyApronIssued : undefined,
        punchingNo: punchingNo !== undefined ? (punchingNo ? punchingNo.trim() : null) : undefined,
        dateOfJoining: dateOfJoining || undefined,
        dateOfExit: dateOfExit !== undefined ? (dateOfExit || null) : undefined,
        exitReason: exitReason !== undefined ? (exitReason ? exitReason.trim() : null) : undefined,
        status:
          dateOfExit !== undefined ? (dateOfExit ? "Left" : "Active") : undefined,
        gender: gender !== undefined ? (gender || null) : undefined,
        branch: branch !== undefined ? (branch ? branch.trim() : null) : undefined,
        bankName: bankName !== undefined ? (bankName ? bankName.trim() : null) : undefined,
        bankAccountNo: bankAccountNo !== undefined ? (bankAccountNo ? bankAccountNo.trim() : null) : undefined,
        ifscCode: ifscCode !== undefined ? (ifscCode ? ifscCode.trim() : null) : undefined,
        pfNo: pfNo !== undefined ? (pfNo ? pfNo.trim() : null) : undefined,
        esicNo: esicNo !== undefined ? (esicNo ? esicNo.trim() : null) : undefined,
        uanNo: uanNo !== undefined ? (uanNo ? uanNo.trim() : null) : undefined,
        phoneNo: phoneNo !== undefined ? (phoneNo ? phoneNo.trim() : null) : undefined,
        aadharNo: aadharNo !== undefined ? (aadharNo ? aadharNo.trim() : null) : undefined,
        panNo: panNo !== undefined ? (panNo ? panNo.trim() : null) : undefined,
        salaryRate: salaryRate !== undefined ? parseFloat(salaryRate) : undefined,
        otRateMultiplier: otRateMultiplier !== undefined ? parseFloat(otRateMultiplier) : undefined,
      },
    });

    // Log to audit trail
    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: "UPDATE_EMPLOYEE",
        details: `Updated employee ${updatedEmployee.name} (${updatedEmployee.employeeCode}).`,
      },
    });

    return NextResponse.json(updatedEmployee);
  } catch (error) {
    console.error("PUT Employee Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const session = await authorize(["admin", "accountant"]);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: params.id },
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Block non-admin from deleting Arnav employees
    if (session.role !== "admin" && await isArnavClient(employee.clientId)) {
      return NextResponse.json({ error: "Forbidden: Cannot delete Arnav Enterprises employees" }, { status: 403 });
    }

    await prisma.employee.delete({
      where: { id: params.id },
    });

    // Log to audit trail
    await prisma.auditTrail.create({
      data: {
        userId: session.userId,
        action: "DELETE_EMPLOYEE",
        details: `Deleted employee ${employee.name} (${employee.employeeCode}).`,
      },
    });

    return NextResponse.json({ success: true, message: "Employee deleted successfully" });
  } catch (error) {
    console.error("DELETE Employee Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
