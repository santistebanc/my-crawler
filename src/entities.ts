// Entity interfaces for flight data

import { parseDateString, createDatetimeForId } from "./dateUtils";

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

// Utility functions for entity management
export function generateId(prefix: string, data: string): string {
  const hash = data.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `${prefix}_${hash}`;
}

/**
 * Creates a unique bundle ID based on the sorted array of flight IDs
 */
export function createBundleIdFromFlightIds(flightIds: string[]): string {
  // Sort flight IDs to ensure consistent ordering
  const sortedFlightIds = [...flightIds].sort();
  // Create a hash-like string from the sorted flight IDs
  const flightIdsString = sortedFlightIds.join('-');
  // Generate a simple hash for the string
  let hash = 0;
  for (let i = 0; i < flightIdsString.length; i++) {
    const char = flightIdsString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to positive hex string and take first 8 characters
  const hashString = Math.abs(hash).toString(16).padStart(8, '0').substring(0, 8);
  return `bundle_${hashString}`;
}

export function extractAirportCode(airportString: string): string {
  // Extract airport code from strings like "SLP San Luis Potosi" or "MEX Mexico City"
  const match = airportString.match(/^([A-Z]{3})\s/);
  return match ? match[1] : airportString.split(' ')[0];
}

/**
 * Creates a unique booking option ID based on the link, agency, and targetId
 */
export function createBookingOptionId(link: string, agency: string, targetId: string): string {
  // Generate a simple hash for the link
  let hash = 0;
  for (let i = 0; i < link.length; i++) {
    const char = link.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to positive hex string and take first 8 characters
  const linkHash = Math.abs(hash).toString(16).padStart(8, '0').substring(0, 8);
  
  // Clean agency name for ID
  const cleanAgency = agency.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  
  // Extract target hash from targetId (remove 'bundle_' or 'flight_' prefix)
  const targetHash = targetId.replace(/^(bundle_|flight_)/, '');
  
  return `booking_${linkHash}_${cleanAgency}_${targetHash}`;
} 