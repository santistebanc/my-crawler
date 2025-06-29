export interface Flight {
    uniqueId: string;
    flightNumber: string;
    departure: string;
    arrival: string;
    from: string;
    to: string;
}
export interface Bundle {
    uniqueId: string;
    flightIds: string[];
}
export interface BookingOption {
    uniqueId: string;
    targetId: string;
    agency: string;
    price: string;
    link: string;
    currency: string;
    extractedAt: string;
}
export interface FlightData {
    bundles: Bundle[];
    flights: Flight[];
    bookingOptions: BookingOption[];
}
export declare function generateId(prefix: string, data: string): string;
/**
 * Creates a unique bundle ID based on the sorted array of flight IDs
 */
export declare function createBundleIdFromFlightIds(flightIds: string[]): string;
/**
 * Creates a datetime string without timezone for ID generation
 */
export declare function createDatetimeForId(dateStr: string, timeStr: string): string;
export declare function extractAirportCode(airportString: string): string;
/**
 * Creates a unique booking option ID based on the link, agency, and targetId
 */
export declare function createBookingOptionId(link: string, agency: string, targetId: string): string;
//# sourceMappingURL=entities.d.ts.map