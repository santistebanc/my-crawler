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
/**
 * Extracts flight data from HTML response
 */
function extractFlightDataFromResponse(htmlData, portal) {
    try {
        if (!htmlData || htmlData.length === 0) {
            console.warn(`⚠️ Empty HTML data received from ${portal} portal`);
            return { airlines: [], deals: [], flights: [] };
        }
        const $ = cheerio.load(htmlData);
        const flightData = {
            airlines: [],
            deals: [],
            flights: [],
        };
        const listItems = $(".list-item.row");
        console.info(`🔍 Found ${listItems.length} list items to process from ${portal} portal`);
        let successfulExtractions = 0;
        let failedExtractions = 0;
        listItems.each((i, el) => {
            try {
                const dealData = extractDealFromListItem($(el), portal, $);
                if (dealData) {
                    (0, helpers_1.mergeFlightData)(flightData, dealData);
                    successfulExtractions++;
                }
                else {
                    failedExtractions++;
                }
            }
            catch (err) {
                console.warn(`⚠️ Error extracting deal from list item ${i + 1}:`, err);
                failedExtractions++;
            }
        });
        console.info(`✅ ${portal} portal extraction complete: ${successfulExtractions} successful, ${failedExtractions} failed`);
        console.info(`📊 Extracted: ${flightData.deals.length} deals, ${flightData.airlines.length} airlines, ${flightData.flights.length} flights`);
        return flightData;
    }
    catch (error) {
        console.error(`❌ Error extracting flight data from ${portal}:`, error);
        return { airlines: [], deals: [], flights: [] };
    }
}
/**
 * Extracts deal data from a list item element
 */
function extractDealFromListItem($item, portal, $) {
    try {
        const extractedAt = new Date().toISOString();
        const flightData = {
            airlines: [],
            deals: [],
            flights: [],
        };
        // Deal name and airline from the main item
        const dealName = $item.find("._flight_name").first().text().trim();
        const airline = $item.find(".airlines-name").first().text().trim();
        // Price from the main item
        const price = $item.find(".prices").first().text().trim();
        const currencyMatch = price.match(/[€$£¥₹]/);
        const currency = currencyMatch ? currencyMatch[0] : "EUR";
        // Modal extraction for flights and booking options
        const modal = $item.find(".modal").first();
        const flightIds = [];
        // Booking options and cheapest selection
        const bookingOptions = [];
        let cheapest = undefined;
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
        // Trip summary data from modal header
        let tripDepartureTime = "";
        let tripArrivalTime = "";
        let tripDepartureAirport = "";
        let tripArrivalAirport = "";
        let stops = "";
        let hasNextDayArrival = false;
        const tripSection = modal.find(".trip").first();
        if (tripSection.length) {
            // Get departure time and airport from first time element
            const firstTime = tripSection.find(".time").eq(0);
            if (firstTime.length) {
                tripDepartureTime = firstTime.contents().first().text().trim();
                tripDepartureAirport = firstTime.find("span").text().trim();
            }
            // Get arrival time and airport from last time element
            const lastTime = tripSection.find(".time").eq(-1);
            if (lastTime.length) {
                const arrivalTimeWithIndicator = lastTime.contents().first().text().trim();
                // Check if arrival time has +1 indicator (next day)
                hasNextDayArrival = arrivalTimeWithIndicator.includes("+1");
                tripArrivalTime = arrivalTimeWithIndicator.replace(/\+\d+/, "").trim();
                tripArrivalAirport = lastTime.find("span").text().trim();
            }
            // Duration and stops from ._stops
            const stopsSection = tripSection.find("._stops");
            if (stopsSection.length) {
                const durationElement = stopsSection.find(".time").first();
                if (durationElement.length) {
                    // Duration is already extracted, we just need stops count
                    const stopsElement = stopsSection.find(".stop");
                    if (stopsElement.length) {
                        const stopsText = stopsElement.text().trim();
                        // Extract just the number from "2 stops" or similar
                        const stopsMatch = stopsText.match(/(\d+)/);
                        stops = stopsMatch ? stopsMatch[1] : stopsText;
                    }
                }
            }
        }
        // Get timezone information for trip summary
        const depAirportCode = (0, entities_1.extractAirportCode)(tripDepartureAirport);
        const arrAirportCode = (0, entities_1.extractAirportCode)(tripArrivalAirport);
        if (!depAirportCode || !arrAirportCode) {
            console.warn(`⚠️ Could not extract airport codes from: ${tripDepartureAirport} -> ${tripArrivalAirport}`);
            return null;
        }
        const depTimezone = airports_json_1.default[depAirportCode]?.timezone;
        const arrTimezone = airports_json_1.default[arrAirportCode]?.timezone;
        if (!depTimezone) {
            throw new Error(`No timezone found for departure airport: ${depAirportCode}`);
        }
        if (!arrTimezone) {
            throw new Error(`No timezone found for arrival airport: ${arrAirportCode}`);
        }
        // Calculate arrival date for trip summary (may be next day)
        let arrivalDate = departureDate;
        if (hasNextDayArrival && departureDate) {
            arrivalDate = (0, helpers_1.addDaysToDateString)(departureDate, 1);
        }
        // Format trip summary times with timezone information
        const formattedTripDeparture = (0, helpers_1.createTimezonedDatetime)(departureDate, tripDepartureTime, depTimezone);
        const formattedTripArrival = (0, helpers_1.createTimezonedDatetime)(arrivalDate, tripArrivalTime, arrTimezone);
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
                    // Extract airline info from full flight number
                    const airlineName = flightNumberFull.split(" ")[0] || airline;
                    const airlineId = (0, entities_1.generateId)("airline", airlineName);
                    const airlineCode = (0, entities_1.extractAirlineCode)(flightNumberFull);
                    // Extract just the flight number part (e.g., "AM1531" from "Aeromexico AM1531")
                    const flightNumber = flightNumberFull.split(" ").slice(1).join(" ") || flightNumberFull;
                    // Extract airport codes
                    const depAirportCode = (0, entities_1.extractAirportCode)(flightDepartureAirport);
                    const arrAirportCode = (0, entities_1.extractAirportCode)(flightArrivalAirport);
                    // Get timezone information for airports
                    const depTimezone = airports_json_1.default[depAirportCode]?.timezone;
                    const arrTimezone = airports_json_1.default[arrAirportCode]?.timezone;
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
                    // Create flight object
                    const flightId = (0, entities_1.generateId)("flight", `${airlineCode}-${flightNumber}-${depAirportCode}-${arrAirportCode}`);
                    const flight = {
                        id: flightId,
                        airlineId,
                        flightNumber,
                        departure: formattedFlightDeparture,
                        arrival: formattedFlightArrival,
                        departureAirportCode: depAirportCode,
                        arrivalAirportCode: arrAirportCode,
                        extractedAt,
                    };
                    flightData.flights.push(flight);
                    flightIds.push(flightId);
                    // Add airline if not already present
                    if (!flightData.airlines.find((a) => a.id === airlineId)) {
                        flightData.airlines.push({
                            id: airlineId,
                            name: airlineName,
                            code: airlineCode,
                            extractedAt,
                        });
                    }
                }
            });
            // Extract booking options
            modal.find(".booking-option").each((i, option) => {
                const agency = $(option).find(".agency-name").text().trim();
                const optionPrice = $(option).find(".price").text().trim();
                const link = $(option).find("a").attr("href") || "";
                if (agency && optionPrice) {
                    bookingOptions.push({
                        agency,
                        price: optionPrice,
                        link,
                    });
                    // Track cheapest option
                    const priceValue = parseFloat(optionPrice.replace(/[^\d.,]/g, "").replace(",", "."));
                    if (!cheapest ||
                        priceValue <
                            parseFloat(cheapest.price.replace(/[^\d.,]/g, "").replace(",", "."))) {
                        cheapest = { agency, price: optionPrice, link };
                    }
                }
            });
        }
        // Create deal object
        const dealId = (0, entities_1.generateId)("deal", `${airline}-${tripDepartureAirport}-${tripArrivalAirport}-${departureDate}`);
        const deal = {
            id: dealId,
            portal,
            dealName: dealName,
            flightIds,
            agency: cheapest?.agency ?? "",
            price,
            link: cheapest?.link ?? "",
            tripSummary: {
                departure: formattedTripDeparture,
                arrival: formattedTripArrival,
                stops: stops,
            },
            currency,
            extractedAt,
        };
        flightData.deals.push(deal);
        return flightData;
    }
    catch (error) {
        console.warn(`⚠️ Error extracting deal from list item:`, error);
        return null;
    }
}
//# sourceMappingURL=extractFlightDataFromResponse.js.map