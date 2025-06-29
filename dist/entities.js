"use strict";
// Entity interfaces for flight data
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.createBundleIdFromFlightIds = createBundleIdFromFlightIds;
exports.createDatetimeForId = createDatetimeForId;
exports.extractAirportCode = extractAirportCode;
exports.createBookingOptionId = createBookingOptionId;
const luxon_1 = require("luxon");
const date_fns_1 = require("date-fns");
const helpers_1 = require("./helpers");
// Utility functions for entity management
function generateId(prefix, data) {
    const hash = data.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `${prefix}_${hash}`;
}
/**
 * Creates a unique bundle ID based on the sorted array of flight IDs
 */
function createBundleIdFromFlightIds(flightIds) {
    // Sort flight IDs to ensure consistent ordering
    const sortedFlightIds = [...flightIds].sort();
    // Create a hash-like string from the sorted flight IDs
    const flightIdsString = sortedFlightIds.join('-');
    // Generate a simple hash for the string
    let hash = 0;
    for (let i = 0; i < flightIdsString.length; i++) {
        const char = flightIdsString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    // Convert to positive hex string and take first 8 characters
    const hashString = Math.abs(hash).toString(16).padStart(8, '0').substring(0, 8);
    return `bundle_${hashString}`;
}
/**
 * Creates a datetime string without timezone for ID generation
 */
function createDatetimeForId(dateStr, timeStr) {
    try {
        const parsedDate = (0, helpers_1.parseDateString)(dateStr) || new Date();
        // Parse the time string using date-fns
        let timeDate;
        if (timeStr.match(/^\d{1,2}:\d{2}$/)) {
            timeDate = (0, date_fns_1.parse)(timeStr, "HH:mm", new Date());
        }
        else {
            timeDate = (0, date_fns_1.parse)(timeStr, "h:mm a", new Date());
        }
        if (!(0, date_fns_1.isValid)(timeDate)) {
            return "";
        }
        // Combine the date and time
        const combinedDate = new Date(parsedDate);
        combinedDate.setHours(timeDate.getHours(), timeDate.getMinutes(), 0, 0);
        // Format as YYYYMMDDHHMM (without timezone)
        return luxon_1.DateTime.fromJSDate(combinedDate).toFormat("yyyyMMddHHmm");
    }
    catch (error) {
        return "";
    }
}
function extractAirportCode(airportString) {
    // Extract airport code from strings like "SLP San Luis Potosi" or "MEX Mexico City"
    const match = airportString.match(/^([A-Z]{3})\s/);
    return match ? match[1] : airportString.split(' ')[0];
}
/**
 * Creates a unique booking option ID based on the link, agency, and targetId
 */
function createBookingOptionId(link, agency, targetId) {
    // Generate a simple hash for the link
    let hash = 0;
    for (let i = 0; i < link.length; i++) {
        const char = link.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    // Convert to positive hex string and take first 8 characters
    const linkHash = Math.abs(hash).toString(16).padStart(8, '0').substring(0, 8);
    // Clean agency name for ID
    const cleanAgency = agency.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    // Extract target hash from targetId (remove 'bundle_' or 'flight_' prefix)
    const targetHash = targetId.replace(/^(bundle_|flight_)/, '');
    return `booking_${linkHash}_${cleanAgency}_${targetHash}`;
}
//# sourceMappingURL=entities.js.map