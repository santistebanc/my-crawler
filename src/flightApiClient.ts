import { Portal } from "./types";
import { FlightData } from "./entities";
import { pollForSkyFlightData } from "./pollForSkyFlightData";
import { pollForKiwiFlightData } from "./pollForKiwiFlightData";
import { fetchSkyPageAndExtractData, RequestParams as SkyRequestParams, SkyExtractedData } from "./fetchSkyPageAndExtractData";
import { fetchKiwiPageAndExtractData, RequestParams as KiwiRequestParams, KiwiExtractedData } from "./fetchKiwiPageAndExtractData";

// API Surface - Main function that users call
export async function fetchFlightData(
  portal: Portal,
  requestParams: SkyRequestParams | KiwiRequestParams
): Promise<FlightData> {
  if (portal === 'kiwi') {
    // Kiwi portal uses simpler data extraction
    const pageData = await fetchKiwiPageAndExtractData(portal, requestParams);
    
    if (!pageData) {
      throw new Error(
        `Failed to extract session data from page for portal: ${portal}`
      );
    }

    // Now use the extracted data for Kiwi search
    return await pollForKiwiFlightData(pageData, requestParams);
  } else {
    // Sky portal uses complex data extraction
    const pageData = await fetchSkyPageAndExtractData(portal, requestParams);
    
    if (!pageData) {
      throw new Error(
        `Failed to extract session data from page for portal: ${portal}`
      );
    }

    // Now use the extracted data for polling
    return await pollForSkyFlightData(pageData, requestParams);
  }
}
