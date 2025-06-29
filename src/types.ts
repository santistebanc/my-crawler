export interface ScrapingRequest {
  portals?: {
    kiwi?: boolean;
    sky?: boolean;
  };
  currency?: string;
  type?: 'oneway' | 'roundtrip';
  cabinclass?: 'Economy' | 'PremiumEconomy' | 'First' | 'Business'; // Sky portal format only
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
  id?: string; // Unique identifier for deduplication
  flightName?: string; // Airline combination name
  headings?: string[]; // Outbound date, Book Your Ticket, etc.
  bookingOptions?: BookingOption[]; // Agency, price, and booking link
  segments?: FlightSegment[];
  tripSummary?: TripSummary; // Overall trip summary
  totalDuration?: string;
  departureDate?: string;
  arrivalDate?: string;
  bookingUrl?: string;
  portal?: Portal;
  expectedResults?: number;
}

// Import the FlightData interface from entities
import { FlightData, Flight as FlightEntity, Deal } from './entities';

// Enhanced interfaces for linked entities
export interface LinkedFlight extends FlightEntity {
  // No additional fields - just use the base Flight properties
}

// No longer embed flights in deals
export type LinkedDeal = Deal;

export interface LinkedFlightData {
  // Base entities (without links)
  deals: LinkedDeal[]; // Now just Deal[]
  flights: LinkedFlight[];
  summary: {
    totalDeals: number;
    totalFlights: number;
  };
}

export interface ScrapingResponse {
  success: boolean;
  data?: {
    flights?: DetailedFlightResult[]; // Old format
    flightData?: FlightData | LinkedFlightData; // New format
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