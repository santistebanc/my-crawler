"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTimezonedDatetime = exports.addDaysToDateString = exports.parseDateString = void 0;
exports.mapCabinClassForKiwi = mapCabinClassForKiwi;
exports.buildPortalSearchParams = buildPortalSearchParams;
exports.buildKiwiPortalSearchParams = buildKiwiPortalSearchParams;
exports.buildPortalUrl = buildPortalUrl;
exports.extractSessionCookie = extractSessionCookie;
exports.mergeFlightData = mergeFlightData;
const airports_json_1 = __importDefault(require("./airports.json"));
const dateUtils_1 = require("./dateUtils");
Object.defineProperty(exports, "parseDateString", { enumerable: true, get: function () { return dateUtils_1.parseDateString; } });
Object.defineProperty(exports, "addDaysToDateString", { enumerable: true, get: function () { return dateUtils_1.addDaysToDateString; } });
Object.defineProperty(exports, "createTimezonedDatetime", { enumerable: true, get: function () { return dateUtils_1.createTimezonedDatetime; } });
const logger_1 = require("./logger");
// Use the .data property for lookups
const airportsData = airports_json_1.default.data;
/**
 * Maps cabin class to Kiwi portal format
 */
function mapCabinClassForKiwi(cabinclass) {
    switch (cabinclass) {
        case 'Economy': return 'M';
        case 'PremiumEconomy': return 'W';
        case 'First': return 'F';
        case 'Business': return 'C';
        default: return 'M';
    }
}
/**
 * Builds URL search parameters from request parameters for flightsfinder.com portal URLs
 * @param requestParams - The request parameters containing flight search criteria
 * @returns URLSearchParams object ready to be used in URL construction
 */
function buildPortalSearchParams(requestParams) {
    return new URLSearchParams({
        originplace: requestParams.originplace || "",
        destinationplace: requestParams.destinationplace || "",
        outbounddate: requestParams.outbounddate || "",
        inbounddate: requestParams.inbounddate || "",
        cabinclass: requestParams.cabinclass || "Economy",
        adults: requestParams.adults.toString(),
        children: requestParams.children.toString(),
        infants: requestParams.infants.toString(),
        currency: requestParams.currency,
    });
}
/**
 * Builds URL search parameters specifically for Kiwi portal
 * @param requestParams - The request parameters containing flight search criteria
 * @returns URLSearchParams object ready to be used in URL construction
 */
function buildKiwiPortalSearchParams(requestParams) {
    return new URLSearchParams({
        currency: requestParams.currency,
        cabinclass: mapCabinClassForKiwi(requestParams.cabinclass),
        originplace: requestParams.originplace || "",
        destinationplace: requestParams.destinationplace || "",
        outbounddate: (0, dateUtils_1.formatDateForKiwi)(requestParams.outbounddate || ""),
        inbounddate: (0, dateUtils_1.formatDateForKiwi)(requestParams.inbounddate || ""),
        adults: requestParams.adults.toString(),
        children: requestParams.children.toString(),
        infants: requestParams.infants.toString(),
    });
}
/**
 * Builds a complete portal URL with search parameters
 * @param portal - The portal name (e.g., 'sky', 'kiwi')
 * @param requestParams - The request parameters containing flight search criteria
 * @returns Complete URL string for the portal
 */
function buildPortalUrl(portal, requestParams) {
    let searchParams;
    if (portal === 'kiwi') {
        searchParams = buildKiwiPortalSearchParams(requestParams);
    }
    else {
        searchParams = buildPortalSearchParams(requestParams);
    }
    return `https://www.flightsfinder.com/portal/${portal}?${searchParams.toString()}`;
}
/**
 * Extracts the flightsfinder_session cookie from a set-cookie header string.
 * @param setCookieHeader - The set-cookie header string from a response
 * @returns The session cookie string, or an empty string if not found
 */
function extractSessionCookie(setCookieHeader) {
    if (!setCookieHeader)
        return "";
    const cookies = setCookieHeader.split(",").map((cookie) => cookie.trim());
    for (const cookie of cookies) {
        if (cookie.startsWith("flightsfinder_session=")) {
            return cookie.split(";")[0];
        }
    }
    return "";
}
/**
 * Merges flight data from source into target
 */
function mergeFlightData(target, source) {
    // Merge bundles
    source.bundles.forEach((bundle) => {
        if (!target.bundles.find((b) => b.uniqueId === bundle.uniqueId)) {
            // No existing bundle with this ID, add it
            target.bundles.push(bundle);
        }
    });
    // Merge flights
    source.flights.forEach((flight) => {
        if (!target.flights.find((f) => f.uniqueId === flight.uniqueId)) {
            target.flights.push(flight);
        }
    });
    // Merge booking options
    source.bookingOptions.forEach((bookingOption) => {
        const existingBookingOptionIndex = target.bookingOptions.findIndex((b) => b.uniqueId === bookingOption.uniqueId);
        if (existingBookingOptionIndex === -1) {
            // No existing booking option with this ID, add it
            target.bookingOptions.push(bookingOption);
        }
        else {
            // Booking option with same ID exists, compare extraction dates and keep the latest if difference > 1min
            const existingBookingOption = target.bookingOptions[existingBookingOptionIndex];
            const existingDate = new Date(existingBookingOption.extractedAt);
            const newDate = new Date(bookingOption.extractedAt);
            // Calculate time difference in minutes
            const timeDiffMinutes = Math.abs(newDate.getTime() - existingDate.getTime()) / (1000 * 60);
            if (newDate > existingDate && timeDiffMinutes > 1) {
                // Replace with the more recently extracted booking option only if difference > 1min
                target.bookingOptions[existingBookingOptionIndex] = bookingOption;
                logger_1.logger.debug(logger_1.LogCategory.DATA, `Replaced booking option with newer extraction`, {
                    bookingOptionId: bookingOption.uniqueId,
                    timeDiffMinutes: timeDiffMinutes.toFixed(1),
                    oldDate: existingDate.toISOString(),
                    newDate: newDate.toISOString()
                });
            }
        }
    });
}
//# sourceMappingURL=helpers.js.map