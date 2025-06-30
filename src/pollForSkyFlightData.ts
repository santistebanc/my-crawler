import { FlightData } from "./entities";
import {
  RequestParams as SkyRequestParams,
  SkyExtractedData,
} from "./fetchSkyPageAndExtractData";
import { buildPortalUrl, extractSessionCookie } from "./helpers";
import { extractFlightDataFromResponse } from "./extractFlightDataFromResponse";
import { mergeFlightData } from "./helpers";
import { logger, LogCategory } from "./logger";

/**
 * Handles Sky portal which uses polling
 */
export async function pollForSkyFlightData(
  pageData: SkyExtractedData,
  requestParams: SkyRequestParams
): Promise<FlightData> {
  const baseUrl = `https://www.flightsfinder.com/portal/sky/poll`;
  logger.info(LogCategory.SCRAPING, `🚀 Starting Sky polling`);

  // Construct the referer URL using helper
  const refererUrl = buildPortalUrl('sky', requestParams);

  let pollCount = 0;
  let failedPolls = 0;
  const maxPolls = 15; // Prevent infinite polling
  const maxRetries = 3; // Max retries per failed poll
  const pollInterval = 100; // 100ms as specified
  const maxPollingTime = 30000; // 30 seconds maximum polling time
  const startTime = Date.now();

  // Initialize flight data structure
  const flightData: FlightData = {
    bundles: [],
    flights: [],
    bookingOptions: [],
  };

  let currentCookie = pageData.cookie; // Start with initial cookie
  let currentPageData = pageData; // Keep track of current page data
  let previousResultsCount = 0; // Track previous poll's result count

  while (pollCount < maxPolls) {
    // Check if we've exceeded the maximum polling time
    if (Date.now() - startTime > maxPollingTime) {
      logger.warn(LogCategory.SCRAPING, `⏰ Polling timeout`);
      break;
    }

    pollCount++;
    let retryCount = 0;
    let pollSuccess = false;

    while (retryCount < maxRetries && !pollSuccess) {
      try {
        // Create fresh headers for each request with current cookie
        const headers = {
          accept: "*/*",
          "accept-language": "en-GB,en;q=0.9",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          origin: "https://www.flightsfinder.com",
          priority: "u=1, i",
          referer: refererUrl,
          "sec-ch-ua": '"Brave";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "sec-gpc": "1",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
          "x-requested-with": "XMLHttpRequest",
          cookie: currentCookie, // Use current cookie in fresh headers
        };

        // Update noc with fresh timestamp for each poll request
        const formData = new URLSearchParams({
          _token: currentPageData._token,
          session: currentPageData.session,
          suuid: currentPageData.suuid,
          noc: Date.now().toString(),
          deeplink: currentPageData.deeplink,
          s: "www",
          adults: requestParams.adults.toString(),
          children: requestParams.children.toString(),
          infants: requestParams.infants.toString(),
          currency: requestParams.currency,
        }).toString();

        const response = await fetch(baseUrl, {
          method: "POST",
          headers,
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const htmlData = await response.text();

        // Parse the pipe-delimited response format
        const responseParts = htmlData.split('|');
        
        if (responseParts.length < 7) {
          logger.warn(LogCategory.SCRAPING, `⚠️ Invalid response format`);
          retryCount++;
          continue;
        }

        const isLastResponse = responseParts[0] === 'Y';
        const htmlContent = responseParts[6];

        // Extract updated session cookie from response
        const setCookieHeader = response.headers.get("set-cookie");
        const newCookie = extractSessionCookie(setCookieHeader);
        if (newCookie && newCookie !== currentCookie) {
          currentCookie = newCookie;
        }

        // Check if we have flight data in the HTML content
        if (htmlContent.includes("list-item row")) {
          // Count the number of list-item rows to determine if results changed
          const currentResultsCount = (htmlContent.match(/list-item row/g) || []).length;
          
          // Only scrape if results count changed or this is the first poll
          if (currentResultsCount !== previousResultsCount || pollCount === 1) {
            // Track current entity counts before extraction
            const bundlesBefore = flightData.bundles.length;
            const flightsBefore = flightData.flights.length;
            const bookingOptionsBefore = flightData.bookingOptions.length;
            
            const extractedData = extractFlightDataFromResponse(htmlContent, 'sky');
            mergeFlightData(flightData, extractedData);
            
            // Calculate new entities added after merging
            const newBundles = flightData.bundles.length - bundlesBefore;
            const newFlights = flightData.flights.length - flightsBefore;
            const newBookingOptions = flightData.bookingOptions.length - bookingOptionsBefore;
            
            // Log only the new entities added
            if (newBundles > 0 || newFlights > 0 || newBookingOptions > 0) {
              logger.info(LogCategory.SCRAPING, `📈 Poll ${pollCount}: +${newBundles} bundles, +${newFlights} flights, +${newBookingOptions} options`);
            }
          } else {
            logger.debug(LogCategory.SCRAPING, `⏭️ Poll ${pollCount}: No new results`);
          }
          
          // Update the previous results count
          previousResultsCount = currentResultsCount;

          // Check if this is the last response
          if (isLastResponse) {
            logger.info(LogCategory.SCRAPING, `🏁 Sky polling completed`);
            return flightData;
          }

          pollSuccess = true;
        } else if (
          htmlContent.includes("No flights found") ||
          htmlContent.includes("No results")
        ) {
          logger.info(LogCategory.SCRAPING, `❌ No flights found`);
          return flightData;
        } else {
          // Still processing, wait and retry
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          retryCount++;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logger.warn(
          LogCategory.SCRAPING,
          `⚠️ Poll ${pollCount} failed: ${errorMessage}`
        );

        // If it's a network error, wait a bit longer before retrying
        if (
          errorMessage.includes("fetch") ||
          errorMessage.includes("network") ||
          errorMessage.includes("timeout")
        ) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval * 2));
        }

        retryCount++;
      }
    }

    if (!pollSuccess) {
      failedPolls++;
      logger.warn(LogCategory.SCRAPING, `⚠️ Poll ${pollCount} failed after ${maxRetries} retries`);
      
      if (failedPolls >= 3) {
        logger.error(LogCategory.SCRAPING, `❌ Too many failed polls, stopping`);
        break;
      }
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  logger.info(LogCategory.SCRAPING, `🏁 Sky polling ended: ${pollCount} attempts, ${failedPolls} failed`);
  return flightData;
} 