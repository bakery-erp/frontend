import { EthDateTime } from "ethiopian-calendar-date-converter";

const ETH_MONTHS = [
  "Meskerem",
  "Tikimt",
  "Hidar",
  "Tahsas",
  "Tir",
  "Yakatit",
  "Maggabit",
  "Miyazya",
  "Ginbot",
  "Sene",
  "Hamle",
  "Nehase",
  "Pagume"
];

const GREG_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

const GREG_FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

/**
 * Returns the active calendar preference stored in localStorage.
 * Defaults to "ETHIOPIAN".
 */
export function getActiveCalendarPreference(): "ETHIOPIAN" | "GREGORIAN" {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("bakery_calendar_preference");
      if (saved === "GREGORIAN") return "GREGORIAN";
    } catch {
      // Ignore localStorage exceptions
    }
  }
  return "ETHIOPIAN";
}

/**
 * Pure Gregorian date formatter
 */
export function formatGregDate(dateInput: Date | string | number | null | undefined, includeTime = false): string {
  if (!dateInput) return "N/A";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "N/A";

    const monthName = GREG_MONTHS[d.getMonth()];
    const dateStr = `${monthName} ${d.getDate()}, ${d.getFullYear()}`;

    if (!includeTime) return dateStr;

    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${dateStr} · ${hours}:${minutes}`;
  } catch {
    return String(dateInput);
  }
}

/**
 * Pure Ethiopian Calendar formatter
 */
export function formatPureEthDate(dateInput: Date | string | number | null | undefined, includeTime = false): string {
  if (!dateInput) return "N/A";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "N/A";

    const eth = EthDateTime.fromEuropeanDate(d);
    const monthName = ETH_MONTHS[eth.month - 1] || `Month ${eth.month}`;
    const dateStr = `${monthName} ${eth.date}, ${eth.year}`;

    if (!includeTime) return dateStr;

    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${dateStr} · ${hours}:${minutes}`;
  } catch {
    return String(dateInput);
  }
}

/**
 * Main application date formatter.
 * Automatically checks the system calendar preference ("ETHIOPIAN" vs "GREGORIAN")
 * and formats accordingly.
 * Note: Named formatEthDate for drop-in compatibility with existing codebase pages.
 */
export function formatEthDate(dateInput: Date | string | number | null | undefined, includeTime = false): string {
  if (getActiveCalendarPreference() === "GREGORIAN") {
    return formatGregDate(dateInput, includeTime);
  }
  return formatPureEthDate(dateInput, includeTime);
}

/**
 * Alias for formatEthDate
 */
export const formatAppDate = formatEthDate;

/**
 * Returns month name based on active calendar
 */
export function getEthMonthName(monthIndex: number): string {
  if (getActiveCalendarPreference() === "GREGORIAN") {
    return GREG_FULL_MONTHS[monthIndex - 1] || `Month ${monthIndex}`;
  }
  return ETH_MONTHS[monthIndex - 1] || `Month ${monthIndex}`;
}

export { ETH_MONTHS, GREG_MONTHS, GREG_FULL_MONTHS, EthDateTime };
