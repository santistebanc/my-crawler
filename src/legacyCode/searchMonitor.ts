import { Page } from 'playwright';
import { Portal } from '../types';
import { logInfo, logWarn } from './helpers';

interface SearchProgress {
  hasStartedScraping: boolean;
  lastScrapedCount: number;
  lastLoggedText: string;
  attempts: number;
}

/**
 * Monitor search progress and handle partial/final results
 */
export async function monitorSearchProgress(
  page: Page, 
  portal: Portal, 
  log: any,
  onPartialResults: (count: number) => Promise<void>,
  onFinalResults: (count: number) => Promise<void>
): Promise<void> {
  const progress: SearchProgress = {
    hasStartedScraping: false,
    lastScrapedCount: 0,
    lastLoggedText: '',
    attempts: 0
  };

  const maxAttempts = 240; // 120 seconds with 500ms intervals

  try {
    while (progress.attempts < maxAttempts) {
      const currentText = await getFoundZoneText(page);
      
      // Log text changes
      if (currentText !== progress.lastLoggedText) {
        logInfo(`⏳ Still searching... (${currentText})`, log, portal);
        progress.lastLoggedText = currentText;
      }
      
      // Check if we can start scraping partial results
      const partialMatch = currentText.match(/Searching \(found (\d+)\)/);
      if (partialMatch && !progress.hasStartedScraping) {
        const partialCount = parseInt(partialMatch[1], 10);
        logInfo(`🚀 Starting partial scraping with ${partialCount} results`, log, portal);
        
        await onPartialResults(partialCount);
        progress.lastScrapedCount = partialCount;
        progress.hasStartedScraping = true;
      }
      
      // Check if search is complete
      const finalMatch = currentText.match(/Found:\s*(\d+)\s*Results/i);
      if (finalMatch) {
        const finalCount = parseInt(finalMatch[1], 10);
        logInfo(`✅ Search completed: ${currentText}`, log, portal);
        
        // If we haven't scraped yet or the count changed, scrape again
        if (!progress.hasStartedScraping || finalCount !== progress.lastScrapedCount) {
          logInfo(`🔄 Final scraping with ${finalCount} results`, log, portal);
          await onFinalResults(finalCount);
        }
        
        break;
      }
      
      // Check if still searching
      if (currentText.includes('Searching...')) {
        await page.waitForTimeout(500);
        progress.attempts++;
        continue;
      }
      
      // If we get here, the text has changed but doesn't match our expected patterns
      // Wait a bit more to see if it resolves
      await page.waitForTimeout(500);
      progress.attempts++;
    }
    
    if (progress.attempts >= maxAttempts) {
      const foundZoneText = await getFoundZoneText(page);
      logWarn(`⚠️ Timeout waiting for search to complete. Last text: ${foundZoneText}`, log, portal);
    }
    
  } catch (error) {
    const foundZoneText = await getFoundZoneText(page);
    logWarn(`⚠️ Error monitoring search progress. Last text: ${foundZoneText}`, log, portal);
  }
}

/**
 * Get the text content from the found zone element
 */
async function getFoundZoneText(page: Page): Promise<string> {
  const foundZoneText = await page.textContent('#found_zone');
  return foundZoneText?.trim() || '';
}

/**
 * Extract expected results count from found zone text
 */
export async function extractExpectedResultsCount(page: Page, portal: Portal, log: any): Promise<number> {
  const foundZoneText = await getFoundZoneText(page);
  if (foundZoneText) {
    const match = foundZoneText.match(/Found:\s*(\d+)\s*Results/i);
    if (match) {
      const expectedResults = parseInt(match[1], 10);
      logInfo(`📊 Expected ${expectedResults} results`, log, portal);
      return expectedResults;
    }
  }
  return 0;
} 