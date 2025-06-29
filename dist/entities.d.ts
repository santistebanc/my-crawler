export interface Airline {
    id: string;
    name: string;
    code?: string;
    extractedAt: string;
}
export interface Flight {
    id: string;
    airlineId: string;
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
    dealName: string;
    flightIds: string[];
    agency: string;
    price: string;
    link: string;
    tripSummary: {
        departure: string;
        arrival: string;
        stops: string;
    };
    currency: string;
    extractedAt: string;
}
export interface FlightData {
    airlines: Airline[];
    deals: Deal[];
    flights: Flight[];
}
export declare function generateId(prefix: string, data: string): string;
export declare function extractAirportCode(airportString: string): string;
export declare function extractAirportName(airportString: string): string;
export declare function extractAirlineCode(airlineString: string): string;
//# sourceMappingURL=entities.d.ts.map