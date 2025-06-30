"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const helpers_1 = require("./helpers");
const flightApiClient_1 = require("./flightApiClient");
const flightApiClient_2 = require("./flightApiClient");
const logger_1 = require("./logger");
const dateUtils_1 = require("./dateUtils");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const fastify = (0, fastify_1.default)({
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
logger_1.logger.setLogLevel(logger_1.LogLevel.INFO);
// Entry Point
start();
// Health check endpoint
fastify.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});
// Flight data endpoint (GET and POST)
createEndpointPair('/getBundles', handleFlightScraping, 'bundles scraping');
// Function to handle flight scraping logic
async function handleFlightScraping(request) {
    const startTime = Date.now();
    const requestId = generateRequestId();
    logger_1.logger.setRequestId(requestId);
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
        if (!(0, dateUtils_1.validateNotPastDateISO)(outbounddate)) {
            logger_1.logger.warn(logger_1.LogCategory.REQUEST, `Outbound date is in the past`, { outbounddate });
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
        sky: portals.sky !== false // default true
    };
    if (!portalsToScrape.kiwi && !portalsToScrape.sky) {
        throw new Error('At least one portal (kiwi or sky) must be true');
    }
    // Log request start
    logger_1.logger.startRequest('Flight Scraping', {
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
        portals: Object.keys(portalsToScrape).filter(p => portalsToScrape[p])
    });
    // Initialize combined flight data
    const flightData = {
        bundles: [],
        flights: [],
        bookingOptions: [],
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
        portalPromises.push((0, flightApiClient_1.fetchSkyFlightData)(requestParams)
            .then(fetchedFlightData => {
            const beforeStats = {
                bundles: flightData.bundles.length,
                flights: flightData.flights.length,
                bookingOptions: flightData.bookingOptions.length
            };
            (0, helpers_1.mergeFlightData)(flightData, fetchedFlightData);
            logger_1.logger.portalSuccess('sky', {
                bundles: fetchedFlightData.bundles.length,
                flights: fetchedFlightData.flights.length,
                bookingOptions: fetchedFlightData.bookingOptions.length
            });
            logger_1.logger.dataMerge('Sky portal data', beforeStats, {
                bundles: flightData.bundles.length,
                flights: flightData.flights.length,
                bookingOptions: flightData.bookingOptions.length
            });
        })
            .catch(error => {
            const errorMsg = `Sky portal error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMsg);
            logger_1.logger.portalError('sky', error);
        }));
    }
    if (portalsToScrape.kiwi) {
        portalPromises.push((0, flightApiClient_2.fetchKiwiFlightData)(requestParams)
            .then(fetchedFlightData => {
            const beforeStats = {
                bundles: flightData.bundles.length,
                flights: flightData.flights.length,
                bookingOptions: flightData.bookingOptions.length
            };
            (0, helpers_1.mergeFlightData)(flightData, fetchedFlightData);
            logger_1.logger.portalSuccess('kiwi', {
                bundles: fetchedFlightData.bundles.length,
                flights: fetchedFlightData.flights.length,
                bookingOptions: fetchedFlightData.bookingOptions.length
            });
            logger_1.logger.dataMerge('Kiwi portal data', beforeStats, {
                bundles: flightData.bundles.length,
                flights: flightData.flights.length,
                bookingOptions: flightData.bookingOptions.length
            });
        })
            .catch(error => {
            const errorMsg = `Kiwi portal error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMsg);
            logger_1.logger.portalError('kiwi', error);
        }));
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
    logger_1.logger.endRequest('Flight Scraping', finalResponse, duration);
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
        logger_1.logger.debug(logger_1.LogCategory.SYSTEM, `Response logged to file`, { filepath });
    }
    catch (logError) {
        logger_1.logger.error(logger_1.LogCategory.SYSTEM, `Failed to log response to file`, { error: logError });
    }
    return finalResponse;
}
// Helper for date validation (YYYY-MM-DD)
function isValidDate(date) {
    if (!date)
        return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(date);
}
// Helper for cabinclass validation
const validCabinClasses = ['Economy', 'PremiumEconomy', 'First', 'Business'];
// Helper for type validation
const validTypes = ['oneway', 'roundtrip'];
function createLinkedEntitiesResponse(flightData) {
    return {
        bundles: flightData.bundles,
        flights: flightData.flights,
        bookingOptions: flightData.bookingOptions,
        summary: {
            totalBundles: flightData.bundles.length,
            totalFlights: flightData.flights.length,
            totalBookingOptions: flightData.bookingOptions.length
        }
    };
}
function generateRequestId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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
            logger_1.logger.error(logger_1.LogCategory.ERROR, `Error in ${errorContext} endpoint`, { error });
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
            logger_1.logger.error(logger_1.LogCategory.ERROR, `Error in ${errorContext} endpoint`, { error });
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
        logger_1.logger.info(logger_1.LogCategory.SYSTEM, 'Server started successfully', { port: 3001, host: '0.0.0.0' });
    }
    catch (err) {
        logger_1.logger.error(logger_1.LogCategory.SYSTEM, 'Failed to start server', { error: err });
        process.exit(1);
    }
}
//# sourceMappingURL=index.js.map