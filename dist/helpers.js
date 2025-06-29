"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapCabinClassForKiwi = mapCabinClassForKiwi;
exports.buildPortalSearchParams = buildPortalSearchParams;
exports.buildKiwiPortalSearchParams = buildKiwiPortalSearchParams;
exports.buildPortalUrl = buildPortalUrl;
exports.extractSessionCookie = extractSessionCookie;
exports.parseDateString = parseDateString;
exports.addDaysToDateString = addDaysToDateString;
exports.createTimezonedDatetime = createTimezonedDatetime;
exports.mergeFlightData = mergeFlightData;
const date_fns_1 = require("date-fns");
const luxon_1 = require("luxon");
const airports_json_1 = __importDefault(require("./airports.json"));
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
    // Convert date format from YYYY-MM-DD to dd/MM/yyyy for Kiwi
    const formatDateForKiwi = (dateStr) => {
        if (!dateStr)
            return "";
        try {
            const date = (0, date_fns_1.parse)(dateStr, "yyyy-MM-dd", new Date());
            if ((0, date_fns_1.isValid)(date)) {
                return (0, date_fns_1.format)(date, "dd/MM/yyyy");
            }
        }
        catch (error) {
            console.warn(`⚠️ Could not parse date for Kiwi: ${dateStr}`);
        }
        return dateStr;
    };
    return new URLSearchParams({
        currency: requestParams.currency,
        cabinclass: mapCabinClassForKiwi(requestParams.cabinclass),
        originplace: requestParams.originplace || "",
        destinationplace: requestParams.destinationplace || "",
        outbounddate: formatDateForKiwi(requestParams.outbounddate || ""),
        inbounddate: formatDateForKiwi(requestParams.inbounddate || ""),
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
        const parsedDate = parseDateString(dateStr) || new Date();
        // Parse the time string using date-fns
        let timeDate;
        if (timeStr.match(/^\d{1,2}:\d{2}$/)) {
            timeDate = (0, date_fns_1.parse)(timeStr, "HH:mm", new Date());
        }
        else {
            timeDate = (0, date_fns_1.parse)(timeStr, "h:mm a", new Date());
        }
        if (!(0, date_fns_1.isValid)(timeDate)) {
            console.warn(`⚠️ Could not parse time string: "${timeStr}"`);
            return "";
        }
        // Combine the date and time
        const combinedDate = new Date(parsedDate);
        combinedDate.setHours(timeDate.getHours(), timeDate.getMinutes(), 0, 0);
        // Use Luxon for all timezone handling
        let dt;
        if (!timezone || timezone === "\\N" || timezone === "null") {
            // Default to UTC for missing or null timezones
            dt = luxon_1.DateTime.fromJSDate(combinedDate, { zone: "UTC" });
        }
        else if (timezone.startsWith('UTC')) {
            // Handle UTC±HH:MM format
            const tz = timezone.replace('−', '-').replace('–', '-');
            const match = tz.match(/^UTC([+-])(\d{2}):(\d{2})$/);
            if (match) {
                const sign = match[1] === '-' ? -1 : 1;
                const hours = parseInt(match[2], 10);
                const minutes = parseInt(match[3], 10);
                const offsetMinutes = sign * (hours * 60 + minutes);
                // Create a DateTime in the specified offset timezone
                dt = luxon_1.DateTime.fromJSDate(combinedDate, { zone: "UTC" }).plus({ minutes: offsetMinutes });
                // Convert to the offset timezone string format
                const offsetStr = `${sign === 1 ? '+' : '-'}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                return dt.toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS") + offsetStr;
            }
            else {
                dt = luxon_1.DateTime.fromJSDate(combinedDate, { zone: "UTC" });
            }
        }
        else {
            // Handle IANA timezone format (e.g., "Australia/Perth", "Europe/Vienna")
            dt = luxon_1.DateTime.fromJSDate(combinedDate, { zone: timezone });
            if (!dt.isValid) {
                dt = luxon_1.DateTime.fromJSDate(combinedDate, { zone: "UTC" });
            }
        }
        // Return ISO string with timezone offset
        return dt.toISO() || '';
    }
    catch (error) {
        console.warn(`⚠️ Error creating timezoned datetime: ${error}`);
        return luxon_1.DateTime.fromJSDate(new Date()).toUTC().toISO() || '';
    }
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
                console.info(`🕒 Replaced booking option ${bookingOption.uniqueId} with newer extraction (${timeDiffMinutes.toFixed(1)}min diff): ${existingDate.toISOString()} → ${newDate.toISOString()}`);
            }
        }
    });
}
//# sourceMappingURL=helpers.js.map