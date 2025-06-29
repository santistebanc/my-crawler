"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPortalSearchParams = buildPortalSearchParams;
exports.buildPortalUrl = buildPortalUrl;
exports.extractSessionCookie = extractSessionCookie;
exports.parseDateString = parseDateString;
exports.addDaysToDateString = addDaysToDateString;
exports.createTimezonedDatetime = createTimezonedDatetime;
exports.mergeFlightData = mergeFlightData;
const date_fns_1 = require("date-fns");
const luxon_1 = require("luxon");
const airports_json_1 = __importDefault(require("./airports.json"));
const airlines_json_1 = __importDefault(require("./airlines.json"));
// Use the .data property for lookups
const airportsData = airports_json_1.default.data;
const airlineCodes = airlines_json_1.default.data;
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
        // Parse the time string using date-fns
        let timeDate;
        // Handle 24-hour format (e.g., "14:30")
        if (timeStr.match(/^\d{1,2}:\d{2}$/)) {
            timeDate = (0, date_fns_1.parse)(timeStr, "HH:mm", new Date());
        }
        else {
            // Handle 12-hour format (e.g., "2:30 PM")
            timeDate = (0, date_fns_1.parse)(timeStr, "h:mm a", new Date());
        }
        if (!(0, date_fns_1.isValid)(timeDate)) {
            console.warn(`⚠️ Could not parse time string: "${timeStr}"`);
            return "";
        }
        // Combine the date and time
        const combinedDate = new Date(parsedDate);
        combinedDate.setHours(timeDate.getHours(), timeDate.getMinutes(), 0, 0);
        // Handle different timezone formats
        if (!timezone || timezone === "\\N" || timezone === "null") {
            // Default to UTC for missing or null timezones
            const utcDate = new Date(combinedDate.getTime() - combinedDate.getTimezoneOffset() * 60000);
            return (0, date_fns_1.format)(utcDate, "yyyy-MM-dd HH:mm 'UTC'");
        }
        // Handle UTC±HH:MM format
        if (timezone.startsWith('UTC')) {
            // Normalize minus sign (could be unicode)
            const tz = timezone.replace('−', '-').replace('–', '-');
            const match = tz.match(/^UTC([+-])(\d{2}):(\d{2})$/);
            if (match) {
                const sign = match[1] === '-' ? -1 : 1;
                const hours = parseInt(match[2], 10);
                const minutes = parseInt(match[3], 10);
                const offsetMinutes = sign * (hours * 60 + minutes);
                // Apply offset to UTC time
                const utcDate = new Date(combinedDate.getTime() - combinedDate.getTimezoneOffset() * 60000);
                const offsetDate = new Date(utcDate.getTime() + offsetMinutes * 60000);
                return (0, date_fns_1.format)(offsetDate, "yyyy-MM-dd HH:mm 'UTC'XXX");
            }
        }
        // Handle IANA timezone format (e.g., "Australia/Perth", "Europe/Vienna")
        try {
            const luxonDateTime = luxon_1.DateTime.fromJSDate(combinedDate, { zone: timezone });
            if (luxonDateTime.isValid) {
                return luxonDateTime.toISO();
            }
        }
        catch (error) {
            console.warn(`⚠️ Could not parse IANA timezone "${timezone}": ${error}`);
        }
        // Fallback: just append the timezone string
        const dateTimeStr = (0, date_fns_1.format)(combinedDate, "yyyy-MM-dd HH:mm");
        return `${dateTimeStr} ${timezone}`;
    }
    catch (error) {
        console.warn(`⚠️ Error creating timezoned datetime: ${error}`);
        return "";
    }
}
/**
 * Merges flight data from source into target
 */
function mergeFlightData(target, source) {
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