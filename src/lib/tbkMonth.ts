/**
 * TBK Month utilities - Attendance month runs from 26th to 25th
 * Example: "July 2026" = June 26, 2026 to July 25, 2026
 */

// Get the attendance month label (YYYY-MM) for a given date
export function getTbkMonthForDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate();
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed

  if (day >= 26) {
    // Date is 26th or later -> belongs to next month's attendance period
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  } else {
    // Date is 1st-25th -> belongs to current month's attendance period
    return `${year}-${String(month).padStart(2, "0")}`;
  }
}

// Get start date (26th of previous month) for a TBK month (YYYY-MM)
export function getTbkStartDate(tbkMonth: string): string {
  const [year, month] = tbkMonth.split("-").map(Number);

  // Previous month (26th of previous month is the start)
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

// Get day of month (1-31) for display purposes in TBK month
export function getTbkDayNumber(dateStr: string, tbkMonth: string): number {
  const startDate = getTbkStartDate(tbkMonth);
  const start = new Date(startDate);
  const date = new Date(dateStr);
  const diffDays = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays + 1; // 1-indexed
}

// Get current TBK month based on today
export function getCurrentTbkMonth(): string {
  return getTbkMonthForDate(new Date().toISOString().slice(0, 10));
}

// Convert TBK month to date range query for database (returns [startDate, endDate])
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

// Get all dates as YYYY-MM format strings that fall within the TBK month
export function getTbkMonthPrefixes(tbkMonth: string): string[] {
  const start = getTbkStartDate(tbkMonth);
  const end = getTbkEndDate(tbkMonth);

  const prefixes = new Set<string>();
  const current = new Date(start);
  const endDate = new Date(end);

  while (current <= endDate) {
    prefixes.add(current.toISOString().slice(0, 7));
    current.setDate(current.getDate() + 1);
  }

  return Array.from(prefixes).sort();
}
