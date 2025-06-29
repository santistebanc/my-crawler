import { DetailedFlightResult, Portal } from '../types';

/**
 * Generate a unique ID for a flight result based on its key characteristics
 */
export function generateFlightId(flight: DetailedFlightResult, portal: Portal): string {
  const key = [
    portal,
    flight.airline || '',
    flight.flightName || '',
    flight.departureTime || '',
    flight.arrivalTime || '',
    // Use first segment's departure/arrival airports if available
    flight.segments?.[0]?.departureAirport || '',
    flight.segments?.[0]?.arrivalAirport || '',
    // Include first booking option price for uniqueness
    flight.bookingOptions?.[0]?.price || '',
    // Include first segment flight number
    flight.segments?.[0]?.flightNumber || '',
    // Include trip summary for additional uniqueness
    flight.tripSummary?.departureTime || '',
    flight.tripSummary?.arrivalTime || ''
  ].join('|');
  
  // Create a hash-like string from the key
  return btoa(key).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
}

/**
 * Assign IDs to flight results
 */
export function assignIdsToFlights(flights: DetailedFlightResult[], portal: Portal): DetailedFlightResult[] {
  return flights.map(flight => ({
    ...flight,
    id: generateFlightId(flight, portal)
  }));
}

/**
 * Filter out flights that already exist in the global results
 */
export function filterNewFlights(
  newFlights: DetailedFlightResult[], 
  existingFlights: DetailedFlightResult[]
): DetailedFlightResult[] {
  const existingIds = new Set(existingFlights.map(f => f.id).filter(Boolean));
  
  return newFlights.filter(flight => {
    if (!flight.id) return true; // Include flights without IDs (shouldn't happen after assignment)
    return !existingIds.has(flight.id);
  });
}

/**
 * Merge new flights with existing flights, avoiding duplicates
 */
export function mergeFlights(
  existingFlights: DetailedFlightResult[], 
  newFlights: DetailedFlightResult[]
): DetailedFlightResult[] {
  const existingIds = new Set(existingFlights.map(f => f.id).filter(Boolean));
  const uniqueNewFlights = newFlights.filter(flight => {
    if (!flight.id) return true;
    return !existingIds.has(flight.id);
  });
  
  return [...existingFlights, ...uniqueNewFlights];
} 