// Entity interfaces for flight data

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

// Utility functions for entity management
export function generateId(prefix: string, data: string): string {
  const hash = data.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `${prefix}_${hash}`;
}

export function extractAirportCode(airportString: string): string {
  // Extract airport code from strings like "SLP San Luis Potosi" or "MEX Mexico City"
  const match = airportString.match(/^([A-Z]{3})\s/);
  return match ? match[1] : airportString.split(' ')[0];
}

export function extractAirportName(airportString: string): string {
  // Extract airport name from strings like "SLP San Luis Potosi" or "MEX Mexico City"
  const parts = airportString.split(' ');
  if (parts.length >= 3 && /^[A-Z]{3}$/.test(parts[0])) {
    return parts.slice(1).join(' ');
  }
  return airportString;
}

export function extractAirlineCode(airlineString: string): string {
  // Extract airline code from strings like "Aeromexico AM1531"
  const match = airlineString.match(/^([A-Za-z]+)\s/);
  return match ? match[1] : airlineString;
} 