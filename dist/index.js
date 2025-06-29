"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const flightApiClient_1 = require("./flightApiClient");
const fastify_1 = __importDefault(require("fastify"));
const luxon_1 = require("luxon");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const helpers_1 = require("./helpers");
const fastify = (0, fastify_1.default)({
    logger: true,
});
// Entry Point
start();
// Health check endpoint
fastify.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});
// Flight data endpoint (GET and POST)
createEndpointPair('/getDeals', handleFlightScraping, 'deals scraping');
// Function to handle flight scraping logic
async function handleFlightScraping(request) {
    const startTime = Date.now();
    const { portals = { kiwi: true, sky: true }, currency = 'EUR', type = 'oneway', cabinclass = 'Economy', originplace, destinationplace, outbounddate, inbounddate, adults = 1, children = 0, infants = 0 } = request;
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
        const outboundDate = luxon_1.DateTime.fromISO(outbounddate);
        if (!outboundDate.isValid) {
            throw new Error(`Invalid outbounddate: ${outbounddate}`);
        }
        if (!validateNotPastDateISO(outbounddate)) {
            fastify.log.warn(`⚠️ Outbound date is in the past: ${outbounddate}, but continuing with scraping`);
            // Don't throw error, just log warning and continue
        }
    }
    if (inbounddate && outbounddate) {
        const outboundDate = luxon_1.DateTime.fromISO(outbounddate);
        const inboundDate = luxon_1.DateTime.fromISO(inbounddate);
        if (outboundDate.isValid && inboundDate.isValid && inboundDate <= outboundDate) {
            throw new Error(`Inbound date must be after outbound date: ${inbounddate} <= ${outbounddate}`);
        }
    }
    // Validate portals
    const portalsToScrape = {
        kiwi: portals.kiwi !== false, // default true
        sky: portals.sky !== false // default true
    };
    if (!portalsToScrape.kiwi && !portalsToScrape.sky) {
        throw new Error('At least one portal (kiwi or sky) must be true');
    }
    // Log request details
    fastify.log.info(`Starting flight scrape for portals: kiwi, sky`);
    fastify.log.info(`Parameters: originplace=${originplace}, destinationplace=${destinationplace}, outbounddate=${outbounddate}`);
    fastify.log.info(`Search details: ${adultsNum} adults, ${childrenNum} children, ${infantsNum} infants, ${cabinclass} class, ${currency} currency`);
    // Initialize combined flight data
    const combinedFlightData = {
        airlines: [],
        deals: [],
        flights: [],
    };
    const errors = [];
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
    const portalPromises = [];
    if (portalsToScrape.sky) {
        portalPromises.push((0, flightApiClient_1.fetchFlightData)('sky', requestParams)
            .then(flightData => {
            // Merge the flight data
            (0, helpers_1.mergeFlightData)(combinedFlightData, flightData);
            fastify.log.info(`✅ Sky portal: Retrieved ${flightData.deals.length} deals, ${flightData.airlines.length} airlines, ${flightData.flights.length} flights`);
        })
            .catch(error => {
            const errorMsg = `Sky portal error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMsg);
            fastify.log.error(`❌ ${errorMsg}`);
        }));
    }
    // Kiwi portal fetching is temporarily disabled
    // if (portalsToScrape.kiwi) {
    //   portalPromises.push(
    //     fetchFlightData('kiwi', requestParams)
    //       .then(flightData => {
    //         mergeFlightData(combinedFlightData, flightData);
    //         fastify.log.info(`✅ Kiwi portal: Retrieved ${flightData.deals.length} deals, ${flightData.airlines.length} airlines, ${flightData.flights.length} flights`);
    //       })
    //       .catch(error => {
    //         const errorMsg = `Kiwi portal error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    //         errors.push(errorMsg);
    //         fastify.log.error(`❌ ${errorMsg}`);
    //       })
    //   );
    // }
    // Wait for all portal scraping to complete
    await Promise.allSettled(portalPromises);
    // Create the final response with linked entities
    const linkedResponse = createLinkedEntitiesResponse(combinedFlightData);
    // Determine success status
    const success = combinedFlightData.deals.length > 0 && errors.length === 0;
    const partialSuccess = combinedFlightData.deals.length > 0 && errors.length > 0;
    // Log comprehensive results summary
    const duration = Date.now() - startTime;
    fastify.log.info(`📊 Scraping completed in ${duration}ms`);
    fastify.log.info(`📈 Final results: ${combinedFlightData.deals.length} deals, ${combinedFlightData.airlines.length} airlines, ${combinedFlightData.flights.length} flights`);
    if (success) {
        fastify.log.info(`✅ Scraping successful - all portals completed without errors`);
    }
    else if (partialSuccess) {
        fastify.log.warn(`⚠️ Partial success: ${combinedFlightData.deals.length} deals found, but ${errors.length} errors occurred`);
    }
    else {
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
        const logsDir = path_1.default.join(process.cwd(), 'logs');
        if (!fs_1.default.existsSync(logsDir)) {
            fs_1.default.mkdirSync(logsDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `response_${timestamp}.json`;
        const filepath = path_1.default.join(logsDir, filename);
        fs_1.default.writeFileSync(filepath, JSON.stringify(finalResponse, null, 2));
        fastify.log.info(`💾 Response logged to: ${filepath}`);
    }
    catch (logError) {
        fastify.log.error(`❌ Failed to log response to file: ${logError}`);
    }
    return finalResponse;
}
// Helper for date validation (YYYY-MM-DD)
function isValidDate(date) {
    if (!date)
        return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(date);
}
// Helper for validating that a date is not in the past
function validateNotPastDateISO(dateStr) {
    // Expects format 'YYYY-MM-DD'
    const date = luxon_1.DateTime.fromISO(dateStr);
    if (!date.isValid)
        return false;
    const today = luxon_1.DateTime.now().startOf('day');
    return date >= today;
}
// Helper for cabinclass validation
const validCabinClasses = ['Economy', 'PremiumEconomy', 'First', 'Business'];
// Helper for type validation
const validTypes = ['oneway', 'roundtrip'];
function createLinkedEntitiesResponse(flightData) {
    // Create maps for quick lookup
    const airlineMap = new Map(flightData.airlines.map(airline => [airline.id, airline]));
    const flightMap = new Map(flightData.flights.map(flight => [flight.id, flight]));
    // Create linked deals with embedded flights
    const linkedDeals = flightData.deals.map(deal => {
        const linkedFlights = deal.flightIds
            .map(flightId => flightMap.get(flightId))
            .filter(flight => flight !== undefined);
        return {
            ...deal,
            flights: linkedFlights
        };
    });
    return {
        airlines: flightData.airlines,
        deals: linkedDeals,
        flights: flightData.flights,
        summary: {
            totalAirlines: flightData.airlines.length,
            totalDeals: flightData.deals.length,
            totalFlights: flightData.flights.length
        }
    };
}
// Generic helper to create both GET and POST versions of an endpoint
function createEndpointPair(path, handler, errorContext) {
    // POST endpoint
    fastify.post(path, async (request, reply) => {
        try {
            const result = await handler(request.body);
            if (result.success) {
                return reply.send(result);
            }
            else {
                return reply.status(500).send(result);
            }
        }
        catch (error) {
            fastify.log.error(`Error in ${errorContext} endpoint:`, error);
            return reply.status(400).send({
                success: false,
                error: error instanceof Error ? error.message : 'Internal server error',
            });
        }
    });
    // GET endpoint
    fastify.get(path, async (request, reply) => {
        try {
            const result = await handler(request.query);
            if (result.success) {
                return reply.send(result);
            }
            else {
                return reply.status(500).send(result);
            }
        }
        catch (error) {
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
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}
//# sourceMappingURL=index.js.map