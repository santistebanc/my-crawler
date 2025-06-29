import { Portal } from '../types';
import * as cheerio from 'cheerio';
import { buildPortalUrl } from '../helpers';

interface RequestParams {
  adults: number;
  children: number;
  infants: number;
  currency: string;
  originplace?: string;
  destinationplace?: string;
  outbounddate?: string;
  inbounddate?: string;
  cabinclass?: string;
}

interface ScriptExtractedData {
  _token: string;
  session: string;
  suuid: string;
  deeplink: string;
}

interface ExtractedData extends ScriptExtractedData {
  cookie: string;
}

// API Surface - Main function that users call
export async function fetchFlightData(
  portal: Portal,
  requestParams: RequestParams
): Promise<any[]> {
  // First, fetch the page to get session data and extract required parameters
  const pageData = await fetchPageAndExtractData(portal, requestParams);
  
  if (!pageData) {
    throw new Error(`Failed to extract session data from page for portal: ${portal}`);
  }

  // Now use the extracted data for polling
  return await pollForFlightData(portal, pageData, requestParams);
}

// Implementation Details - Functions called by fetchFlightData
async function fetchPageAndExtractData(portal: Portal, requestParams: RequestParams): Promise<ExtractedData | null> {
  // Construct the page URL using helper
  const pageUrl = buildPortalUrl(portal, requestParams);
  
  console.log(`🌐 Fetching page for ${portal} portal...`);
  
  try {
    const response = await fetch(pageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    
    // Extract session cookie
    const setCookieHeader = response.headers.get('set-cookie');
    let sessionCookie = '';
    
    if (setCookieHeader) {
      const cookies = setCookieHeader.split(',').map(cookie => cookie.trim());
      for (const cookie of cookies) {
        if (cookie.startsWith('flightsfinder_session=')) {
          sessionCookie = cookie.split(';')[0];
          console.log(`🍪 Found session cookie for ${portal}`);
          break;
        }
      }
    }

    // Extract data from script tag
    const extractedData = extractDataFromScript(html);
    
    if (!extractedData) {
      console.error(`❌ Failed to extract data from script tag for ${portal}`);
      return null;
    }

    console.log(`✅ Extracted session data for ${portal} portal`);
    
    // Always return an ExtractedData object with a cookie property
    return {
      _token: extractedData._token,
      session: extractedData.session,
      suuid: extractedData.suuid,
      deeplink: extractedData.deeplink,
      cookie: sessionCookie || ''
    };

  } catch (error) {
    console.error(`❌ Error fetching page for ${portal}:`, error);
    return null;
  }
}

async function pollForFlightData(portal: Portal, pageData: ExtractedData, requestParams: RequestParams): Promise<any[]> {
  const baseUrl = `https://www.flightsfinder.com/portal/${portal}/poll`;
  
  // Construct the referer URL using helper
  const refererUrl = buildPortalUrl(portal, requestParams);
  
  const headers = {
    'accept': '*/*',
    'accept-language': 'en-GB,en;q=0.7',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'origin': 'https://www.flightsfinder.com',
    'priority': 'u=1, i',
    'referer': refererUrl,
    'sec-ch-ua': '"Brave";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'sec-gpc': '1',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    'x-requested-with': 'XMLHttpRequest',
    'cookie': pageData.cookie
  };

  // Construct form-encoded body data using extracted page data
  const formData = new URLSearchParams({
    '_token': pageData._token,
    'session': pageData.session,
    'suuid': pageData.suuid,
    'noc': Date.now().toString(),
    'deeplink': pageData.deeplink,
    's': 'www',
    'adults': requestParams.adults.toString(),
    'children': requestParams.children.toString(),
    'infants': requestParams.infants.toString(),
    'currency': requestParams.currency
  });

  console.log(`🚀 Making POST request to ${baseUrl} for portal: ${portal}`);

  let pollCount = 0;
  let failedPolls = 0;
  const maxPolls = 100; // Prevent infinite polling
  const maxRetries = 3; // Max retries per failed poll
  const pollInterval = 100; // 100ms as specified
  let allExtractedFlights: any[] = [];
  let currentCookie = pageData.cookie; // Start with initial cookie

  while (pollCount < maxPolls) {
    pollCount++;
    console.log(`🔄 Poll request ${pollCount}...`);

    let retryCount = 0;
    let pollSuccess = false;

    while (retryCount < maxRetries && !pollSuccess) {
      try {
        // Update noc with fresh timestamp for each poll request
        const updatedFormData = new URLSearchParams({
          '_token': pageData._token,
          'session': pageData.session,
          'suuid': pageData.suuid,
          'noc': Date.now().toString(),
          'deeplink': pageData.deeplink,
          's': 'www',
          'adults': requestParams.adults.toString(),
          'children': requestParams.children.toString(),
          'infants': requestParams.infants.toString(),
          'currency': requestParams.currency
        });

        // Update headers with current cookie
        const updatedHeaders = {
          ...headers,
          'cookie': currentCookie
        };

        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: updatedHeaders,
          body: updatedFormData.toString()
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Extract new session cookie from response
        const setCookieHeader = response.headers.get('set-cookie');
        if (setCookieHeader) {
          const cookies = setCookieHeader.split(',').map(cookie => cookie.trim());
          for (const cookie of cookies) {
            if (cookie.startsWith('flightsfinder_session=')) {
              currentCookie = cookie.split(';')[0];
              console.log(`🍪 Updated session cookie for ${portal} (poll ${pollCount})`);
              break;
            }
          }
        }

        const responseText = await response.text();

        // Split response by '|' character
        const responseParts = responseText.split('|');
        
        if (responseParts.length < 2) {
          throw new Error('Invalid response format');
        }

        const status = responseParts[0];
        const htmlData = responseParts[6]; // 7th item (index 6) contains the HTML

        if (status === 'Y' && htmlData) {
          const extractedFlights = extractFlightDataFromResponse(htmlData, portal);
          allExtractedFlights = [...allExtractedFlights, ...extractedFlights];
          console.log(`✅ Last poll request made (poll ${pollCount})`);
          console.log(`📊 Polling summary for ${portal}: ${pollCount} polls made, ${allExtractedFlights.length} flights successfully scraped`);
          return allExtractedFlights;
        } else if (status === 'N' && htmlData) {
          const extractedFlights = extractFlightDataFromResponse(htmlData, portal);
          allExtractedFlights = [...allExtractedFlights, ...extractedFlights];
          console.log(`⏳ Still processing... (poll ${pollCount}) - Found ${extractedFlights.length} flights so far (${allExtractedFlights.length} total)`);
          pollSuccess = true;
        } else if (status === 'N') {
          console.log(`⏳ Still processing... (poll ${pollCount})`);
          pollSuccess = true;
        } else {
          throw new Error(`Unknown status: ${status}`);
        }

      } catch (error) {
        retryCount++;
        console.error(`❌ Poll ${pollCount} failed (retry ${retryCount}/${maxRetries}):`, error);
        
        if (retryCount >= maxRetries) {
          failedPolls++;
          console.error(`❌ Poll ${pollCount} failed after ${maxRetries} retries`);
          break;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    if (!pollSuccess) {
      console.error(`❌ Stopping polling for ${portal} - too many failed polls (${failedPolls})`);
      break;
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  console.error(`❌ Max polling attempts (${maxPolls}) reached for portal: ${portal}`);
  return [];
}

// Helper Functions - Called by implementation details
function extractDataFromScript(html: string): ScriptExtractedData | null {
  try {
    // Look for script tags that contain the data object
    const scriptRegex = /<script[^>]*>[\s\S]*?data:\s*{[\s\S]*?}[\s\S]*?<\/script>/gi;
    let scriptMatch;
    
    while ((scriptMatch = scriptRegex.exec(html)) !== null) {
      const scriptContent = scriptMatch[0];
      
      // Look for the data object pattern
      const dataMatch = scriptContent.match(/data:\s*{([\s\S]*?)}/);
      if (dataMatch) {
        const dataContent = dataMatch[1];
        
        // Extract individual fields
        const tokenMatch = dataContent.match(/'_token':\s*'([^']+)'/);
        const sessionMatch = dataContent.match(/'session':\s*'([^']+)'/);
        const suuidMatch = dataContent.match(/'suuid':\s*'([^']+)'/);
        const deeplinkMatch = dataContent.match(/'deeplink':\s*'([^']+)'/);
        
        if (tokenMatch && sessionMatch && suuidMatch && deeplinkMatch) {
          return {
            _token: tokenMatch[1],
            session: sessionMatch[1],
            suuid: suuidMatch[1],
            deeplink: deeplinkMatch[1].replace(/&amp;/g, '&')
          };
        }
      }
    }
    
    console.warn('⚠️ No data object found in script tags');
    return null;
    
  } catch (error) {
    console.error('❌ Error extracting data from script:', error);
    return null;
  }
}

function extractFlightDataFromResponse(htmlData: string, portal: Portal): any[] {
  try {
    if (!htmlData || htmlData.length === 0) {
      console.log(`⚠️ No HTML data to extract from for portal: ${portal}`);
      return [];
    }
    const $ = cheerio.load(htmlData);
    const flights: any[] = [];
    $('.list-item.row').each((i: number, el: any) => {
      try {
        const flight = extractFlightFromListItem($(el), portal, $);
        if (flight) flights.push(flight);
      } catch (err) {
        console.warn(`⚠️ Error extracting flight from list item ${i + 1}:`, err);
      }
    });
    console.log(`✅ Extracted ${flights.length} flights from ${portal} portal`);
    return flights;
  } catch (error) {
    console.error(`❌ Error extracting flight data from ${portal}:`, error);
    return [];
  }
}

function extractFlightFromListItem($item: cheerio.Cheerio<any>, portal: Portal, $: cheerio.CheerioAPI): any | null {
  try {
    // Flight name and airline
    const flightName = $item.find('._flight_name').first().text().trim();
    const airline = $item.find('.airlines-name').first().text().trim();
    // Price
    const price = $item.find('.prices').first().text().trim();
    const currencyMatch = price.match(/[€$£¥₹]/);
    const currency = currencyMatch ? currencyMatch[0] : 'EUR';
    // Stops section
    const stopsSection = $item.find('.stops').first();
    let departureTime = '', arrivalTime = '', departureAirport = '', arrivalAirport = '', duration = '', stops = '';
    if (stopsSection.length) {
      const spans = stopsSection.find('span');
      if (spans.length >= 4) {
        departureTime = $(spans[0]).text().replace(/\s+/g, ' ').replace(/\+\d+/, '').trim();
        departureAirport = $(spans[1]).text().trim();
        arrivalTime = $(spans[2]).text().replace(/\s+/g, ' ').replace(/\+\d+/, '').trim();
        arrivalAirport = $(spans[3]).text().trim();
      }
      // Duration and stops
      const stopArrow = stopsSection.find('.stop-arrow');
      if (stopArrow.length) {
        duration = stopArrow.find('span').first().text().trim();
        const stopsSpan = stopArrow.find('span[class*="stops"]');
        if (stopsSpan.length) stops = stopsSpan.text().trim();
      }
    }
    // Modal extraction for segments and booking options
    const modal = $item.find('.modal').first();
    const segments: any[] = [];
    const bookingOptions: any[] = [];
    if (modal.length) {
      // Segments
      modal.find('._panel_body').each((i: number, seg: any) => {
        const flightNumber = $(seg).find('small').first().text().trim();
        const item = $(seg).find('._item').first();
        const segmentDuration = item.find('.c1 p').first().text().trim();
        const times = item.find('.c3 p');
        const airports = item.find('.c4 p');
        const segmentDepartureTime = times.eq(0).text().trim();
        const segmentArrivalTime = times.eq(1).text().trim();
        const segmentDepartureAirport = airports.eq(0).text().trim();
        const segmentArrivalAirport = airports.eq(1).text().trim();
        if (flightNumber || segmentDuration) {
          segments.push({
            airline: flightNumber.split(' ')[0] || airline,
            flightNumber,
            departureTime: segmentDepartureTime,
            arrivalTime: segmentArrivalTime,
            departureAirport: segmentDepartureAirport,
            arrivalAirport: segmentArrivalAirport,
            duration: segmentDuration
          });
        }
      });
      // Booking options
      modal.find('._similar > div').each((i: number, bo: any) => {
        const agency = $(bo).find('p').eq(0).text().trim();
        const priceText = $(bo).find('p').eq(1).clone().children('a').remove().end().text().trim();
        const link = $(bo).find('a').attr('href') || '';
        if (agency && priceText && link) {
          bookingOptions.push({ agency, price: priceText, link });
        }
      });
    }
    // Trip summary
    const tripSummary = { departureTime, arrivalTime, duration, stops };
    const flight = {
      portal,
      flightName: flightName || `${airline} Flight`,
      segments,
      bookingOptions,
      tripSummary,
      price,
      currency,
      extractedAt: new Date().toISOString()
    };
    return flight;
  } catch (error) {
    console.warn(`⚠️ Error extracting individual flight:`, error);
    return null;
  }
} 