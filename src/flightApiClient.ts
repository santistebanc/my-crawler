import { FlightData } from "./entities";
import { pollForSkyFlightData } from "./pollForSkyFlightData";
import { pollForKiwiFlightData } from "./pollForKiwiFlightData";
import { fetchSkyPageAndExtractData, RequestParams as SkyRequestParams, SkyExtractedData } from "./fetchSkyPageAndExtractData";
import { fetchKiwiPageAndExtractData, RequestParams as KiwiRequestParams, KiwiExtractedData } from "./fetchKiwiPageAndExtractData";

// API Surface - Separate functions for each portal

/**
 * Fetches flight data from Sky portal
 */
export async function fetchSkyFlightData(
  requestParams: SkyRequestParams
): Promise<FlightData> {
  // Sky portal uses complex data extraction
  const pageData = await fetchSkyPageAndExtractData(requestParams);
  
  if (!pageData) {
    throw new Error(
      `Failed to extract session data from Sky portal page`
    );
  }

  // Now use the extracted data for polling
  return await pollForSkyFlightData(pageData, requestParams);
}

/**
 * Fetches flight data from Kiwi portal
 */
export async function fetchKiwiFlightData(
  requestParams: KiwiRequestParams
): Promise<FlightData> {
  // Kiwi portal uses simpler data extraction
  const pageData = await fetchKiwiPageAndExtractData(requestParams);
  
  if (!pageData) {
    throw new Error(
      `Failed to extract session data from Kiwi portal page`
    );
  }

  // Now use the extracted data for Kiwi search
  return await pollForKiwiFlightData(pageData, requestParams);
}
