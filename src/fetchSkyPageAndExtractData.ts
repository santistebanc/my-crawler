import { Portal } from "./types";
import { buildPortalUrl, extractSessionCookie } from "./helpers";

export interface RequestParams {
  adults: number;
  children: number;
  infants: number;
  currency: string;
  originplace?: string;
  destinationplace?: string;
  outbounddate?: string;
  inbounddate?: string;
  cabinclass?: 'Economy' | 'PremiumEconomy' | 'First' | 'Business';
}

interface ScriptExtractedData {
  _token: string;
  session: string;
  suuid: string;
  deeplink: string;
  noc: string;
}

export interface SkyExtractedData extends ScriptExtractedData {
  cookie: string;
}

export async function fetchSkyPageAndExtractData(
  portal: Portal,
  requestParams: RequestParams
): Promise<SkyExtractedData | null> {
  // Construct the page URL using helper
  const pageUrl = buildPortalUrl(portal, requestParams);
  console.info(`🌐 Fetching initial page for ${portal} portal: ${pageUrl}`);

  try {
    console.info(`📤 Sending GET request to ${pageUrl}`);
    const response = await fetch(pageUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    console.info(`📥 Page response: status=${response.status}, content-type=${response.headers.get('content-type')}`);

    if (!response.ok) {
      console.error(`❌ HTTP error! status: ${response.status}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    console.info(`📄 Page HTML length: ${html.length} characters`);

    // Extract session cookie
    const setCookieHeader = response.headers.get("set-cookie");
    const sessionCookie = extractSessionCookie(setCookieHeader);
    console.info(`🍪 Session cookie extracted: ${sessionCookie ? sessionCookie.length : 0} characters`);

    // Extract data from script tag
    console.info(`🔍 Extracting data from script tags...`);
    const extractedData = extractDataFromScript(html);

    if (!extractedData) {
      console.error(`❌ Failed to extract data from script tags`);
      return null;
    }

    console.info(`✅ Data extraction successful:`);
    console.info(`   - _token: ${extractedData._token ? '✓' : '✗'}`);
    console.info(`   - session: ${extractedData.session ? '✓' : '✗'}`);
    console.info(`   - suuid: ${extractedData.suuid ? '✓' : '✗'}`);
    console.info(`   - deeplink: ${extractedData.deeplink ? '✓' : '✗'}`);
    console.info(`   - noc: ${extractedData.noc ? '✓' : '✗'}`);

    // Always return an SkyExtractedData object with a cookie property
    const result = {
      _token: extractedData._token,
      session: extractedData.session,
      suuid: extractedData.suuid,
      deeplink: extractedData.deeplink,
      noc: extractedData.noc,
      cookie: sessionCookie || "",
    };

    console.info(`🎯 Initial page fetch completed successfully for ${portal} portal`);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Error fetching initial page for ${portal} portal: ${errorMessage}`);
    return null;
  }
}

function extractDataFromScript(html: string): ScriptExtractedData | null {
  try {
    // Look for script tags that contain the data object
    const scriptRegex =
      /<script[^>]*>[\s\S]*?data:\s*{[\s\S]*?}[\s\S]*?<\/script>/gi;
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
            deeplink: deeplinkMatch[1],
            noc: Date.now().toString(),
          };
        }
      }
    }

    return null;
  } catch (error) {
    return null;
  }
} 