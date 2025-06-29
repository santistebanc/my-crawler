import { Portal } from "./types";
import { FlightData } from "./entities";
export type BookingOption = {
    agency: string;
    price: string;
    link: string;
};
/**
 * Extracts flight data from HTML response
 */
export declare function extractFlightDataFromResponse(htmlData: string, portal: Portal): FlightData;
//# sourceMappingURL=extractFlightDataFromResponse.d.ts.map