import Fastify from 'fastify';
import { ScrapingRequest, ScrapingResponse, LinkedFlightData, LinkedFlight } from './types';
import { FlightData } from './entities';
import { mergeFlightData } from './helpers';
import { fetchSkyFlightData } from './flightApiClient';
import { fetchKiwiFlightData } from './flightApiClient';
import { logger, LogCategory, LogLevel } from './logger';
import { validateNotPastDateISO } from './dateUtils';
import fs from 'fs';
import path from 'path';

const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname'
      }
    }
  }
});

// Initialize logger with Fastify logger
logger.setLogLevel(LogLevel.INFO);

// Entry Point
start();

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Flight data endpoint (GET and POST)
createEndpointPair<ScrapingRequest>('/getBundles', handleFlightScraping, 'bundles scraping');

// Function to handle flight scraping logic
async function handleFlightScraping(request: ScrapingRequest): Promise<ScrapingResponse> {
  const startTime = Date.now();
  const requestId = generateRequestId();
  logger.setRequestId(requestId);
  
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
    if (!validateNotPastDateISO(outbounddate)) {
      logger.warn(LogCategory.REQUEST, `Outbound date is in the past`, { outbounddate });
    }
  }
  
  if (inbounddate && outbounddate) {
    const outboundDate = new Date(outbounddate);
    const inboundDate = new Date(inbounddate);
    if (!isNaN(outboundDate.getTime()) && !isNaN(inboundDate.getTime()) && inboundDate <= outboundDate) {
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

  // Log request start
  logger.startRequest('Flight Scraping', {
    originplace,
    destinationplace,
    outbounddate,
    inbounddate,
    adults: adultsNum,
    children: childrenNum,
    infants: infantsNum,
    cabinclass,
    currency,
    type,
    portals: Object.keys(portalsToScrape).filter(p => portalsToScrape[p as keyof typeof portalsToScrape])
  });

  // Initialize combined flight data
  const flightData: FlightData = {
    bundles: [],
    flights: [],
    bookingOptions: [],
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
      fetchSkyFlightData(requestParams)
        .then(fetchedFlightData => {
          const beforeStats = {
            bundles: flightData.bundles.length,
            flights: flightData.flights.length,
            bookingOptions: flightData.bookingOptions.length
          };
          
          mergeFlightData(flightData, fetchedFlightData);
          
          logger.portalSuccess('sky', {
            bundles: fetchedFlightData.bundles.length,
            flights: fetchedFlightData.flights.length,
            bookingOptions: fetchedFlightData.bookingOptions.length
          });
          
          logger.dataMerge('Sky portal data', beforeStats, {
            bundles: flightData.bundles.length,
            flights: flightData.flights.length,
            bookingOptions: flightData.bookingOptions.length
          });
        })
        .catch(error => {
          const errorMsg = `Sky portal error: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          logger.portalError('sky', error);
        })
    );
  }

  if (portalsToScrape.kiwi) {
    portalPromises.push(
      fetchKiwiFlightData(requestParams)
        .then(fetchedFlightData => {
          const beforeStats = {
            bundles: flightData.bundles.length,
            flights: flightData.flights.length,
            bookingOptions: flightData.bookingOptions.length
          };
          
          mergeFlightData(flightData, fetchedFlightData);
          
          logger.portalSuccess('kiwi', {
            bundles: fetchedFlightData.bundles.length,
            flights: fetchedFlightData.flights.length,
            bookingOptions: fetchedFlightData.bookingOptions.length
          });
          
          logger.dataMerge('Kiwi portal data', beforeStats, {
            bundles: flightData.bundles.length,
            flights: flightData.flights.length,
            bookingOptions: flightData.bookingOptions.length
          });
        })
        .catch(error => {
          const errorMsg = `Kiwi portal error: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          logger.portalError('kiwi', error);
        })
    );
  }

  // Wait for all portal scraping to complete
  await Promise.allSettled(portalPromises);

  // Create the final response with linked entities
  const linkedResponse = createLinkedEntitiesResponse(flightData);

  // Determine success status
  const success = flightData.bundles.length > 0 && errors.length === 0;
  const partialSuccess = flightData.bundles.length > 0 && errors.length > 0;

  const duration = Date.now() - startTime;
  const finalResponse = {
    success: success || partialSuccess,
    data: {
      flightData: linkedResponse,
      searchParams: request,
      scrapedAt: new Date().toISOString()
    },
    error: errors.length > 0 ? errors.join('; ') : undefined
  };

  // Log response completion
  logger.endRequest('Flight Scraping', finalResponse, duration);

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
    logger.debug(LogCategory.SYSTEM, `Response logged to file`, { filepath });
  } catch (logError) {
    logger.error(LogCategory.SYSTEM, `Failed to log response to file`, { error: logError });
  }

  return finalResponse;
}

// Helper for date validation (YYYY-MM-DD)
function isValidDate(date: string | undefined) {
  if (!date) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

// Helper for cabinclass validation
const validCabinClasses = ['Economy', 'PremiumEconomy', 'First', 'Business'];

// Helper for type validation
const validTypes = ['oneway', 'roundtrip'];

function createLinkedEntitiesResponse(flightData: FlightData): LinkedFlightData {
  return {
    bundles: flightData.bundles,
    flights: flightData.flights as LinkedFlight[],
    bookingOptions: flightData.bookingOptions,
    summary: {
      totalBundles: flightData.bundles.length,
      totalFlights: flightData.flights.length,
      totalBookingOptions: flightData.bookingOptions.length
    }
  };
}

function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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
      logger.error(LogCategory.ERROR, `Error in ${errorContext} endpoint`, { error });
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
      logger.error(LogCategory.ERROR, `Error in ${errorContext} endpoint`, { error });
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
    logger.info(LogCategory.SYSTEM, 'Server started successfully', { port: 3001, host: '0.0.0.0' });
  } catch (err) {
    logger.error(LogCategory.SYSTEM, 'Failed to start server', { error: err });
    process.exit(1);
  }
} 