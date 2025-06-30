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

export interface KiwiExtractedData {
  cookie: string;
  _token: string;
}

/**
 * Fetches the initial page for Kiwi portal and extracts session data
 */
export async function fetchKiwiPageAndExtractData(
  requestParams: RequestParams
): Promise<KiwiExtractedData | null> {
  const pageUrl = buildPortalUrl('kiwi', requestParams);
  console.info(`🌐 Fetching initial page for Kiwi portal: ${pageUrl}`);

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

    // Extract CSRF token - Kiwi uses pattern 3 (script data object)
    const tokenMatch = htmlContent.match(/data:\s*{[^}]*'_token':\s*'([^']+)'/);
    if (!tokenMatch) {
      console.error("❌ No CSRF token found in response");
      return null;
    }
    
    const _token = tokenMatch[1];

    console.info(`🎯 Initial page fetch completed successfully for Kiwi portal`);

    return {
      cookie,
      _token,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Error fetching initial page for Kiwi portal: ${errorMessage}`);
    return null;
  }
} 