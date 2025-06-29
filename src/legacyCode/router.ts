import { createPlaywrightRouter } from '@crawlee/playwright';
import { Page } from 'playwright';
import { DetailedFlightResult, Portal } from '../types';
import { scrapePortal } from './scraper';

// Global state for storing flights and expected results
let globalFlights: DetailedFlightResult[] = [];
let globalExpectedResults = 0;

// Create the router for the crawler
const router = createPlaywrightRouter();

router.addDefaultHandler(async ({ page, request, log }) => {
  try {
    // Determine portal from the URL
    const url = request.url;
    let portal: Portal;
    
    if (url.includes('/portal/kiwi')) {
      portal = 'kiwi';
    } else if (url.includes('/portal/sky')) {
      portal = 'sky';
    } else {
      // Fallback to kiwi if we can't determine the portal
      portal = 'kiwi';
      log.info(`⚠️ Could not determine portal from URL, defaulting to kiwi: ${url}`);
    }
    
    log.info(`🚀 Starting scrape for ${portal.toUpperCase()} portal: ${request.url}`);
    
    // Extract flight results from the specific structure
    const { allFlights, expectedResults } = await scrapePortal(page, portal, log);
    
    // Add the flights from this portal to the main flights array
    globalFlights.push(...allFlights);
    globalExpectedResults += expectedResults;
    log.info(`✅ [${portal.toUpperCase()}] Added ${allFlights.length} flights to results (expected: ${expectedResults})`);
  } catch (error) {
    // Try to determine portal for error logging
    const url = request.url;
    let portal: Portal = 'kiwi';
    if (url.includes('/portal/sky')) {
      portal = 'sky';
    }
    
    log.error(`❌ [${portal.toUpperCase()}] Error during scraping: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    if (error instanceof Error && error.stack) {
      log.error(`❌ [${portal.toUpperCase()}] Stack trace: ${error.stack}`);
    }
  }
});

/**
 * Get the current global flights array
 */
export function getGlobalFlights(): DetailedFlightResult[] {
  return globalFlights;
}

/**
 * Get the current global expected results count
 */
export function getGlobalExpectedResults(): number {
  return globalExpectedResults;
}

/**
 * Reset the global state
 */
export function resetGlobalState(): void {
  globalFlights = [];
  globalExpectedResults = 0;
}

/**
 * Export the router for use in the crawler
 */
export { router }; 