/// <reference lib="dom" />
import { Page } from 'playwright';
import { DetailedFlightResult, Portal, ScrapingRequest } from '../types';
import { logInfo, logError, logSuccess, logWarn } from './helpers';
import { monitorSearchProgress, extractExpectedResultsCount } from './searchMonitor';
import { scrapeAllPages } from './pageScraper';
import { constructKiwiUrl, constructSkyUrl } from './urlConstructors';
import { mergeFlights } from './resultManager';

/**
 * Scrape flight data from a specific portal
 */
export async function scrapePortal(page: Page, portal: Portal, log: any): Promise<{ allFlights: DetailedFlightResult[], expectedResults: number }> {
  const allFlights: DetailedFlightResult[] = [];
  let expectedResults = 0;

  try {
    await waitForResultsPage(page, portal, log);
    
    await monitorSearchProgress(
      page, 
      portal, 
      log,
      // onPartialResults callback
      async (partialCount: number) => {
        const partialFlights = await scrapeAllPages(page, portal, log);
        // Merge partial flights with existing results (avoiding duplicates)
        const mergedFlights = mergeFlights(allFlights, partialFlights);
        allFlights.length = 0; // Clear array
        allFlights.push(...mergedFlights); // Add merged results
        logInfo(`✅ Partial scraping: Found ${partialFlights.length} flights, total unique: ${allFlights.length}`, log, portal);
      },
      // onFinalResults callback
      async (finalCount: number) => {
        const finalFlights = await scrapeAllPages(page, portal, log);
        // Merge final flights with existing results (avoiding duplicates)
        const mergedFlights = mergeFlights(allFlights, finalFlights);
        const newFlightsCount = mergedFlights.length - allFlights.length;
        
        allFlights.length = 0; // Clear array
        allFlights.push(...mergedFlights); // Add merged results
        
        logInfo(`✅ Final scraping: Found ${finalFlights.length} flights, added ${newFlightsCount} new unique flights, total: ${allFlights.length}`, log, portal);
      }
    );

    expectedResults = await extractExpectedResultsCount(page, portal, log);
    await logScrapingResults(allFlights, expectedResults, portal, log);

  } catch (error) {
    logError(`❌ Error during scraping: ${error instanceof Error ? error.message : JSON.stringify(error)}`, log, portal);
    throw error;
  }

  return { allFlights, expectedResults };
}

/**
 * Wait for the results page to load
 */
async function waitForResultsPage(page: Page, portal: Portal, log: any): Promise<void> {
  await page.waitForSelector('#found_zone', { timeout: 120000 });
  logInfo(`✅ Results page loaded successfully`, log, portal);
}

/**
 * Log final scraping results and check for partial success
 */
async function logScrapingResults(
  allFlights: DetailedFlightResult[], 
  expectedResults: number, 
  portal: Portal, 
  log: any
): Promise<void> {
  logSuccess(`🎉 Completed scraping ${allFlights.length} unique flights`, log, portal);
  
  // Check for partial success
  if (allFlights.length > 0 && allFlights.length < expectedResults) {
    logWarn(`⚠️ Partial success: Got ${allFlights.length}/${expectedResults} expected flights`, log, portal);
  }
}

// Re-export URL construction functions for backward compatibility
export { constructKiwiUrl, constructSkyUrl };