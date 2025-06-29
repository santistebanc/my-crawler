import { PlaywrightCrawler } from '@crawlee/playwright';
import { ScrapingRequest, ScrapingResponse } from '../types';
import { router, getGlobalFlights, getGlobalExpectedResults, resetGlobalState } from './router';
import { constructKiwiUrl, constructSkyUrl } from './scraper';

/**
 * Main function to scrape flights using Crawlee
 */
export async function scrapeFlights(request: ScrapingRequest): Promise<ScrapingResponse> {
  const startTime = Date.now();
  
  try {
    console.log(`🚀 Starting flight scraping with parameters:`, {
      originplace: request.originplace,
      destinationplace: request.destinationplace,
      outbounddate: request.outbounddate,
      portals: request.portals
    });

    // Reset global state
    resetGlobalState();

    // Determine which URLs to use based on portal settings
    const urlsToScrape: string[] = [];
    
    if (request.portals?.kiwi) {
      const kiwiUrl = constructKiwiUrl(request);
      urlsToScrape.push(kiwiUrl);
      console.log(`🔗 Kiwi URL: ${kiwiUrl}`);
    }
    
    if (request.portals?.sky) {
      const skyUrl = constructSkyUrl(request);
      urlsToScrape.push(skyUrl);
      console.log(`🔗 Sky URL: ${skyUrl}`);
    }

    if (urlsToScrape.length === 0) {
      throw new Error('No portals selected for scraping');
    }
    
    console.log(`🔗 Total URLs to scrape: ${urlsToScrape.length}`);

    // Create and run the crawler
    const crawler = new PlaywrightCrawler({
      requestHandler: router,
      headless: true,
      maxRequestRetries: 2,
      requestHandlerTimeoutSecs: 300, // 5 minutes per request
      maxRequestsPerCrawl: 50, // Allow up to 50 requests to handle pagination and multiple portals
      maxConcurrency: 2, // Process both portals in parallel
      browserPoolOptions: {
        useFingerprints: false
      },
      // Ensure parallel processing
      autoscaledPoolOptions: {
        maxConcurrency: 2,
        minConcurrency: 2
      }
    });

    console.log(`🕷️ Starting crawler with ${urlsToScrape.length} URLs in parallel`);
    await crawler.run(urlsToScrape);

    // Get results from global state
    const flights = getGlobalFlights();
    const expectedResults = getGlobalExpectedResults();
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`✅ Scraping completed in ${duration}ms`);
    console.log(`📊 Results: ${flights.length} flights found (expected: ${expectedResults})`);

    // Determine success status
    let success = true;

    if (flights.length === 0) {
      success = false;
    } else if (flights.length < expectedResults) {
      console.warn(`⚠️ Partial success: Got ${flights.length}/${expectedResults} expected flights`);
    }

    return {
      success,
      data: {
        flights,
        searchParams: request,
        scrapedAt: new Date().toISOString()
      }
    };

  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error(`❌ Scraping failed after ${duration}ms: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    
    return {
      success: false,
      error: `Scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}