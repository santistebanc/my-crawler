// This file contains the legacy /flights and /flights-fast endpoints and their logic.
// ... Paste all removed endpoint and handler logic from index.ts here ...
// ... Ensure all necessary imports and types are included ... 

import Fastify from 'fastify';
import { scrapeFlights } from './crawler';
import { fetchFlightData } from './flightApiClient';
import { ScrapingRequest, ScrapingResponse } from '../types';

// Legacy endpoints and handlers for /flights and /flights-fast

// Fast flight data endpoint using flightApiClient (backward compatibility)
export function registerLegacyEndpoints(fastify: any) {
  fastify.post('/flights-fast', async (request: any, reply: any) => {
    try {
      const result = await handleFastFlightScraping(request.body);
      if (result.success) {
        return reply.send(result);
      } else {
        return reply.status(500).send(result);
      }
    } catch (error) {
      fastify.log.error('Error in fast scraping endpoint:', error);
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });

  fastify.get('/flights-fast', async (request: any, reply: any) => {
    try {
      const result = await handleFastFlightScraping(request.query);
      if (result.success) {
        return reply.send(result);
      } else {
        return reply.status(500).send(result);
      }
    } catch (error) {
      fastify.log.error('Error in fast scraping endpoint:', error);
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });

  fastify.post('/flights', async (request: any, reply: any) => {
    try {
      const result = await handleFlightScraping(request.body);
      if (result.success) {
        return reply.send(result);
      } else {
        return reply.status(500).send(result);
      }
    } catch (error) {
      fastify.log.error('Error in scraping endpoint:', error);
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });

  fastify.get('/flights', async (request: any, reply: any) => {
    try {
      const result = await handleFlightScraping(request.query);
      if (result.success) {
        return reply.send(result);
      } else {
        return reply.status(500).send(result);
      }
    } catch (error) {
      fastify.log.error('Error in scraping endpoint:', error);
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });
}

// Handler for /flights-fast
async function handleFastFlightScraping(request: ScrapingRequest): Promise<ScrapingResponse> {
  const {
    portals = { kiwi: true, sky: true },
    currency = 'EUR',
    type = 'oneway',
    cabinclass = 'Economy',
    originplace,
    destinationplace,
    outbounddate,
    inbounddate,
    adults = 1,
    children = 0,
    infants = 0
  } = request;

  // Validation
  if (!originplace || !destinationplace || !outbounddate) {
    throw new Error('originplace, destinationplace, and outbounddate are required');
  }
  if (!isValidDate(outbounddate)) {
    throw new Error('outbounddate must be in YYYY-MM-DD format');
  }
  if (inbounddate && !isValidDate(inbounddate)) {
    throw new Error('inbounddate must be in YYYY-MM-DD format');
  }
  if (!validCabinClasses.includes(cabinclass)) {
    throw new Error(`cabinclass must be one of: ${validCabinClasses.join(', ')}`);
  }
  if (!Number.isInteger(adults) || adults < 1) {
    throw new Error('adults must be an integer >= 1');
  }
  if (!Number.isInteger(children) || children < 0) {
    throw new Error('children must be an integer >= 0');
  }
  if (!Number.isInteger(infants) || infants < 0) {
    throw new Error('infants must be an integer >= 0');
  }
  if (type && !validTypes.includes(type)) {
    throw new Error(`type must be one of: ${validTypes.join(', ')}`);
  }
  if (currency && typeof currency !== 'string') {
    throw new Error('currency must be a string');
  }
  
  // Validate portals
  const portalsToScrape = {
    kiwi: portals.kiwi !== false, // default true
    sky: portals.sky !== false    // default true
  };
  if (!portalsToScrape.kiwi && !portalsToScrape.sky) {
    throw new Error('At least one portal (kiwi or sky) must be true');
  }

  // Logging omitted for brevity

  const allFlights: any[] = [];
  const errors: string[] = [];

  const requestParams = {
    adults,
    children,
    infants,
    currency,
    originplace,
    destinationplace,
    outbounddate,
    inbounddate,
    cabinclass
  };

  // Scrape each portal
  const portalPromises: Promise<void>[] = [];

  if (portalsToScrape.sky) {
    portalPromises.push(
      fetchFlightData('sky', requestParams)
        .then(flights => {
          allFlights.push(...flights);
        })
        .catch(error => {
          errors.push(`Sky portal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        })
    );
  }

  // Kiwi portal fetching is temporarily disabled
  // if (portalsToScrape.kiwi) {
  //   portalPromises.push(
  //     fetchFlightData('kiwi', requestParams)
  //       .then(flights => {
  //         allFlights.push(...flights);
  //       })
  //       .catch(error => {
  //         errors.push(`Kiwi portal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  //       })
  //   );
  // }

  await Promise.all(portalPromises);

  if (allFlights.length === 0 && errors.length > 0) {
    return {
      success: false,
      error: `All portals failed: ${errors.join('; ')}`,
      data: {
        flights: [],
        searchParams: request,
        scrapedAt: new Date().toISOString()
      }
    };
  }

  return {
    success: true,
    data: {
      flights: allFlights,
      searchParams: request,
      scrapedAt: new Date().toISOString()
    }
  };
}

// Handler for /flights
async function handleFlightScraping(request: ScrapingRequest): Promise<ScrapingResponse> {
  const {
    portals = { kiwi: true, sky: true },
    currency = 'EUR',
    type = 'oneway',
    cabinclass = 'Economy',
    originplace,
    destinationplace,
    outbounddate,
    inbounddate,
    adults = 1,
    children = 0,
    infants = 0
  } = request;

  // Validation
  if (!originplace || !destinationplace || !outbounddate) {
    throw new Error('originplace, destinationplace, and outbounddate are required');
  }
  if (!isValidDate(outbounddate)) {
    throw new Error('outbounddate must be in YYYY-MM-DD format');
  }
  if (inbounddate && !isValidDate(inbounddate)) {
    throw new Error('inbounddate must be in YYYY-MM-DD format');
  }
  if (!validCabinClasses.includes(cabinclass)) {
    throw new Error(`cabinclass must be one of: ${validCabinClasses.join(', ')}`);
  }
  if (!Number.isInteger(adults) || adults < 1) {
    throw new Error('adults must be an integer >= 1');
  }
  if (!Number.isInteger(children) || children < 0) {
    throw new Error('children must be an integer >= 0');
  }
  if (!Number.isInteger(infants) || infants < 0) {
    throw new Error('infants must be an integer >= 0');
  }
  if (type && !validTypes.includes(type)) {
    throw new Error(`type must be one of: ${validTypes.join(', ')}`);
  }
  if (currency && typeof currency !== 'string') {
    throw new Error('currency must be a string');
  }
  
  // Validate portals
  const portalsToScrape = {
    kiwi: portals.kiwi !== false, // default true
    sky: portals.sky !== false    // default true
  };
  if (!portalsToScrape.kiwi && !portalsToScrape.sky) {
    throw new Error('At least one portal (kiwi or sky) must be true');
  }

  // Logging omitted for brevity

  return await scrapeFlights({
    portals: portalsToScrape,
    currency,
    type,
    cabinclass,
    originplace,
    destinationplace,
    outbounddate,
    inbounddate,
    adults,
    children,
    infants
  });
}

// Helpers
function isValidDate(date: string | undefined) {
  if (!date) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

const validCabinClasses = ['Economy', 'PremiumEconomy', 'First', 'Business'];
const validTypes = ['oneway', 'roundtrip']; 