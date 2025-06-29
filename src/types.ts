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

export interface BookingOption {
  agency: string;
  price: string;
  link: string;
}

// Import the FlightData interface from entities
import { FlightData, Flight as FlightEntity, Bundle } from './entities';

// Enhanced interfaces for linked entities
export interface LinkedFlight extends FlightEntity {
  // No additional fields - just use the base Flight properties
}

// No longer embed flights in bundles
export type LinkedBundle = Bundle;

export interface LinkedFlightData {
  // Base entities (without links)
  bundles: LinkedBundle[]; // Now just Bundle[]
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
    flightData?: FlightData | LinkedFlightData; // New format
    searchParams: ScrapingRequest;
    scrapedAt: string;
  };
  error?: string;
}

export type Portal = 'kiwi' | 'sky'; 