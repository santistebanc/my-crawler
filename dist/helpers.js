"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPortalSearchParams = buildPortalSearchParams;
exports.buildPortalUrl = buildPortalUrl;
exports.extractSessionCookie = extractSessionCookie;
exports.parseDateString = parseDateString;
exports.addDaysToDateString = addDaysToDateString;
exports.createTimezonedDatetime = createTimezonedDatetime;
exports.mergeFlightData = mergeFlightData;
const date_fns_1 = require("date-fns");
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
 * Builds a complete portal URL with search parameters
 * @param portal - The portal name (e.g., 'sky', 'kiwi')
 * @param requestParams - The request parameters containing flight search criteria
 * @returns Complete URL string for the portal
 */
function buildPortalUrl(portal, requestParams) {
    const searchParams = buildPortalSearchParams(requestParams);
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
 * Parses a date string in the format "EEE, dd MMM yyyy"
 */
function parseDateString(dateStr) {
    try {
        const parsedDate = (0, date_fns_1.parse)(dateStr, "EEE, dd MMM yyyy", new Date());
        return (0, date_fns_1.isValid)(parsedDate) ? parsedDate : null;
    }
    catch (error) {
        return null;
    }
}
/**
 * Adds days to a date string and returns the new date string
 */
function addDaysToDateString(dateStr, days) {
    try {
        const parsedDate = parseDateString(dateStr);
        if (!parsedDate)
            return dateStr;
        const adjustedDate = (0, date_fns_1.addDays)(parsedDate, days);
        return (0, date_fns_1.format)(adjustedDate, "EEE, dd MMM yyyy");
    }
    catch (error) {
        return dateStr;
    }
}
/**
 * Creates a timezoned datetime string
 */
function createTimezonedDatetime(dateStr, timeStr, timezone) {
    try {
        const parsedDate = parseDateString(dateStr);
        if (!parsedDate)
            return "";
        const dateTimeStr = (0, date_fns_1.format)(parsedDate, "yyyy-MM-dd HH:mm");
        return `${dateTimeStr} ${timezone}`;
    }
    catch (error) {
        return "";
    }
}
/**
 * Merges flight data from source into target
 */
function mergeFlightData(target, source) {
    // Merge airlines
    source.airlines.forEach((airline) => {
        if (!target.airlines.find((a) => a.id === airline.id)) {
            target.airlines.push(airline);
        }
    });
    // Merge deals
    source.deals.forEach((deal) => {
        if (!target.deals.find((d) => d.id === deal.id)) {
            target.deals.push(deal);
        }
    });
    // Merge flights
    source.flights.forEach((flight) => {
        if (!target.flights.find((f) => f.id === flight.id)) {
            target.flights.push(flight);
        }
    });
}
//# sourceMappingURL=helpers.js.map