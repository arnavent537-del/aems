/**
 * TBK Month utilities - Attendance month runs from 26th to 25th
 * Example: "July 2026" = June 26, 2026 to July 25, 2026
 * Only applies to TBK India Pvt Ltd.
 */

// Get the attendance month label (YYYY-MM) for a given date
export function getTbkMonthForDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate();
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed

  if (day >= 26) {
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  } else {
    return `${year}-${String(month).padStart(2, "0")}`;
  }
}

// Get start date (26th of previous month) for a TBK month (YYYY-MM)
export function getTbkStartDate(tbkMonth: string): string {
  const [year, month] = tbkMonth.split("-").map(Number);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}-26`;
}

// Get end date (25th of current month) for a TBK month (YYYY-MM)
export function getTbkEndDate(tbkMonth: string): string {
  const [year, month] = tbkMonth.split("-").map(Number);
  return `${year}-${String(month).padStart(2, "0")}-25`;
}

// Get array of dates (YYYY-MM-DD) for a TBK month
export function getTbkDates(tbkMonth: string): string[] {
  const start = getTbkStartDate(tbkMonth);
  const end = getTbkEndDate(tbkMonth);
  const dates: string[] = [];
  const current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// Get the number of days in a TBK month
export function getTbkDaysInMonth(tbkMonth: string): number {
  return getTbkDates(tbkMonth).length;
}

// Get current TBK month based on today
export function getCurrentTbkMonth(): string {
  return getTbkMonthForDate(new Date().toISOString().slice(0, 10));
}

// Convert TBK month to date range query for database
export function getTbkDateRange(tbkMonth: string): { start: string; end: string } {
  return {
    start: getTbkStartDate(tbkMonth),
    end: getTbkEndDate(tbkMonth),
  };
}

// Check if a client name is the TBK company (26-25 cycle applies)
export function isTbkClient(clientName: string): boolean {
  return clientName.toLowerCase().includes("tbk");
}
