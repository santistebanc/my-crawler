import { RequestParams } from "./fetchSkyPageAndExtractData";
import { FlightData } from "./entities";
/**
 * Maps cabin class to Kiwi portal format
 */
export declare function mapCabinClassForKiwi(cabinclass: 'Economy' | 'PremiumEconomy' | 'First' | 'Business' | undefined): string;
/**
 * Builds URL search parameters from request parameters for flightsfinder.com portal URLs
 * @param requestParams - The request parameters containing flight search criteria
 * @returns URLSearchParams object ready to be used in URL construction
 */
export declare function buildPortalSearchParams(requestParams: RequestParams): URLSearchParams;
/**
 * Builds URL search parameters specifically for Kiwi portal
 * @param requestParams - The request parameters containing flight search criteria
 * @returns URLSearchParams object ready to be used in URL construction
 */
export declare function buildKiwiPortalSearchParams(requestParams: RequestParams): URLSearchParams;
/**
 * Builds a complete portal URL with search parameters
 * @param portal - The portal name (e.g., 'sky', 'kiwi')
 * @param requestParams - The request parameters containing flight search criteria
 * @returns Complete URL string for the portal
 */
export declare function buildPortalUrl(portal: string, requestParams: RequestParams): string;
/**
 * Extracts the flightsfinder_session cookie from a set-cookie header string.
 * @param setCookieHeader - The set-cookie header string from a response
 * @returns The session cookie string, or an empty string if not found
 */
export declare function extractSessionCookie(setCookieHeader: string | null): string;
/**
 * Parses a date string in the format "EEE, dd MMM yyyy"
 */
export declare function parseDateString(dateStr: string): Date | null;
/**
 * Adds days to a date string and returns the new date string
 */
export declare function addDaysToDateString(dateStr: string, days: number): string;
/**
 * Creates a timezoned datetime string
 */
export declare function createTimezonedDatetime(dateStr: string, timeStr: string, timezone: string): string;
/**
 * Merges flight data from source into target
 */
export declare function mergeFlightData(target: FlightData, source: FlightData): void;
//# sourceMappingURL=helpers.d.ts.map