export interface PayrollInput {
  basicSalary: number;
  otSalary: number;
  clientRules: { pfApplicable: boolean; esicApplicable: boolean; ptApplicable: boolean };
}

export interface PayrollResult {
  grossSalary: number;
  pfDeduction: number;
  esicDeduction: number;
  ptDeduction: number;
  advanceDeduction: number;
  otherDeductions: number;
  netPaid: number;
}

const PF_WAGE_CAP = 15000;
const ESIC_WAGE_CAP = 21000;
const PF_RATE = 0.12;
const ESIC_RATE = 0.0075;

export function calculatePtDeduction(grossSalary: number): number {
  if (grossSalary <= 10000) return 0;
  if (grossSalary <= 20000) return 150;
  if (grossSalary <= 30000) return 200;
  return 300;
}

export function computePayroll(
  input: PayrollInput,
  advanceDeduction = 0,
  otherDeductions = 0
): PayrollResult {
  const grossSalary = round2(input.basicSalary + input.otSalary);

  const pfDeduction = input.clientRules.pfApplicable
    ? round2(Math.min(input.basicSalary, PF_WAGE_CAP) * PF_RATE)
    : 0;

  const esicDeduction = input.clientRules.esicApplicable
    ? round2(Math.min(grossSalary, ESIC_WAGE_CAP) * ESIC_RATE)
    : 0;

  const ptDeduction = input.clientRules.ptApplicable ? calculatePtDeduction(grossSalary) : 0;

  const totalDeductions = round2(
    pfDeduction + esicDeduction + ptDeduction + advanceDeduction + otherDeductions
  );

  const netPaid = round2(grossSalary - totalDeductions);

  return {
    grossSalary,
    pfDeduction,
    esicDeduction,
    ptDeduction,
    advanceDeduction,
    otherDeductions,
    netPaid,
  };
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
