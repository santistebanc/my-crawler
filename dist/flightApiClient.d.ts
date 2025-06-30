import { FlightData } from "./entities";
import { RequestParams as SkyRequestParams } from "./fetchSkyPageAndExtractData";
import { RequestParams as KiwiRequestParams } from "./fetchKiwiPageAndExtractData";
/**
 * Fetches flight data from Sky portal
 */
export declare function fetchSkyFlightData(requestParams: SkyRequestParams): Promise<FlightData>;
/**
 * Fetches flight data from Kiwi portal
 */
export declare function fetchKiwiFlightData(requestParams: KiwiRequestParams): Promise<FlightData>;
//# sourceMappingURL=flightApiClient.d.ts.map