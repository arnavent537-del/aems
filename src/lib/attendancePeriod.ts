import { getTbkEndDate, getTbkStartDate } from "@/lib/tbkMonth";

export type AttendancePeriod = {
  start: string;
  end: string;
};

type EmployeeDates = {
  dateOfJoining: string;
  dateOfExit: string | null;
};

/** Returns the actual date range covered by the selected attendance month. */
export function getAttendancePeriod(month: string, isTbk: boolean): AttendancePeriod {
  if (isTbk) {
    return { start: getTbkStartDate(month), end: getTbkEndDate(month) };
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** Converts employee dates stored as DD-MM-YYYY (or legacy variants) to YYYY-MM-DD. */
function employeeDateToIso(date: string | null): string | null {
  if (!date) return null;

  const dmy = date.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;

  const ymd = date.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;

  return null;
}

/** Whether the employee's employment dates overlap an attendance period. */
export function wasEmployedDuringPeriod(employee: EmployeeDates, period: AttendancePeriod): boolean {
  const joinedOn = employeeDateToIso(employee.dateOfJoining);
  const exitedOn = employeeDateToIso(employee.dateOfExit);

  return (!joinedOn || joinedOn <= period.end) && (!exitedOn || exitedOn >= period.start);
}
