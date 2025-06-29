import { Page } from 'playwright';
import { DetailedFlightResult, Portal } from '../types';
import { logInfo, logWarn } from './helpers';
import { extractFlightsFromModals } from './extractFlightsFromModals';

/**
 * Scrape all available pages for a portal
 */
export async function scrapeAllPages(page: Page, portal: Portal, log: any): Promise<DetailedFlightResult[]> {
  const allFlights: DetailedFlightResult[] = [];
  const totalPages = await getTotalPages(page, portal, log);

  // Scrape all pages
  for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
    logInfo(`📄 Scraping page ${currentPage}`, log, portal);
    
    if (currentPage > 1) {
      await navigateToPage(page, currentPage);
    }
    
    // Extract flights from current page
    const pageFlights = await extractFlightsFromModals(page, portal, log);
    allFlights.push(...pageFlights);
    logInfo(`✅ Page ${currentPage}: Found ${pageFlights.length} flights`, log, portal);
  }

  return allFlights;
}

/**
 * Get total number of pages from pagination
 */
async function getTotalPages(page: Page, portal: Portal, log: any): Promise<number> {
  let totalPages = 1;
  try {
    const pageNumbers = await page.$$eval('.jplist-pagination a.page-link', links =>
      links.map(link => parseInt(link.textContent || '', 10)).filter(n => !isNaN(n))
    );
    if (pageNumbers.length > 0) {
      totalPages = Math.max(...pageNumbers);
    }
    logInfo(`📊 Detected ${totalPages} total pages in pagination`, log, portal);
  } catch (e) {
    logWarn(`⚠️ Could not determine total pages, defaulting to 1`, log, portal);
  }
  return totalPages;
}

/**
 * Navigate to a specific page number
 */
async function navigateToPage(page: Page, pageNumber: number): Promise<void> {
  // Click the page number link for the current page
  const pageLinkSelector = `.jplist-pagination a.page-link:text-is('${pageNumber}')`;
  await page.click(pageLinkSelector);
  // Wait for flight panels to load
  await page.waitForSelector('._panel', { timeout: 15000, state: 'attached' });
} 