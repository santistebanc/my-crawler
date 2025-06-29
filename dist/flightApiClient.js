"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchFlightData = fetchFlightData;
const pollForFlightData_1 = require("./pollForFlightData");
const fetchPageAndExtractData_1 = require("./fetchPageAndExtractData");
// API Surface - Main function that users call
async function fetchFlightData(portal, requestParams) {
    // First, fetch the page to get session data and extract required parameters
    const pageData = await (0, fetchPageAndExtractData_1.fetchPageAndExtractData)(portal, requestParams);
    if (!pageData) {
        throw new Error(`Failed to extract session data from page for portal: ${portal}`);
    }
    // Now use the extracted data for polling
    return await (0, pollForFlightData_1.pollForFlightData)(portal, pageData, requestParams);
}
//# sourceMappingURL=flightApiClient.js.map