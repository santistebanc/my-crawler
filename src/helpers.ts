import { RequestParams } from "./fetchPageAndExtractData";
import { parse, format, isValid, addDays } from "date-fns";
import { FlightData } from "./entities";

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
    const parsedDate = parseDateString(dateStr);
    if (!parsedDate) return "";
    const dateTimeStr = format(parsedDate, "yyyy-MM-dd HH:mm");
    return `${dateTimeStr} ${timezone}`;
  } catch (error) {
    return "";
  }
}

/**
 * Merges flight data from source into target
 */
export function mergeFlightData(target: FlightData, source: FlightData): void {
  // Merge airlines
  source.airlines.forEach((airline) => {
    if (!target.airlines.find((a) => a.id === airline.id)) {
      target.airlines.push(airline);
    }
  });

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