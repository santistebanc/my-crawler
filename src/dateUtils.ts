// 1. Imports and Dependencies
import airportsDataRaw from "./airports.json";
import { logger, LogCategory } from "./logger";

// 2. Configuration and Setup
const airportsData = airportsDataRaw.data;

// 3. Entry Point / Main Execution
// (This module only exports functions, no main execution)

// 4. API Surface / Public Interface

/**
 * Parses a date string in the format "EEE, dd MMM yyyy" (e.g., "Fri, 10 Oct 2025")
 */
export function parseDateString(dateStr: string): Date | null {
  try {
    // Handle format like "Fri, 10 Oct 2025"
    const match = dateStr.match(/^([A-Za-z]{3}),\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
    if (!match) return null;
    
    const [, dayName, day, monthName, year] = match;
    const monthIndex = getMonthIndex(monthName);
    if (monthIndex === -1) return null;
    
    const date = new Date(parseInt(year), monthIndex, parseInt(day));
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    return null;
  }
}

/**
 * Adds days to a date string and returns the new date string
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  try {
    const parsedDate = parseDateString(dateStr);
    if (!parsedDate) return dateStr;
    
    const adjustedDate = new Date(parsedDate);
    adjustedDate.setDate(adjustedDate.getDate() + days);
    
    return formatDateString(adjustedDate);
  } catch (error) {
    return dateStr;
  }
}

/**
 * Creates a timezoned datetime string using UTC offset format
 */
export function createTimezonedDatetime(
  dateStr: string,
  timeStr: string,
  timezone: string | null
): string {
  try {
    const parsedDate = parseDateString(dateStr) || new Date();
    const timeDate = parseTimeString(timeStr);
    if (!timeDate) {
      logger.warn(LogCategory.DATA, `Could not parse time string`, { timeStr });
      return "";
    }
    
    // Combine the date and time
    const combinedDate = new Date(parsedDate);
    combinedDate.setHours(timeDate.getHours(), timeDate.getMinutes(), 0, 0);
    
    // Handle timezone conversion
    if (!timezone || timezone === "\\N" || timezone === "null") {
      // Default to UTC for missing or null timezones
      return formatToISOString(combinedDate, "UTC+00:00");
    } else if (timezone.startsWith('UTC')) {
      // Handle UTC±HH:MM format (e.g., "UTC+08:00", "UTC-05:00")
      return formatToISOString(combinedDate, timezone);
    } else {
      // Handle IANA timezone format (e.g., "Australia/Perth", "Europe/Vienna")
      // For now, default to UTC since we're removing external libraries
      logger.warn(LogCategory.DATA, `IANA timezone not supported, using UTC`, { timezone });
      return formatToISOString(combinedDate, "UTC+00:00");
    }
  } catch (error) {
    logger.warn(LogCategory.DATA, `Error creating timezoned datetime`, { error, dateStr, timeStr, timezone });
    return formatToISOString(new Date(), "UTC+00:00");
  }
}

/**
 * Formats a date for Kiwi portal (YYYY-MM-DD to dd/MM/yyyy)
 */
export function formatDateForKiwi(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = parseISODate(dateStr);
    if (!date) return dateStr;
    return formatDateAsDDMMYYYY(date);
  } catch (error) {
    logger.warn(LogCategory.DATA, `Could not parse date for Kiwi`, { dateStr });
    return dateStr;
  }
}

/**
 * Validates that a date is not in the past
 */
export function validateNotPastDateISO(dateStr: string): boolean {
  const date = parseISODate(dateStr);
  if (!date) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return date >= today;
}

/**
 * Creates a datetime string without timezone for ID generation (YYYYMMDDHHMM format)
 */
export function createDatetimeForId(dateStr: string, timeStr: string): string {
  try {
    const parsedDate = parseDateString(dateStr) || new Date();
    const timeDate = parseTimeString(timeStr);
    if (!timeDate) return "";
    
    // Combine the date and time
    const combinedDate = new Date(parsedDate);
    combinedDate.setHours(timeDate.getHours(), timeDate.getMinutes(), 0, 0);
    
    // Format as YYYYMMDDHHMM (without timezone)
    return formatDateAsYYYYMMDDHHMM(combinedDate);
  } catch (error) {
    return "";
  }
}

// 5. Implementation Details / Helper Functions

/**
 * Parses a time string in various formats (HH:mm, h:mm a, etc.)
 */
function parseTimeString(timeStr: string): Date | null {
  try {
    // Handle 24-hour format (HH:mm)
    const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      const hours = parseInt(match24[1], 10);
      const minutes = parseInt(match24[2], 10);
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
      }
    }
    
    // Handle 12-hour format with AM/PM (h:mm a, h:mma, etc.)
    const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)$/);
    if (match12) {
      let hours = parseInt(match12[1], 10);
      const minutes = parseInt(match12[2], 10);
      const period = match12[3].toLowerCase();
      
      if (hours === 12) {
        hours = period === 'am' ? 0 : 12;
      } else if (period === 'pm') {
        hours += 12;
      }
      
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Parses an ISO date string (YYYY-MM-DD)
 */
function parseISODate(dateStr: string): Date | null {
  try {
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    
    const [, year, month, day] = match;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    return null;
  }
}

/**
 * Gets month index from month name
 */
function getMonthIndex(monthName: string): number {
  const months = [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ];
  const monthLower = monthName.toLowerCase().substring(0, 3);
  return months.indexOf(monthLower);
}

/**
 * Formats a date as "EEE, dd MMM yyyy"
 */
function formatDateString(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  return `${dayName}, ${day} ${month} ${year}`;
}

/**
 * Formats a date as dd/MM/yyyy
 */
function formatDateAsDDMMYYYY(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}

/**
 * Formats a date as YYYYMMDDHHMM
 */
function formatDateAsYYYYMMDDHHMM(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${year}${month}${day}${hours}${minutes}`;
}

/**
 * Formats a date to ISO string with timezone offset
 */
function formatToISOString(date: Date, timezone: string): string {
  try {
    // Handle UTC±HH:MM format
    const match = timezone.match(/^UTC([+-])(\d{2}):(\d{2})$/);
    if (!match) {
      // Default to UTC if format is invalid
      return date.toISOString();
    }
    
    const [, sign, hours, minutes] = match;
    const offsetHours = parseInt(hours, 10);
    const offsetMinutes = parseInt(minutes, 10);
    const totalOffsetMinutes = (sign === '-' ? -1 : 1) * (offsetHours * 60 + offsetMinutes);
    
    // Create a new date with the timezone offset applied
    const utcDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
    const offsetDate = new Date(utcDate.getTime() + (totalOffsetMinutes * 60000));
    
    // Format as ISO string with the specified offset
    const isoString = offsetDate.toISOString();
    const offsetStr = `${sign}${hours}:${minutes}`;
    
    return isoString.replace('Z', offsetStr);
  } catch (error) {
    logger.warn(LogCategory.DATA, `Error formatting timezone`, { error, timezone });
    return date.toISOString();
  }
} 