# Flight Scraper API

A Fastify server with Crawlee web scraping capabilities to extract flight data from flightsfinder.com using both Kiwi and Sky portals in parallel.

## Features

- 🚀 Fastify server with TypeScript
- 🕷️ Playwright-based web scraping with Crawlee
- 🔍 Dynamic content scraping (handles JavaScript-rendered pages)
- 📊 Flight data extraction with detailed segment information
- 🌐 **Parallel scraping of both Kiwi and Sky portals**
- 🛡️ Error handling and validation
- 🔄 Automatic parameter mapping between portals

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build and Run

```bash
npm run build
npm start
```

## API Endpoints

### Health Check
```bash
curl http://localhost:3001/health
```

### Scrape Flights (Parallel Kiwi + Sky)

#### POST /scrape
```bash
curl -X POST http://localhost:3001/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "originplace": "LON",
    "destinationplace": "NYC",
    "outbounddate": "2024-12-25",
    "inbounddate": "2025-01-01",
    "adults": 1,
    "children": 0,
    "infants": 0,
    "currency": "EUR",
    "type": "roundtrip",
    "cabinclass": "Economy"
  }'
```

#### GET /scrape
```bash
curl "http://localhost:3001/scrape?originplace=LON&destinationplace=NYC&outbounddate=2024-12-25&inbounddate=2025-01-01&adults=1&children=0&infants=0&currency=EUR&type=roundtrip&cabinclass=Economy"
```

## Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `portals` | object | No | Portal selection flags | `{ "kiwi": true, "sky": false }` |
| `originplace` | string | Yes* | Origin airport code | `LON` |
| `destinationplace` | string | Yes* | Destination airport code | `NYC` |
| `outbounddate` | string | Yes* | Outbound date in YYYY-MM-DD format | `2024-12-25` |
| `inbounddate` | string | No | Return date in YYYY-MM-DD format | `2025-01-01` |
| `adults` | number | No | Number of adult passengers (default: 1) | `1` |
| `children` | number | No | Number of children (default: 0) | `0` |
| `infants` | number | No | Number of infants (default: 0) | `0` |
| `currency` | string | No | Currency code (default: EUR) | `EUR` |
| `type` | string | No | Trip type: oneway/roundtrip (default: oneway) | `roundtrip` |
| `cabinclass` | string | No | Cabin class (default: Economy) | `Economy`, `PremiumEconomy`, `First`, `Business` |

*Either provide a complete `url` OR the individual parameters (`originplace`, `destinationplace`, `outbounddate`).

## Portal Mapping

The scraper automatically maps parameters between the two portals:

### Kiwi Portal
- Uses original parameter format
- Date format: `DD/MM/YYYY` (converted from input YYYY-MM-DD)
- Cabin class: Automatically mapped from Sky format (`M`, `W`, `F`, `C`)
- URL: `https://www.flightsfinder.com/portal/kiwi`

### Sky Portal  
- Uses different parameter names
- Date format: `YYYY-MM-DD` (same as input format)
- Cabin class: `Economy`, `PremiumEconomy`, `First`, `Business` (API input format)
- URL: `https://www.flightsfinder.com/portal/sky`

### Cabin Class Mapping
| API Input (Sky Format) | Kiwi Portal | Description |
|------------------------|-------------|-------------|
| `Economy` | `M` | Economy class |
| `PremiumEconomy` | `W` | Premium Economy class |
| `First` | `F` | First class |
| `Business` | `C` | Business class |

## Response Format

```json
{
  "success": true,
  "data": {
    "flights": [
      {
        "airline": "British Airways",
        "departureTime": "10:30",
        "arrivalTime": "13:45",
        "duration": "8h 15m",
        "stops": "Direct",
        "price": "€450",
        "bookingUrl": "https://...",
        "portal": "kiwi",
        "segments": [
          {
            "flightNumber": "BA123",
            "departure": "London Heathrow",
            "arrival": "New York JFK",
            "departureTime": "10:30",
            "arrivalTime": "13:45",
            "duration": "8h 15m"
          }
        ]
      }
    ],
    "searchParams": {...},
    "scrapedAt": "2024-01-15T10:30:00.000Z",
    "portalsScraped": 2
  }
}
```

## Error Response

```json
{
  "success": false,
  "error": "Error message"
}
```

## Architecture

- **Fastify**: High-performance web framework
- **Crawlee**: Web scraping and browser automation
- **Playwright**: Browser automation for dynamic content
- **TypeScript**: Type-safe development
- **Parallel Processing**: Simultaneous scraping of multiple portals

## Notes

- The scraper automatically scrapes both Kiwi and Sky portals in parallel
- Each flight result includes a `portal` field indicating the source
- Supports both one-way and round-trip flights
- Handles dynamic content rendering with Playwright
- Includes detailed flight segment information
- All dates should be provided in DD/MM/YYYY format
- The scraper waits for search results to load before extracting data
- Results from both portals are combined into a single response 