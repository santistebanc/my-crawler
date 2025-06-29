import { Page } from 'playwright';
import { DetailedFlightResult, Portal } from '../types';
import { logWarn, logInfo } from './helpers';
import { assignIdsToFlights } from './resultManager';

/**
 * Extract flight data from all modals on the page
 */
export async function extractFlightsFromModals(page: Page, portal: Portal, log: any): Promise<DetailedFlightResult[]> {
  // Select all .modal elements except #myModalX
  const modalHandles = await page.$$('.modal:not(#myModalX)');
  const flights: DetailedFlightResult[] = [];

  for (const modal of modalHandles) {
    try {
      // Extract data from .search_modal inside the modal
      const searchModal = await modal.$('.search_modal');
      if (!searchModal) continue;

      // Extract airline name from ._ahn
      const airline = await searchModal.$eval('._ahn', el => el.textContent?.trim() || '').catch(() => '');
      
      // Extract flight name (airline combination) from ._flight_name
      const flightName = await searchModal.$eval('._flight_name', el => el.textContent?.trim() || '').catch(() => '');
      
      // Extract headings (Outbound date, Book Your Ticket, etc.)
      const headings = await searchModal.$$eval('._heading', els => els.map(el => el.textContent?.trim() || '')).catch(() => []);
      
      // Extract booking options from ._similar divs
      const bookingOptions = await searchModal.$$eval('._similar > div', divs => divs.map(div => {
        const agency = div.querySelector('p')?.textContent?.trim() || '';
        const priceElement = div.querySelector('p + p');
        const price = priceElement?.childNodes[0]?.textContent?.trim() || '';
        const link = div.querySelector('a')?.getAttribute('href') || '';
        return { agency, price, link };
      })).catch(() => []);

      // Extract flight segments from ._panel_body
      const segments = await searchModal.$$eval('._panel_body', bodies => bodies.map(body => {
        const flightNumber = body.querySelector('._head small')?.textContent?.trim() || '';
        const duration = body.querySelector('.c1 p')?.textContent?.trim() || '';
        const departureTime = body.querySelector('.c3 p:first-child')?.textContent?.trim() || '';
        const arrivalTime = body.querySelector('.c3 p:last-child')?.textContent?.trim() || '';
        const departureAirport = body.querySelector('.c4 p:first-child')?.textContent?.trim() || '';
        const arrivalAirport = body.querySelector('.c4 p:last-child')?.textContent?.trim() || '';
        const connection = body.querySelector('.connect_airport')?.textContent?.trim() || '';
        const summary = body.querySelector('._summary')?.textContent?.trim() || '';
        
        return {
          flightNumber,
          duration,
          departureTime,
          arrivalTime,
          departureAirport,
          arrivalAirport,
          connection,
          summary
        };
      })).catch(() => []);

      // Extract trip summary from .trip
      const tripSummary = await searchModal.$eval('.trip', trip => {
        const departureTime = trip.querySelector('.time:first-child')?.textContent?.trim() || '';
        const arrivalTime = trip.querySelector('.time:last-child')?.textContent?.trim() || '';
        const duration = trip.querySelector('._stops .time')?.textContent?.trim() || '';
        const stops = trip.querySelector('.stop')?.textContent?.trim() || '';
        
        return {
          departureTime,
          arrivalTime,
          duration,
          stops
        };
      }).catch(() => ({
        departureTime: '',
        arrivalTime: '',
        duration: '',
        stops: ''
      }));

      // Compose the result
      flights.push({
        airline,
        flightName,
        headings,
        bookingOptions,
        segments,
        tripSummary,
        portal
      } as DetailedFlightResult);
    } catch (e) {
      logWarn(`⚠️ Could not extract flight info from modal: ${e}`, log, portal);
    }
  }

  // Assign IDs to all flights
  const flightsWithIds = assignIdsToFlights(flights, portal);
  
  logInfo(`🔍 Found ${flightsWithIds.length} flights in modals`, log, portal);
  return flightsWithIds;
} 