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

export interface SkyExtractedData {
  cookie: string;
  _token: string;
  session: string;
  suuid: string;
  deeplink: string;
}

/**
 * Fetches the initial page for Sky portal and extracts session data
 */
export async function fetchSkyPageAndExtractData(
  requestParams: RequestParams
): Promise<SkyExtractedData | null> {
  const pageUrl = buildPortalUrl('sky', requestParams);
  console.info(`🌐 Fetching initial page for Sky portal: ${pageUrl}`);

  try {
    const response = await fetch(pageUrl, {
      method: "GET",
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-language": "en-GB,en;q=0.9",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "sec-ch-ua":
          '"Brave";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "sec-gpc": "1",
        "upgrade-insecure-requests": "1",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const htmlContent = await response.text();

    // Extract session cookie
    const setCookieHeader = response.headers.get("set-cookie");
    const cookie = extractSessionCookie(setCookieHeader);

    if (!cookie) {
      console.error("❌ No session cookie found in response");
      return null;
    }

    // Extract CSRF token - Sky uses pattern 3 (script data object)
    const tokenMatch = htmlContent.match(/data:\s*{[^}]*'_token':\s*'([^']+)'/);
    if (!tokenMatch) {
      console.error("❌ No CSRF token found in response");
      return null;
    }
    
    const _token = tokenMatch[1];

    // Extract session ID - Sky uses pattern 2 (script data object)
    const sessionMatch = htmlContent.match(/data:\s*{[^}]*'session':\s*'([^']+)'/);
    if (!sessionMatch) {
      console.error("❌ No session ID found in response");
      return null;
    }
    
    const session = sessionMatch[1];

    // Extract SUUID - Sky uses pattern 2 (script data object)
    const suuidMatch = htmlContent.match(/data:\s*{[^}]*'suuid':\s*'([^']+)'/);
    if (!suuidMatch) {
      console.error("❌ No SUUID found in response");
      return null;
    }
    
    const suuid = suuidMatch[1];

    // Extract deeplink - Sky uses pattern 2 (script data object)
    const deeplinkMatch = htmlContent.match(/data:\s*{[^}]*'deeplink':\s*'([^']+)'/);
    if (!deeplinkMatch) {
      console.error("❌ No deeplink found in response");
      return null;
    }
    
    const deeplink = deeplinkMatch[1];

    console.info(`🎯 Initial page fetch completed successfully for Sky portal`);

    return {
      cookie,
      _token,
      session,
      suuid,
      deeplink,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Error fetching initial page for Sky portal: ${errorMessage}`);
    return null;
  }
} 