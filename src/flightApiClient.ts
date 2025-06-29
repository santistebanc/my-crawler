import { Portal } from "./types";
import { FlightData } from "./entities";
import { pollForFlightData } from "./pollForFlightData";
import { fetchPageAndExtractData, RequestParams } from "./fetchPageAndExtractData";

// API Surface - Main function that users call
export async function fetchFlightData(
  portal: Portal,
  requestParams: RequestParams
): Promise<FlightData> {
  // First, fetch the page to get session data and extract required parameters
  const pageData = await fetchPageAndExtractData(portal, requestParams);

  if (!pageData) {
    throw new Error(
      `Failed to extract session data from page for portal: ${portal}`
    );
  }

  // Now use the extracted data for polling
  return await pollForFlightData(portal, pageData, requestParams);
}
