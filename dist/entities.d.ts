export interface Flight {
    id: string;
    flightNumber: string;
    departure: string;
    arrival: string;
    departureAirportCode: string;
    arrivalAirportCode: string;
    extractedAt: string;
}
export interface Deal {
    id: string;
    portal: string;
    flightIds: string[];
    agency: string;
    price: string;
    link: string;
    currency: string;
    extractedAt: string;
}
export interface FlightData {
    deals: Deal[];
    flights: Flight[];
}
export declare function generateId(prefix: string, data: string): string;
export declare function extractAirportCode(airportString: string): string;
export declare function extractAirportName(airportString: string): string;
//# sourceMappingURL=entities.d.ts.map