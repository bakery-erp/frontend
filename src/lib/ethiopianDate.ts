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

/**
 * Converts a JS Date, timestamp string, or ISO string to Ethiopian Calendar format.
 * Example: "Nehase 25, 2018" or "Nehase 25, 2018 14:30"
 */
export function formatEthDate(dateInput: Date | string | number | null | undefined, includeTime = false): string {
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
  } catch (e) {
    return String(dateInput);
  }
}

/**
 * Returns Ethiopian month name by month index (1-13)
 */
export function getEthMonthName(monthIndex: number): string {
  return ETH_MONTHS[monthIndex - 1] || `Month ${monthIndex}`;
}

export { ETH_MONTHS };
