import { ScrapingRequest } from '../types';

/**
 * Format date from YYYY-MM-DD to DD/MM/YYYY
 */
function formatDateToDDMMYYYY(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Map cabin class to Kiwi format
 */
function mapCabinClass(cabinclass: string): string {
  switch (cabinclass) {
    case 'Economy': return 'M';
    case 'PremiumEconomy': return 'W';
    case 'First': return 'F';
    case 'Business': return 'C';
    default: return 'M';
  }
}

/**
 * Construct Kiwi portal URL
 */
export function constructKiwiUrl(request: ScrapingRequest): string {
  const {
    originplace = '',
    destinationplace = '',
    outbounddate = '',
    inbounddate = '',
    adults = 1,
    children = 0,
    infants = 0,
    currency = 'EUR',
    type = 'oneway',
    cabinclass = 'Economy'
  } = request;

  const cabin = mapCabinClass(cabinclass);
  const outDate = outbounddate ? formatDateToDDMMYYYY(outbounddate) : '';
  const inDate = inbounddate ? formatDateToDDMMYYYY(inbounddate) : '';
  
  return `https://www.flightsfinder.com/portal/kiwi?currency=${encodeURIComponent(currency)}&type=${encodeURIComponent(type)}&cabinclass=${cabin}&originplace=${encodeURIComponent(originplace)}&destinationplace=${encodeURIComponent(destinationplace)}&outbounddate=${encodeURIComponent(outDate)}&inbounddate=${encodeURIComponent(inDate)}&adults=${adults}&children=${children}&infants=${infants}`;
}

/**
 * Construct Sky portal URL
 */
export function constructSkyUrl(request: ScrapingRequest): string {
  const {
    originplace = '',
    destinationplace = '',
    outbounddate = '',
    inbounddate = '',
    adults = 1,
    children = 0,
    infants = 0,
    currency = 'EUR',
    cabinclass = 'Economy'
  } = request;

  return `https://www.flightsfinder.com/portal/sky?originplace=${encodeURIComponent(originplace)}&destinationplace=${encodeURIComponent(destinationplace)}&outbounddate=${encodeURIComponent(outbounddate)}&inbounddate=${encodeURIComponent(inbounddate)}&cabinclass=${encodeURIComponent(cabinclass)}&adults=${adults}&children=${children}&infants=${infants}&currency=${encodeURIComponent(currency)}`;
} 