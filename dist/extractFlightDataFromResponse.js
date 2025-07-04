"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractFlightDataFromResponse = extractFlightDataFromResponse;
const entities_1 = require("./entities");
const cheerio = __importStar(require("cheerio"));
const airports_json_1 = __importDefault(require("./airports.json"));
const helpers_1 = require("./helpers");
const dateUtils_1 = require("./dateUtils");
// Use the .data property for lookups
const airportsData = airports_json_1.default.data;
/**
 * Extracts flight data from HTML response
 */
function extractFlightDataFromResponse(htmlData, portal) {
    try {
        if (!htmlData || htmlData.length === 0) {
            console.warn(`⚠️ Empty HTML data received from ${portal} portal`);
            return { bundles: [], flights: [], bookingOptions: [] };
        }
        const $ = cheerio.load(htmlData);
        const flightData = {
            bundles: [],
            flights: [],
            bookingOptions: [],
        };
        const listItems = $(".list-item.row");
        console.info(`🔍 Found ${listItems.length} list items to process from ${portal} portal`);
        let successfulExtractions = 0;
        let failedExtractions = 0;
        listItems.each((i, el) => {
            try {
                const bundleData = extractBundleFromListItem($(el), portal, $);
                if (bundleData) {
                    (0, helpers_1.mergeFlightData)(flightData, bundleData);
                    successfulExtractions++;
                }
                else {
                    failedExtractions++;
                }
            }
            catch (err) {
                console.warn(`⚠️ Error extracting bundle from list item ${i + 1}:`, err);
                failedExtractions++;
            }
        });
        console.info(`✅ ${portal} portal extraction complete: ${successfulExtractions} successful, ${failedExtractions} failed`);
        console.info(`📊 Extracted: ${flightData.bundles.length} bundles, ${flightData.flights.length} flights`);
        return flightData;
    }
    catch (error) {
        console.error(`❌ Error extracting flight data from ${portal}:`, error);
        return { bundles: [], flights: [], bookingOptions: [] };
    }
}
/**
 * Extracts bundle data from a list item element
 */
function extractBundleFromListItem($item, portal, $) {
    try {
        const flightData = {
            bundles: [],
            flights: [],
            bookingOptions: [],
        };
        // Bundle name and airline from the main item
        const airline = $item.find(".airlines-name").first().text().trim();
        // Price from the main item
        const price = $item.find(".prices").first().text().trim();
        const currencyMatch = price.match(/[€$£¥₹]/);
        const currency = currencyMatch ? currencyMatch[0] : "EUR";
        // Modal extraction for flights and booking options
        const modal = $item.find(".modal").first();
        const flightIds = [];
        // Booking options
        const bookingOptions = [];
        // Extract departure date from ._heading element
        let departureDate = "";
        const headingElement = modal.find("._heading").first();
        if (headingElement.length) {
            const headingText = headingElement.text().trim();
            // Extract date from format like "Outbound Fri, 10 Oct 2025 All times are local"
            const dateMatch = headingText.match(/(?:Outbound|Inbound)\s+([A-Za-z]{3},\s+\d+\s+[A-Za-z]{3}\s+\d{4})/);
            if (dateMatch) {
                departureDate = dateMatch[1];
            }
        }
        if (modal.length) {
            // Flights (previously segments)
            let currentDateOffset = 0; // Track days offset from base departure date
            modal.find("._panel_body").each((i, seg) => {
                const flightNumberFull = $(seg).find("small").first().text().trim();
                const item = $(seg).find("._item").first();
                const times = item.find(".c3 p");
                const airports = item.find(".c4 p");
                const flightDepartureTime = times.eq(0).text().trim();
                const flightArrivalTime = times.eq(1).text().trim();
                const flightDepartureAirport = airports.eq(0).text().trim();
                const flightArrivalAirport = airports.eq(1).text().trim();
                // Check if arrival time has +1 indicator (next day)
                const hasNextDayArrival = flightArrivalTime.includes("+1");
                const cleanArrivalTime = flightArrivalTime.replace(/\+\d+/, "").trim();
                if (flightNumberFull) {
                    let flightNumber = null;
                    const parts = flightNumberFull.split(" ");
                    if (portal === "sky") {
                        flightNumber = parts[parts.length - 1];
                    }
                    else {
                        const airlineCode = parts[parts.length - 2];
                        const flightNum = parts[parts.length - 1];
                        flightNumber = airlineCode + flightNum;
                    }
                    // Extract airport codes
                    const depAirportCode = (0, entities_1.extractAirportCode)(flightDepartureAirport);
                    const arrAirportCode = (0, entities_1.extractAirportCode)(flightArrivalAirport);
                    // Get timezone information for airports
                    const depTimezone = airportsData[depAirportCode]?.timezone;
                    const arrTimezone = airportsData[arrAirportCode]?.timezone;
                    if (!depTimezone) {
                        throw new Error(`No timezone found for departure airport: ${depAirportCode}`);
                    }
                    if (!arrTimezone) {
                        throw new Error(`No timezone found for arrival airport: ${arrAirportCode}`);
                    }
                    // Calculate flight date (may be offset from base departure date)
                    let flightDate = departureDate;
                    if (currentDateOffset > 0 && departureDate) {
                        flightDate = (0, helpers_1.addDaysToDateString)(departureDate, currentDateOffset);
                    }
                    // Calculate arrival date for this flight (may be next day)
                    let flightArrivalDate = flightDate;
                    if (hasNextDayArrival && flightDate) {
                        flightArrivalDate = (0, helpers_1.addDaysToDateString)(flightDate, 1);
                        currentDateOffset++; // Increment for next flight
                    }
                    // Format flight times with timezone information
                    const formattedFlightDeparture = (0, helpers_1.createTimezonedDatetime)(flightDate, flightDepartureTime, depTimezone);
                    const formattedFlightArrival = (0, helpers_1.createTimezonedDatetime)(flightArrivalDate, cleanArrivalTime, arrTimezone);
                    // Create departure datetime for ID (without timezone)
                    const departureDatetimeForId = (0, dateUtils_1.createDatetimeForId)(flightDate, flightDepartureTime);
                    // Create flight object
                    const flightId = (0, entities_1.generateId)("flight", `${flightNumber}-${depAirportCode}-${arrAirportCode}-${departureDatetimeForId}`);
                    const flight = {
                        uniqueId: flightId,
                        flightNumber,
                        departure: formattedFlightDeparture,
                        arrival: formattedFlightArrival,
                        from: depAirportCode,
                        to: arrAirportCode,
                    };
                    flightData.flights.push(flight);
                    flightIds.push(flightId);
                }
            });
            // Extract booking options
            const bookingOptionsFound = modal.find("._similar > div");
            bookingOptionsFound.each((i, option) => {
                const agency = $(option).find("p").eq(0).text().trim();
                const optionPriceRaw = $(option)
                    .find("p")
                    .eq(1)
                    .clone()
                    .children("a")
                    .remove()
                    .end()
                    .text()
                    .trim();
                const optionPrice = optionPriceRaw
                    .replace(/[^\d.,]/g, "")
                    .replace(",", ".");
                const link = $(option).find("a").attr("href") || "";
                if (agency && optionPrice && link) {
                    bookingOptions.push({
                        agency,
                        price: optionPrice,
                        link,
                    });
                }
            });
        }
        // Create bundle object
        const bundleId = (0, entities_1.createBundleIdFromFlightIds)(flightIds);
        const bundle = {
            uniqueId: bundleId,
            flightIds,
        };
        flightData.bundles.push(bundle);
        // Create booking options for this bundle
        bookingOptions.forEach((option) => {
            const bookingOptionId = (0, entities_1.createBookingOptionId)(option.link, option.agency, bundleId);
            const bookingOption = {
                uniqueId: bookingOptionId,
                targetId: bundleId,
                agency: option.agency,
                price: option.price,
                link: option.link,
                currency,
                extractedAt: new Date().toISOString(),
            };
            flightData.bookingOptions.push(bookingOption);
        });
        return flightData;
    }
    catch (error) {
        console.warn(`⚠️ Error extracting bundle from list item:`, error);
        return null;
    }
}
//# sourceMappingURL=extractFlightDataFromResponse.js.map