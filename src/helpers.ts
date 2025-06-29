import { RequestParams } from "./fetchPageAndExtractData";
import { parse, format, isValid, addDays } from "date-fns";
import { FlightData } from "./entities";
import { DateTime } from "luxon";
import airportsDataRaw from "./airports.json";
import airlineCodesRaw from "./airlines.json";

// Use the .data property for lookups
const airportsData = airportsDataRaw.data;
const airlineCodes = airlineCodesRaw.data;

/**
 * Builds URL search parameters from request parameters for flightsfinder.com portal URLs
 * @param requestParams - The request parameters containing flight search criteria
 * @returns URLSearchParams object ready to be used in URL construction
 */
export function buildPortalSearchParams(requestParams: RequestParams): URLSearchParams {
  return new URLSearchParams({
    originplace: requestParams.originplace || "",
    destinationplace: requestParams.destinationplace || "",
    outbounddate: requestParams.outbounddate || "",
    inbounddate: requestParams.inbounddate || "",
    cabinclass: requestParams.cabinclass || "Economy",
    adults: requestParams.adults.toString(),
    children: requestParams.children.toString(),
    infants: requestParams.infants.toString(),
    currency: requestParams.currency,
  });
}

/**
 * Builds a complete portal URL with search parameters
 * @param portal - The portal name (e.g., 'sky', 'kiwi')
 * @param requestParams - The request parameters containing flight search criteria
 * @returns Complete URL string for the portal
 */
export function buildPortalUrl(portal: string, requestParams: RequestParams): string {
  const searchParams = buildPortalSearchParams(requestParams);
  return `https://www.flightsfinder.com/portal/${portal}?${searchParams.toString()}`;
}

/**
 * Extracts the flightsfinder_session cookie from a set-cookie header string.
 * @param setCookieHeader - The set-cookie header string from a response
 * @returns The session cookie string, or an empty string if not found
 */
export function extractSessionCookie(setCookieHeader: string | null): string {
  if (!setCookieHeader) return "";
  const cookies = setCookieHeader.split(",").map((cookie) => cookie.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith("flightsfinder_session=")) {
      return cookie.split(";")[0];
    }
  }
  return "";
}

/**
 * Parses a date string in the format "EEE, dd MMM yyyy"
 */
export function parseDateString(dateStr: string): Date | null {
  try {
    const parsedDate = parse(dateStr, "EEE, dd MMM yyyy", new Date());
    return isValid(parsedDate) ? parsedDate : null;
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
    const adjustedDate = addDays(parsedDate, days);
    return format(adjustedDate, "EEE, dd MMM yyyy");
  } catch (error) {
    return dateStr;
  }
}

/**
 * Creates a timezoned datetime string
 */
export function createTimezonedDatetime(
  dateStr: string,
  timeStr: string,
  timezone: string
): string {
  try {
    const parsedDate = parseDateString(dateStr) || new Date();
    // Parse the time string using date-fns
    let timeDate: Date;
    if (timeStr.match(/^\d{1,2}:\d{2}$/)) {
      timeDate = parse(timeStr, "HH:mm", new Date());
    } else {
      timeDate = parse(timeStr, "h:mm a", new Date());
    }
    if (!isValid(timeDate)) {
      console.warn(`⚠️ Could not parse time string: "${timeStr}"`);
      return "";
    }
    
    // Combine the date and time
    const combinedDate = new Date(parsedDate);
    combinedDate.setHours(timeDate.getHours(), timeDate.getMinutes(), 0, 0);
    
    // Use Luxon for all timezone handling
    let dt;
    if (!timezone || timezone === "\\N" || timezone === "null") {
      // Default to UTC for missing or null timezones
      dt = DateTime.fromJSDate(combinedDate, { zone: "UTC" });
    } else if (timezone.startsWith('UTC')) {
      // Handle UTC±HH:MM format
      const tz = timezone.replace('−', '-').replace('–', '-');
      const match = tz.match(/^UTC([+-])(\d{2}):(\d{2})$/);
      if (match) {
        const sign = match[1] === '-' ? -1 : 1;
        const hours = parseInt(match[2], 10);
        const minutes = parseInt(match[3], 10);
        const offsetMinutes = sign * (hours * 60 + minutes);
        
        // Create a DateTime in the specified offset timezone
        dt = DateTime.fromJSDate(combinedDate, { zone: "UTC" }).plus({ minutes: offsetMinutes });
        // Convert to the offset timezone string format
        const offsetStr = `${sign === 1 ? '+' : '-'}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        return dt.toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS") + offsetStr;
      } else {
        dt = DateTime.fromJSDate(combinedDate, { zone: "UTC" });
      }
    } else {
      // Handle IANA timezone format (e.g., "Australia/Perth", "Europe/Vienna")
      dt = DateTime.fromJSDate(combinedDate, { zone: timezone });
      if (!dt.isValid) {
        dt = DateTime.fromJSDate(combinedDate, { zone: "UTC" });
      }
    }
    
    // Return ISO string with timezone offset
    return dt.toISO() || '';
  } catch (error) {
    console.warn(`⚠️ Error creating timezoned datetime: ${error}`);
    return (DateTime.fromJSDate(new Date()).toUTC().toISO() as string) || '';
  }
}

/**
 * Merges flight data from source into target
 */
export function mergeFlightData(target: FlightData, source: FlightData): void {
  // Merge deals
  source.deals.forEach((deal) => {
    if (!target.deals.find((d) => d.id === deal.id)) {
      target.deals.push(deal);
    }
  });

  // Merge flights
  source.flights.forEach((flight) => {
    if (!target.flights.find((f) => f.id === flight.id)) {
      target.flights.push(flight);
    }
  });
}