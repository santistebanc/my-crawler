import { RequestParams } from "./fetchSkyPageAndExtractData";
import { FlightData } from "./entities";
import airportsDataRaw from "./airports.json";
import { 
  parseDateString, 
  addDaysToDateString, 
  createTimezonedDatetime,
  formatDateForKiwi 
} from "./dateUtils";
import { logger, LogCategory } from "./logger";

// Use the .data property for lookups
const airportsData = airportsDataRaw.data;

/**
 * Maps cabin class to Kiwi portal format
 */
export function mapCabinClassForKiwi(cabinclass: 'Economy' | 'PremiumEconomy' | 'First' | 'Business' | undefined): string {
  switch (cabinclass) {
    case 'Economy': return 'M';
    case 'PremiumEconomy': return 'W';
    case 'First': return 'F';
    case 'Business': return 'C';
    default: return 'M';
  }
}

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
 * Builds URL search parameters specifically for Kiwi portal
 * @param requestParams - The request parameters containing flight search criteria
 * @returns URLSearchParams object ready to be used in URL construction
 */
export function buildKiwiPortalSearchParams(requestParams: RequestParams): URLSearchParams {
  return new URLSearchParams({
    currency: requestParams.currency,
    cabinclass: mapCabinClassForKiwi(requestParams.cabinclass),
    originplace: requestParams.originplace || "",
    destinationplace: requestParams.destinationplace || "",
    outbounddate: formatDateForKiwi(requestParams.outbounddate || ""),
    inbounddate: formatDateForKiwi(requestParams.inbounddate || ""),
    adults: requestParams.adults.toString(),
    children: requestParams.children.toString(),
    infants: requestParams.infants.toString(),
  });
}

/**
 * Builds a complete portal URL with search parameters
 * @param portal - The portal name (e.g., 'sky', 'kiwi')
 * @param requestParams - The request parameters containing flight search criteria
 * @returns Complete URL string for the portal
 */
export function buildPortalUrl(portal: string, requestParams: RequestParams): string {
  let searchParams: URLSearchParams;
  
  if (portal === 'kiwi') {
    searchParams = buildKiwiPortalSearchParams(requestParams);
  } else {
    searchParams = buildPortalSearchParams(requestParams);
  }
  
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
 * Merges flight data from source into target
 */
export function mergeFlightData(target: FlightData, source: FlightData): void {
  // Merge bundles
  source.bundles.forEach((bundle) => {
    if (!target.bundles.find((b) => b.uniqueId === bundle.uniqueId)) {
      // No existing bundle with this ID, add it
      target.bundles.push(bundle);
    }
  });

  // Merge flights
  source.flights.forEach((flight) => {
    if (!target.flights.find((f) => f.uniqueId === flight.uniqueId)) {
      target.flights.push(flight);
    }
  });

  // Merge booking options
  source.bookingOptions.forEach((bookingOption) => {
    const existingBookingOptionIndex = target.bookingOptions.findIndex((b) => b.uniqueId === bookingOption.uniqueId);
    if (existingBookingOptionIndex === -1) {
      // No existing booking option with this ID, add it
      target.bookingOptions.push(bookingOption);
    } else {
      // Booking option with same ID exists, compare extraction dates and keep the latest if difference > 1min
      const existingBookingOption = target.bookingOptions[existingBookingOptionIndex];
      const existingDate = new Date(existingBookingOption.extractedAt);
      const newDate = new Date(bookingOption.extractedAt);
      
      // Calculate time difference in minutes
      const timeDiffMinutes = Math.abs(newDate.getTime() - existingDate.getTime()) / (1000 * 60);
      
      if (newDate > existingDate && timeDiffMinutes > 1) {
        // Replace with the more recently extracted booking option only if difference > 1min
        target.bookingOptions[existingBookingOptionIndex] = bookingOption;
        logger.debug(LogCategory.DATA, `Replaced booking option with newer extraction`, {
          bookingOptionId: bookingOption.uniqueId,
          timeDiffMinutes: timeDiffMinutes.toFixed(1),
          oldDate: existingDate.toISOString(),
          newDate: newDate.toISOString()
        });
      }
    }
  });
}

// Re-export date functions for backward compatibility
export { parseDateString, addDaysToDateString, createTimezonedDatetime };