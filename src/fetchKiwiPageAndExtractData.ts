import { Portal } from "./types";
import { HttpsProxyAgent } from "https-proxy-agent";
import { buildPortalUrl, extractSessionCookie } from "./helpers";

const proxyUrl =
  "http://groups-BUYPROXIES94952:apify_proxy_KIf2EQ6nvU4hmZKYyZ4eneVanvLoKz0cg6yN@proxy.apify.com:8000";
const proxyAgent = new HttpsProxyAgent(proxyUrl);

interface RequestInitWithAgent extends RequestInit {
  agent?: any;
}

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

export interface KiwiExtractedData {
  _token: string;
  cookie: string;
}

export async function fetchKiwiPageAndExtractData(
  portal: Portal,
  requestParams: RequestParams
): Promise<KiwiExtractedData | null> {
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
      agent: proxyAgent,
    } as RequestInitWithAgent);

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

    // Extract _token from script tag (similar to Sky's approach)
    console.info(`🔍 Extracting _token from script tags...`);
    const extractedData = extractDataFromScript(html);
    
    if (!extractedData) {
      console.error(`❌ Failed to extract _token from script tags`);
      return null;
    }

    console.info(`✅ Token extraction successful: ${extractedData._token ? '✓' : '✗'}`);

    const result = {
      _token: extractedData._token,
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

function extractDataFromScript(html: string): { _token: string } | null {
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

        // Extract _token field
        const tokenMatch = dataContent.match(/'_token':\s*'([^']+)'/);
        
        if (tokenMatch) {
          return {
            _token: tokenMatch[1],
          };
        }
      }
    }

    return null;
  } catch (error) {
    return null;
  }
} 