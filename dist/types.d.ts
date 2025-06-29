export interface ScrapingRequest {
    portals?: {
        kiwi?: boolean;
        sky?: boolean;
    };
    currency?: string;
    type?: 'oneway' | 'roundtrip';
    cabinclass?: 'Economy' | 'PremiumEconomy' | 'First' | 'Business';
    originplace?: string;
    destinationplace?: string;
    outbounddate?: string;
    inbounddate?: string;
    adults?: number;
    children?: number;
    infants?: number;
}
export interface BookingOption {
    agency: string;
    price: string;
    link: string;
}
import { FlightData, Flight as FlightEntity, Bundle } from './entities';
export interface LinkedFlight extends FlightEntity {
}
export type LinkedBundle = Bundle;
export interface LinkedFlightData {
    bundles: LinkedBundle[];
    flights: LinkedFlight[];
    bookingOptions: BookingOption[];
    summary: {
        totalBundles: number;
        totalFlights: number;
        totalBookingOptions: number;
    };
}
export interface ScrapingResponse {
    success: boolean;
    data?: {
        flightData?: FlightData | LinkedFlightData;
        searchParams: ScrapingRequest;
        scrapedAt: string;
    };
    error?: string;
}
export type Portal = 'kiwi' | 'sky';
//# sourceMappingURL=types.d.ts.map