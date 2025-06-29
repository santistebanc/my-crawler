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
export interface FlightSegment {
    airline: string;
    flightNumber: string;
    duration: string;
    departureTime: string;
    arrivalTime: string;
    departureAirport: string;
    arrivalAirport: string;
    connectionTime?: string;
}
export interface FlightResult {
    airline?: string;
    departureTime?: string;
    arrivalTime?: string;
    duration?: string;
    stops?: number;
    price?: string;
    currency?: string;
}
export interface BookingOption {
    agency: string;
    price: string;
    link: string;
}
export interface TripSummary {
    departure: string;
    arrival: string;
    stops: string;
}
export interface DetailedFlightResult extends FlightResult {
    id?: string;
    flightName?: string;
    headings?: string[];
    bookingOptions?: BookingOption[];
    segments?: FlightSegment[];
    tripSummary?: TripSummary;
    totalDuration?: string;
    departureDate?: string;
    arrivalDate?: string;
    bookingUrl?: string;
    portal?: Portal;
    expectedResults?: number;
}
import { FlightData, Flight as FlightEntity, Deal } from './entities';
export interface LinkedFlight extends FlightEntity {
}
export type LinkedDeal = Deal;
export interface LinkedFlightData {
    deals: LinkedDeal[];
    flights: LinkedFlight[];
    summary: {
        totalDeals: number;
        totalFlights: number;
    };
}
export interface ScrapingResponse {
    success: boolean;
    data?: {
        flights?: DetailedFlightResult[];
        flightData?: FlightData | LinkedFlightData;
        searchParams: ScrapingRequest;
        scrapedAt: string;
    };
    error?: string;
}
export interface ScrapingError {
    message: string;
    code?: string;
    details?: any;
}
export type Portal = 'kiwi' | 'sky';
//# sourceMappingURL=types.d.ts.map