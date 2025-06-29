import { fetchFlightData } from './flightApiClient';
import { ScrapingRequest, ScrapingResponse, LinkedFlightData, LinkedFlight } from './types';
import { FlightData } from './entities';
import Fastify from 'fastify';
import { DateTime } from 'luxon';
import fs from 'fs';
import path from 'path';
import { mergeFlightData } from "./helpers";

const fastify = Fastify({
  logger: true,
});

// Entry Point
start();

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Flight data endpoint (GET and POST)
createEndpointPair<ScrapingRequest>('/getDeals', handleFlightScraping, 'deals scraping');

// Function to handle flight scraping logic
async function handleFlightScraping(request: ScrapingRequest): Promise<ScrapingResponse> {
  const startTime = Date.now();
  
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

  // Convert string parameters to numbers for validation (GET requests send strings)
  const adultsNum = typeof adults === 'string' ? parseInt(adults, 10) : adults;
  const childrenNum = typeof children === 'string' ? parseInt(children, 10) : children;
  const infantsNum = typeof infants === 'string' ? parseInt(infants, 10) : infants;

  // Basic validation
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
  if (!Number.isInteger(adultsNum) || adultsNum < 1) {
    throw new Error('adults must be an integer >= 1');
  }
  if (!Number.isInteger(childrenNum) || childrenNum < 0) {
    throw new Error('children must be an integer >= 0');
  }
  if (!Number.isInteger(infantsNum) || infantsNum < 0) {
    throw new Error('infants must be an integer >= 0');
  }
  if (type && !validTypes.includes(type)) {
    throw new Error(`type must be one of: ${validTypes.join(', ')}`);
  }
  if (currency && typeof currency !== 'string') {
    throw new Error('currency must be a string');
  }
  
  // Date validation
  if (outbounddate) {
    const outboundDate = DateTime.fromISO(outbounddate);
    if (!outboundDate.isValid) {
      throw new Error(`Invalid outbounddate: ${outbounddate}`);
    }
    if (!validateNotPastDateISO(outbounddate)) {
      fastify.log.warn(`⚠️ Outbound date is in the past: ${outbounddate}, but continuing with scraping`);
      // Don't throw error, just log warning and continue
    }
  }
  
  if (inbounddate && outbounddate) {
    const outboundDate = DateTime.fromISO(outbounddate);
    const inboundDate = DateTime.fromISO(inbounddate);
    if (outboundDate.isValid && inboundDate.isValid && inboundDate <= outboundDate) {
      throw new Error(`Inbound date must be after outbound date: ${inbounddate} <= ${outbounddate}`);
    }
  }
  
  // Validate portals
  const portalsToScrape = {
    kiwi: portals.kiwi !== false, // default true
    sky: portals.sky !== false    // default true
  };
  if (!portalsToScrape.kiwi && !portalsToScrape.sky) {
    throw new Error('At least one portal (kiwi or sky) must be true');
  }

  // Log request details
  fastify.log.info(`Starting flight scrape for portals: kiwi, sky`);
  fastify.log.info(`Parameters: originplace=${originplace}, destinationplace=${destinationplace}, outbounddate=${outbounddate}`);
  fastify.log.info(`Search details: ${adultsNum} adults, ${childrenNum} children, ${infantsNum} infants, ${cabinclass} class, ${currency} currency`);

  // Initialize combined flight data
  const flightData: FlightData = {
    deals: [],
    flights: [],
  };

  const errors: string[] = [];

  const requestParams = {
    adults: adultsNum,
    children: childrenNum,
    infants: infantsNum,
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
        .then(fetchedFlightData => {
          // Merge the fetched flight data into the main flightData object
          mergeFlightData(flightData, fetchedFlightData);
          fastify.log.info(`✅ Sky portal: Retrieved ${fetchedFlightData.deals.length} deals, ${fetchedFlightData.flights.length} flights`);
        })
        .catch(error => {
          const errorMsg = `Sky portal error: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          fastify.log.error(`❌ ${errorMsg}`);
          // Log the full error for debugging
          fastify.log.error(`❌ Full Sky portal error:`, error);
        })
    );
  }

  // Kiwi portal fetching is temporarily disabled
  // if (portalsToScrape.kiwi) {
  //   portalPromises.push(
  //     fetchFlightData('kiwi', requestParams)
  //       .then(fetchedFlightData => {
  //         // Merge the fetched flight data into the main flightData object
  //         mergeFlightData(flightData, fetchedFlightData);
  //         fastify.log.info(`✅ Kiwi portal: Retrieved ${fetchedFlightData.deals.length} deals, ${fetchedFlightData.flights.length} flights`);
  //       })
  //       .catch(error => {
  //         const errorMsg = `Kiwi portal error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  //         errors.push(errorMsg);
  //         fastify.log.error(`❌ ${errorMsg}`);
  //         // Log the full error for debugging
  //         fastify.log.error(`❌ Full Kiwi portal error:`, error);
  //       })
  //   );
  // }

  // Wait for all portal scraping to complete
  await Promise.allSettled(portalPromises);

  // Create the final response with linked entities
  const linkedResponse = createLinkedEntitiesResponse(flightData);

  // Determine success status
  const success = flightData.deals.length > 0 && errors.length === 0;
  const partialSuccess = flightData.deals.length > 0 && errors.length > 0;

  // Log comprehensive results summary
  const duration = Date.now() - startTime;
  fastify.log.info(`📊 Scraping completed in ${duration}ms`);
  fastify.log.info(`📈 Final results: ${flightData.deals.length} deals, ${flightData.flights.length} flights`);
  
  if (success) {
    fastify.log.info(`✅ Scraping successful - all portals completed without errors`);
  } else if (partialSuccess) {
    fastify.log.warn(`⚠️ Partial success: ${flightData.deals.length} deals found, but ${errors.length} errors occurred`);
  } else {
    fastify.log.error(`❌ Scraping failed: No deals found and ${errors.length} errors occurred`);
  }

  const finalResponse = {
    success: success || partialSuccess,
    data: {
      flightData: linkedResponse,
      searchParams: request,
      scrapedAt: new Date().toISOString()
    },
    error: errors.length > 0 ? errors.join('; ') : undefined
  };

  // Log response to JSON file
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `response_${timestamp}.json`;
    const filepath = path.join(logsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(finalResponse, null, 2));
    fastify.log.info(`💾 Response logged to: ${filepath}`);
  } catch (logError) {
    fastify.log.error(`❌ Failed to log response to file: ${logError}`);
  }

  return finalResponse;
}

// Helper for date validation (YYYY-MM-DD)
function isValidDate(date: string | undefined) {
  if (!date) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

// Helper for validating that a date is not in the past
function validateNotPastDateISO(dateStr: string): boolean {
  // Expects format 'YYYY-MM-DD'
  const date = DateTime.fromISO(dateStr);
  if (!date.isValid) return false;
  const today = DateTime.now().startOf('day');
  return date >= today;
}

// Helper for cabinclass validation
const validCabinClasses = ['Economy', 'PremiumEconomy', 'First', 'Business'];

// Helper for type validation
const validTypes = ['oneway', 'roundtrip'];

function createLinkedEntitiesResponse(flightData: FlightData): LinkedFlightData {
  return {
    deals: flightData.deals,
    flights: flightData.flights as LinkedFlight[],
    summary: {
      totalDeals: flightData.deals.length,
      totalFlights: flightData.flights.length
    }
  };
}

// Generic helper to create both GET and POST versions of an endpoint
function createEndpointPair<T>(
  path: string,
  handler: (request: T) => Promise<ScrapingResponse>,
  errorContext: string
) {
  // POST endpoint
  fastify.post<{ Body: ScrapingRequest }>(path, async (request, reply) => {
    try {
      const result = await handler(request.body as T);
      
      if (result.success) {
        return reply.send(result);
      } else {
        return reply.status(500).send(result);
      }
    } catch (error) {
      fastify.log.error(`Error in ${errorContext} endpoint:`, error);
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });

  // GET endpoint
  fastify.get<{ Querystring: ScrapingRequest }>(path, async (request, reply) => {
    try {
      const result = await handler(request.query as T);
      
      if (result.success) {
        return reply.send(result);
      } else {
        return reply.status(500).send(result);
      }
    } catch (error) {
      fastify.log.error(`Error in ${errorContext} endpoint:`, error);
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      });
    }
  });
}

// Start the server
async function start() {
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    console.log('🚀 Server is running on http://localhost:3001');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
} 