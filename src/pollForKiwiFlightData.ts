import { FlightData } from "./entities";
import {
  RequestParams as KiwiRequestParams,
  KiwiExtractedData,
} from "./fetchKiwiPageAndExtractData";
import {
  buildKiwiPortalSearchParams,
  buildPortalUrl,
  mergeFlightData,
} from "./helpers";
import { extractFlightDataFromResponse } from "./extractFlightDataFromResponse";

/**
 * Handles Kiwi portal which uses a single search request
 */
export async function pollForKiwiFlightData(
  pageData: KiwiExtractedData,
  requestParams: KiwiRequestParams
): Promise<FlightData> {
  const searchUrl = "https://www.flightsfinder.com/portal/kiwi/search";
  console.info(`🚀 Starting Kiwi portal search at ${searchUrl}`);

  // Construct the referer URL using helper
  const refererUrl = buildPortalUrl("kiwi", requestParams);

  // Kiwi usually returns all results at once, but we'll support multiple responses for robustness
  let isLastResponse = false;
  let flightData: FlightData = { bundles: [], flights: [], bookingOptions: [] };
  let attempt = 0;
  const maxAttempts = 3;

  while (!isLastResponse && attempt < maxAttempts) {
    attempt++;
    try {
      // Create headers for the search request
      const headers = {
        accept: "*/*",
        "accept-language": "en-GB,en;q=0.9",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        origin: "https://www.flightsfinder.com",
        priority: "u=1, i",
        referer: refererUrl,
        "sec-ch-ua":
          '"Brave";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "sec-gpc": "1",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        "x-requested-with": "XMLHttpRequest",
        cookie: pageData.cookie,
      };

      // Create form data for the search request
      const formData = new URLSearchParams({
        _token: pageData._token,
        ...Object.fromEntries(buildKiwiPortalSearchParams(requestParams)),
        type: "",
        "bags-cabin": "0",
        "bags-checked": "0",
      }).toString();

      console.info(`📤 Sending Kiwi search request (attempt ${attempt})`);

      const response = await fetch(searchUrl, {
        method: "POST",
        headers,
        body: formData,
      });

      console.info(
        `📥 Kiwi search response: status=${
          response.status
        }, content-type=${response.headers.get("content-type")}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawData = await response.text();
      console.info(
        `📄 Kiwi search raw response length: ${rawData.length} characters`
      );

      // Parse the pipe-delimited response format
      const responseParts = rawData.split("|");
      if (responseParts.length < 7) {
        console.warn(
          `⚠️ Invalid Kiwi response format: expected at least 7 parts, got ${responseParts.length}`
        );
        break;
      }

      isLastResponse = responseParts[0] === "Y";
      const htmlContent = responseParts[6];
      console.info(
        `📊 Kiwi poll status: ${responseParts[0]} (${
          isLastResponse ? "LAST" : "MORE"
        }) data`
      );
      console.info(
        `📄 Kiwi HTML content length: ${htmlContent.length} characters`
      );

      if (htmlContent.includes("list-item row")) {
        const extractedData = extractFlightDataFromResponse(
          htmlContent,
          "kiwi"
        );
        // Merge results using the helper function
        mergeFlightData(flightData, extractedData);
        console.info(
          `📊 Kiwi poll extracted: ${extractedData.bundles.length} bundles, ${extractedData.flights.length} flights, ${extractedData.bookingOptions.length} booking options`
        );
      } else if (
        htmlContent.includes("No flights found") ||
        htmlContent.includes("No results")
      ) {
        console.info(`❌ No flights found in Kiwi response`);
        break;
      } else {
        console.warn(`⚠️ Unexpected Kiwi response format`);
        break;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`❌ Error in Kiwi portal search: ${errorMessage}`);
      break;
    }
  }

  return flightData;
}
