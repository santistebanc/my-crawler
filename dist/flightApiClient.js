"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchFlightData = fetchFlightData;
const pollForSkyFlightData_1 = require("./pollForSkyFlightData");
const pollForKiwiFlightData_1 = require("./pollForKiwiFlightData");
const fetchSkyPageAndExtractData_1 = require("./fetchSkyPageAndExtractData");
const fetchKiwiPageAndExtractData_1 = require("./fetchKiwiPageAndExtractData");
// API Surface - Main function that users call
async function fetchFlightData(portal, requestParams) {
    if (portal === 'kiwi') {
        // Kiwi portal uses simpler data extraction
        const pageData = await (0, fetchKiwiPageAndExtractData_1.fetchKiwiPageAndExtractData)(portal, requestParams);
        if (!pageData) {
            throw new Error(`Failed to extract session data from page for portal: ${portal}`);
        }
        // Now use the extracted data for Kiwi search
        return await (0, pollForKiwiFlightData_1.pollForKiwiFlightData)(pageData, requestParams);
    }
    else {
        // Sky portal uses complex data extraction
        const pageData = await (0, fetchSkyPageAndExtractData_1.fetchSkyPageAndExtractData)(portal, requestParams);
        if (!pageData) {
            throw new Error(`Failed to extract session data from page for portal: ${portal}`);
        }
        // Now use the extracted data for polling
        return await (0, pollForSkyFlightData_1.pollForSkyFlightData)(pageData, requestParams);
    }
}
//# sourceMappingURL=flightApiClient.js.map