import { Portal } from "./types";
import { FlightData } from "./entities";
import { RequestParams as SkyRequestParams } from "./fetchSkyPageAndExtractData";
import { RequestParams as KiwiRequestParams } from "./fetchKiwiPageAndExtractData";
export declare function fetchFlightData(portal: Portal, requestParams: SkyRequestParams | KiwiRequestParams): Promise<FlightData>;
//# sourceMappingURL=flightApiClient.d.ts.map