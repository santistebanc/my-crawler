import { Portal } from "./types";
import {
  FlightData,
  extractAirportCode,
  generateId,
  createBundleIdFromFlightIds,
  createDatetimeForId,
  createBookingOptionId,
} from "./entities";
import * as cheerio from "cheerio";
import airportsDataRaw from "./airports.json";
import {
  createTimezonedDatetime,
  parseDateString,
  addDaysToDateString,
  mergeFlightData,
} from "./helpers";

// Use the .data property for lookups
const airportsData = airportsDataRaw.data;

// Define BookingOption type at the top level so it is not inferred as never
export type BookingOption = { agency: string; price: string; link: string };

/**
 * Extracts flight data from HTML response
 */
export function extractFlightDataFromResponse(
  htmlData: string,
  portal: Portal
): FlightData {
  try {
    if (!htmlData || htmlData.length === 0) {
      console.warn(`⚠️ Empty HTML data received from ${portal} portal`);
      return { bundles: [], flights: [], bookingOptions: [] };
    }

    const $ = cheerio.load(htmlData);
    const flightData: FlightData = {
      bundles: [],
      flights: [],
      bookingOptions: [],
    };

    const listItems = $(".list-item.row");
    console.info(
      `🔍 Found ${listItems.length} list items to process from ${portal} portal`
    );

    let successfulExtractions = 0;
    let failedExtractions = 0;

    listItems.each((i: number, el: any) => {
      try {
        const bundleData = extractBundleFromListItem($(el), portal, $);
        if (bundleData) {
          mergeFlightData(flightData, bundleData);
          successfulExtractions++;
        } else {
          failedExtractions++;
        }
      } catch (err) {
        console.warn(`⚠️ Error extracting bundle from list item ${i + 1}:`, err);
        failedExtractions++;
      }
    });

    console.info(
      `✅ ${portal} portal extraction complete: ${successfulExtractions} successful, ${failedExtractions} failed`
    );
    console.info(
      `📊 Extracted: ${flightData.bundles.length} bundles, ${flightData.flights.length} flights`
    );

    return flightData;
  } catch (error) {
    console.error(`❌ Error extracting flight data from ${portal}:`, error);
    return { bundles: [], flights: [], bookingOptions: [] };
  }
}

/**
 * Extracts bundle data from a list item element
 */
function extractBundleFromListItem(
  $item: cheerio.Cheerio<any>,
  portal: Portal,
  $: cheerio.CheerioAPI
): FlightData | null {
  try {
    const flightData: FlightData = {
      bundles: [],
      flights: [],
      bookingOptions: [],
    };

    // Bundle name and airline from the main item
    const airline = $item.find(".airlines-name").first().text().trim();

    // Price from the main item
    const price = $item.find(".prices").first().text().trim();
    const currencyMatch = price.match(/[€$£¥₹]/);
    const currency = currencyMatch ? currencyMatch[0] : "EUR";

    // Modal extraction for flights and booking options
    const modal = $item.find(".modal").first();
    const flightIds: string[] = [];
    // Booking options
    const bookingOptions: BookingOption[] = [];

    // Extract departure date from ._heading element
    let departureDate = "";
    const headingElement = modal.find("._heading").first();
    if (headingElement.length) {
      const headingText = headingElement.text().trim();
      // Extract date from format like "Outbound Fri, 10 Oct 2025 All times are local"
      const dateMatch = headingText.match(
        /(?:Outbound|Inbound)\s+([A-Za-z]{3},\s+\d+\s+[A-Za-z]{3}\s+\d{4})/
      );
      if (dateMatch) {
        departureDate = dateMatch[1];
      }
    }

    if (modal.length) {
      // Flights (previously segments)
      let currentDateOffset = 0; // Track days offset from base departure date

      modal.find("._panel_body").each((i: number, seg: any) => {
        const flightNumberFull = $(seg).find("small").first().text().trim();
        const item = $(seg).find("._item").first();
        const times = item.find(".c3 p");
        const airports = item.find(".c4 p");
        const flightDepartureTime = times.eq(0).text().trim();
        const flightArrivalTime = times.eq(1).text().trim();
        const flightDepartureAirport = airports.eq(0).text().trim();
        const flightArrivalAirport = airports.eq(1).text().trim();

        // Check if arrival time has +1 indicator (next day)
        const hasNextDayArrival = flightArrivalTime.includes("+1");
        const cleanArrivalTime = flightArrivalTime.replace(/\+\d+/, "").trim();

        if (flightNumberFull) {
          let flightNumber = null;
          const parts = flightNumberFull.split(" ");
          if (portal === "sky") {
            flightNumber = parts[parts.length - 1];
          } else {
            const airlineCode = parts[parts.length - 2];
            const flightNum = parts[parts.length - 1];
            flightNumber = airlineCode + flightNum;
          }

          // Extract airport codes
          const depAirportCode = extractAirportCode(flightDepartureAirport);
          const arrAirportCode = extractAirportCode(flightArrivalAirport);

          // Get timezone information for airports
          const depTimezone = (airportsData as any)[depAirportCode]?.timezone;
          const arrTimezone = (airportsData as any)[arrAirportCode]?.timezone;

          if (!depTimezone) {
            throw new Error(
              `No timezone found for departure airport: ${depAirportCode}`
            );
          }
          if (!arrTimezone) {
            throw new Error(
              `No timezone found for arrival airport: ${arrAirportCode}`
            );
          }

          // Calculate flight date (may be offset from base departure date)
          let flightDate = departureDate;
          if (currentDateOffset > 0 && departureDate) {
            flightDate = addDaysToDateString(departureDate, currentDateOffset);
          }

          // Calculate arrival date for this flight (may be next day)
          let flightArrivalDate = flightDate;
          if (hasNextDayArrival && flightDate) {
            flightArrivalDate = addDaysToDateString(flightDate, 1);
            currentDateOffset++; // Increment for next flight
          }

          // Format flight times with timezone information
          const formattedFlightDeparture = createTimezonedDatetime(
            flightDate,
            flightDepartureTime,
            depTimezone
          );
          const formattedFlightArrival = createTimezonedDatetime(
            flightArrivalDate,
            cleanArrivalTime,
            arrTimezone
          );

          // Create departure datetime for ID (without timezone)
          const departureDatetimeForId = createDatetimeForId(
            flightDate,
            flightDepartureTime
          );

          // Create flight object
          const flightId = generateId(
            "flight",
            `${flightNumber}-${depAirportCode}-${arrAirportCode}-${departureDatetimeForId}`
          );

          const flight = {
            uniqueId: flightId,
            flightNumber,
            departure: formattedFlightDeparture,
            arrival: formattedFlightArrival,
            from: depAirportCode,
            to: arrAirportCode,
          };

          flightData.flights.push(flight);
          flightIds.push(flightId);
        }
      });

      // Extract booking options
      const bookingOptionsFound = modal.find("._similar > div");

      bookingOptionsFound.each((i: number, option: any) => {
        const agency = $(option).find("p").eq(0).text().trim();
        const optionPriceRaw = $(option)
          .find("p")
          .eq(1)
          .clone()
          .children("a")
          .remove()
          .end()
          .text()
          .trim();
        const optionPrice = optionPriceRaw
          .replace(/[^\d.,]/g, "")
          .replace(",", ".");
        const link = $(option).find("a").attr("href") || "";

        if (agency && optionPrice && link) {
          bookingOptions.push({
            agency,
            price: optionPrice,
            link,
          });
        }
      });
    }

    // Create bundle object
    const bundleId = createBundleIdFromFlightIds(flightIds);

    const bundle = {
      uniqueId: bundleId,
      flightIds,
    };

    flightData.bundles.push(bundle);

    // Create booking options for this bundle
    bookingOptions.forEach((option) => {
      const bookingOptionId = createBookingOptionId(
        option.link,
        option.agency,
        bundleId
      );
      const bookingOption = {
        uniqueId: bookingOptionId,
        targetId: bundleId,
        agency: option.agency,
        price: option.price,
        link: option.link,
        currency,
        extractedAt: new Date().toISOString(),
      };
      flightData.bookingOptions.push(bookingOption);
    });

    return flightData;
  } catch (error) {
    console.warn(`⚠️ Error extracting bundle from list item:`, error);
    return null;
  }
}
