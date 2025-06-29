import { Portal } from "./types";
import { FlightData } from "./entities";
import { HttpsProxyAgent } from "https-proxy-agent";
import {
  RequestParams,
  ExtractedData,
} from "./fetchPageAndExtractData";
import { buildPortalUrl, extractSessionCookie } from "./helpers";
import { extractFlightDataFromResponse } from "./extractFlightDataFromResponse";
import { mergeFlightData } from "./helpers";

// Configure proxy
const proxyUrl =
  "http://groups-BUYPROXIES94952:apify_proxy_KIf2EQ6nvU4hmZKYyZ4eneVanvLoKz0cg6yN@proxy.apify.com:8000";
const proxyAgent = new HttpsProxyAgent(proxyUrl);

// Extend RequestInit to include agent property
interface RequestInitWithAgent extends RequestInit {
  agent?: any;
}

export async function pollForFlightData(
  portal: Portal,
  pageData: ExtractedData,
  requestParams: RequestParams
): Promise<FlightData> {
  const baseUrl = `https://www.flightsfinder.com/portal/${portal}/poll`;
  console.info(`🚀 Starting polling for ${portal} portal at ${baseUrl}`);

  // Construct the referer URL using helper
  const refererUrl = buildPortalUrl(portal, requestParams);

  let pollCount = 0;
  let failedPolls = 0;
  const maxPolls = 10; // Prevent infinite polling
  const maxRetries = 3; // Max retries per failed poll
  const pollInterval = 100; // 100ms as specified
  const maxPollingTime = 30000; // 30 seconds maximum polling time
  const startTime = Date.now();

  console.info(`📋 Polling configuration: maxPolls=${maxPolls}, maxRetries=${maxRetries}, pollInterval=${pollInterval}ms, maxPollingTime=${maxPollingTime}ms`);

  // Initialize flight data structure
  const flightData: FlightData = {
    deals: [],
    flights: [],
  };

  let currentCookie = pageData.cookie; // Start with initial cookie
  let currentPageData = pageData; // Keep track of current page data

  console.info(`🍪 Initial cookie: ${currentCookie.substring(0, 50)}...`);

  while (pollCount < maxPolls) {
    // Check if we've exceeded the maximum polling time
    if (Date.now() - startTime > maxPollingTime) {
      console.warn(`⏰ Polling timeout reached after ${Date.now() - startTime}ms`);
      break;
    }

    pollCount++;
    console.info(`🔄 Poll attempt ${pollCount}/${maxPolls} (${Date.now() - startTime}ms elapsed)`);

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

        console.info(`📤 Sending poll request ${pollCount}.${retryCount + 1}`);

        const response = await fetch(baseUrl, {
          method: "POST",
          headers,
          body: formData,
          agent: proxyAgent,
        } as RequestInitWithAgent);

        console.info(`📥 Poll response: status=${response.status}, headers=${response.headers.get('content-type')}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const htmlData = await response.text();

        // Parse the pipe-delimited response format
        const responseParts = htmlData.split('|');
        
        if (responseParts.length < 7) {
          console.warn(`⚠️ Invalid response format: expected at least 7 parts, got ${responseParts.length}`);
          retryCount++;
          continue;
        }

        const isLastResponse = responseParts[0] === 'Y';
        const totalResultsExpected = parseInt(responseParts[1], 10) || 0;
        const htmlContent = responseParts[6];

        console.info(`📊 Poll status: ${responseParts[0]} (${isLastResponse ? 'LAST' : 'MORE'}) data, expected total: ${totalResultsExpected}`);
        console.info(`📄 HTML content length: ${htmlContent.length} characters`);

        // Extract updated session cookie from response
        const setCookieHeader = response.headers.get("set-cookie");
        const newCookie = extractSessionCookie(setCookieHeader);
        if (newCookie && newCookie !== currentCookie) {
          console.info(`🍪 New cookie: ${newCookie.substring(0, 50)}...`);
          currentCookie = newCookie;
        } else if (newCookie) {
          console.info(`🍪 Cookie unchanged: ${currentCookie.length} characters`);
        } else {
          console.info(`🍪 No new cookie in response`);
        }

        // Check if we have flight data in the HTML content
        if (htmlContent.includes("list-item row")) {
          console.info(`✅ Found flight data in response`);
          
          // Track current entity counts before extraction
          const dealsBefore = flightData.deals.length;
          const flightsBefore = flightData.flights.length;
          
          const extractedData = extractFlightDataFromResponse(htmlContent, portal);
          mergeFlightData(flightData, extractedData);
          
          // Calculate new entities added after merging
          const newDeals = flightData.deals.length - dealsBefore;
          const newFlights = flightData.flights.length - flightsBefore;
          
          // Log only the new entities added
          if (newDeals > 0 || newFlights > 0) {
            console.info(`📈 Poll ${pollCount} added: ${newDeals} deals, ${newFlights} flights`);
          } else {
            console.info(`📊 Poll ${pollCount}: No new entities added`);
          }

          // Check if this is the last response
          if (isLastResponse) {
            console.info(`🏁 Last response received (Y), stopping polling`);
            return flightData;
          }

          pollSuccess = true;
        } else if (
          htmlContent.includes("No flights found") ||
          htmlContent.includes("No results")
        ) {
          console.info(`❌ No flights found in response`);
          return flightData;
        } else {
          // Still processing, wait and retry
          console.info(`⏳ Still processing, waiting ${pollInterval}ms before retry`);
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          retryCount++;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.warn(
          `⚠️ Poll ${pollCount} attempt ${
            retryCount + 1
          } failed: ${errorMessage}`
        );

        // If it's a network error, wait a bit longer before retrying
        if (
          errorMessage.includes("fetch") ||
          errorMessage.includes("network")
        ) {
          console.info(`🌐 Network error detected, waiting 1000ms before retry`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        retryCount++;
        failedPolls++;

        if (failedPolls > 10) {
          console.error(`❌ Too many failed polls (${failedPolls}), stopping polling`);
          return flightData;
        }
      }
    }

    if (!pollSuccess) {
      console.warn(`⚠️ Poll ${pollCount} failed after ${maxRetries} retries`);
    }
  }

  console.info(`🏁 Polling completed: ${pollCount} attempts, ${failedPolls} failed`);
  console.info(`📊 Final results: ${flightData.deals.length} deals, ${flightData.flights.length} flights`);
  
  return flightData;
}
