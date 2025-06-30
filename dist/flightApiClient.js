"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchSkyFlightData = fetchSkyFlightData;
exports.fetchKiwiFlightData = fetchKiwiFlightData;
const pollForSkyFlightData_1 = require("./pollForSkyFlightData");
const pollForKiwiFlightData_1 = require("./pollForKiwiFlightData");
const fetchSkyPageAndExtractData_1 = require("./fetchSkyPageAndExtractData");
const fetchKiwiPageAndExtractData_1 = require("./fetchKiwiPageAndExtractData");
// API Surface - Separate functions for each portal
/**
 * Fetches flight data from Sky portal
 */
async function fetchSkyFlightData(requestParams) {
    // Sky portal uses complex data extraction
    const pageData = await (0, fetchSkyPageAndExtractData_1.fetchSkyPageAndExtractData)(requestParams);
    if (!pageData) {
        throw new Error(`Failed to extract session data from Sky portal page`);
    }
    // Now use the extracted data for polling
    return await (0, pollForSkyFlightData_1.pollForSkyFlightData)(pageData, requestParams);
}
/**
 * Fetches flight data from Kiwi portal
 */
async function fetchKiwiFlightData(requestParams) {
    // Kiwi portal uses simpler data extraction
    const pageData = await (0, fetchKiwiPageAndExtractData_1.fetchKiwiPageAndExtractData)(requestParams);
    if (!pageData) {
        throw new Error(`Failed to extract session data from Kiwi portal page`);
    }
    // Now use the extracted data for Kiwi search
    return await (0, pollForKiwiFlightData_1.pollForKiwiFlightData)(pageData, requestParams);
}
//# sourceMappingURL=flightApiClient.js.map