import { SeparatedFlightData, generateId, extractAirportCode, extractAirportName, extractAirlineCode } from '../entities';

interface OldFlightData {
  portal: string;
  flightName: string;
  segments: Array<{
    airline: string;
    flightNumber: string;
    departureTime: string;
    arrivalTime: string;
    departureAirport: string;
    arrivalAirport: string;
    duration: string;
  }>;
  bookingOptions: Array<{
    agency: string;
    price: string;
    link: string;
  }>;
  tripSummary: {
    departureTime: string;
    arrivalTime: string;
    duration: string;
    stops: string;
  };
  price: string;
  currency: string;
  extractedAt: string;
}

interface OldFlightResponse {
  success: boolean;
  data: {
    flights: OldFlightData[];
  };
}

export function convertToSeparatedEntities(oldData: OldFlightResponse): SeparatedFlightData {
  const separatedData: SeparatedFlightData = {
    airlines: [],
    airports: [],
    deals: [],
    flights: []
  };

  const airlineMap = new Map<string, string>(); // name -> id
  const airportMap = new Map<string, string>(); // code -> id

  oldData.data.flights.forEach((oldFlight, flightIndex) => {
    const extractedAt = oldFlight.extractedAt;
    const flightIds: string[] = [];

    // Process segments (now flights)
    oldFlight.segments.forEach((segment, segmentIndex) => {
      // Handle airline
      const airlineName = segment.airline;
      let airlineId = airlineMap.get(airlineName);
      if (!airlineId) {
        airlineId = generateId('airline', airlineName);
        airlineMap.set(airlineName, airlineId);
        
        const airlineCode = extractAirlineCode(segment.flightNumber);
        separatedData.airlines.push({
          id: airlineId,
          name: airlineName,
          code: airlineCode,
          extractedAt
        });
      }

      // Handle departure airport
      const depAirportCode = extractAirportCode(segment.departureAirport);
      let depAirportId = airportMap.get(depAirportCode);
      if (!depAirportId) {
        depAirportId = generateId('airport', depAirportCode);
        airportMap.set(depAirportCode, depAirportId);
        
        const depAirportName = extractAirportName(segment.departureAirport);
        separatedData.airports.push({
          id: depAirportId,
          code: depAirportCode,
          name: depAirportName,
          extractedAt
        });
      }

      // Handle arrival airport
      const arrAirportCode = extractAirportCode(segment.arrivalAirport);
      let arrAirportId = airportMap.get(arrAirportCode);
      if (!arrAirportId) {
        arrAirportId = generateId('airport', arrAirportCode);
        airportMap.set(arrAirportCode, arrAirportId);
        
        const arrAirportName = extractAirportName(segment.arrivalAirport);
        separatedData.airports.push({
          id: arrAirportId,
          code: arrAirportCode,
          name: arrAirportName,
          extractedAt
        });
      }

      // Create flight (previously segment)
      const flightId = generateId('flight', `${airlineId}_${segment.flightNumber}_${depAirportCode}_${arrAirportCode}`);
      separatedData.flights.push({
        id: flightId,
        airlineId,
        flightNumber: segment.flightNumber,
        departureTime: segment.departureTime,
        arrivalTime: segment.arrivalTime,
        departureAirportId: depAirportId,
        arrivalAirportId: arrAirportId,
        duration: segment.duration,
        extractedAt
      });

      flightIds.push(flightId);
    });

    // Create deal (previously flight) with booking options directly embedded
    const dealId = generateId('deal', `${oldFlight.portal}_${oldFlight.flightName}_${oldFlight.price}_${flightIds.join('_')}`);
    
    separatedData.deals.push({
      id: dealId,
      portal: oldFlight.portal,
      dealName: oldFlight.flightName,
      flightIds,
      bookingOptions: oldFlight.bookingOptions,
      tripSummary: oldFlight.tripSummary,
      price: oldFlight.price,
      currency: oldFlight.currency,
      extractedAt
    });
  });

  return separatedData;
}

// Utility function to load and convert existing results.json
export function convertExistingResults(): SeparatedFlightData {
  const fs = require('fs');
  const oldData = JSON.parse(fs.readFileSync('results.json', 'utf8'));
  return convertToSeparatedEntities(oldData);
} 