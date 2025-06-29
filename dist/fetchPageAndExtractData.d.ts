import { Portal } from "./types";
export interface RequestParams {
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
    noc: string;
}
export interface ExtractedData extends ScriptExtractedData {
    cookie: string;
}
export declare function fetchPageAndExtractData(portal: Portal, requestParams: RequestParams): Promise<ExtractedData | null>;
export {};
//# sourceMappingURL=fetchPageAndExtractData.d.ts.map