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
import { logger, LogCategory } from "./logger";

/**
 * Handles Kiwi portal which uses a single search request
 */
export async function pollForKiwiFlightData(
  pageData: KiwiExtractedData,
  requestParams: KiwiRequestParams
): Promise<FlightData> {
  const searchUrl = "https://www.flightsfinder.com/portal/kiwi/search";
  logger.info(LogCategory.SCRAPING, `🚀 Starting Kiwi search`);

  // Construct the referer URL using helper
  const refererUrl = buildPortalUrl("kiwi", requestParams);

  // Kiwi usually returns all results at once, but we'll support multiple responses for robustness
  let isLastResponse = false;
  let flightData: FlightData = { bundles: [], flights: [], bookingOptions: [] };
  let attempt = 0;
  const maxAttempts = 3;
  let previousResultsCount = 0; // Track previous attempt's result count

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

      const response = await fetch(searchUrl, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const rawData = await response.text();

      // Parse the pipe-delimited response format
      const responseParts = rawData.split("|");
      if (responseParts.length < 7) {
        logger.warn(LogCategory.SCRAPING, `⚠️ Invalid Kiwi response format`);
        break;
      }

      isLastResponse = responseParts[0] === "Y";
      const htmlContent = responseParts[6];

      if (htmlContent.includes("list-item row")) {
        // Count the number of list-item rows to determine if results changed
        const currentResultsCount = (htmlContent.match(/list-item row/g) || []).length;
        
        // Only scrape if results count changed or this is the first attempt
        if (currentResultsCount !== previousResultsCount || attempt === 1) {
          const extractedData = extractFlightDataFromResponse(
            htmlContent,
            "kiwi"
          );
          // Merge results using the helper function
          mergeFlightData(flightData, extractedData);
          logger.info(
            LogCategory.SCRAPING,
            `📈 Kiwi: +${extractedData.bundles.length} bundles, +${extractedData.flights.length} flights, +${extractedData.bookingOptions.length} options`
          );
        } else {
          logger.debug(LogCategory.SCRAPING, `⏭️ Kiwi attempt ${attempt}: No new results`);
        }
        
        // Update the previous results count
        previousResultsCount = currentResultsCount;
      } else if (
        htmlContent.includes("No flights found") ||
        htmlContent.includes("No results")
      ) {
        logger.info(LogCategory.SCRAPING, `❌ No flights found in Kiwi`);
        break;
      } else {
        logger.warn(LogCategory.SCRAPING, `⚠️ Unexpected Kiwi response format`);
        break;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(LogCategory.SCRAPING, `❌ Kiwi search error: ${errorMessage}`);
      break;
    }
  }

  logger.info(LogCategory.SCRAPING, `🏁 Kiwi search completed`);
  return flightData;
}
