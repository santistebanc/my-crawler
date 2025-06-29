const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const tzlookup = require('tzlookup').tzNameAt;
const NodeGeocoder = require('node-geocoder');

// Initialize geocoder (using OpenStreetMap Nominatim - free and no API key required)
const geocoder = NodeGeocoder({
  provider: 'openstreetmap',
  formatter: null
});

// Function to clean Wikipedia citation numbers from text
function cleanWikipediaCitations(text) {
  if (!text) return text;
  // Remove citation numbers like [1], [2], [3], etc.
  return text.replace(/\[\d+\]/g, '').trim();
}

async function getOpenFlightsData() {
  const response = await axios.get('https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat');
  const airportData = response.data.split('\n').filter(line => line.trim());
  const openFlightsAirports = {};
  airportData.forEach(line => {
    const parts = line.split(',').map(part => part.replace(/"/g, ''));
    if (parts.length >= 14) {
      const [id, name, city, country, iata, icao, lat, lng, altitude, timezone, dst, tzDatabase, type, source] = parts;
      if (iata && iata.length === 3 && lat && lng) {
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
        if (!isNaN(latitude) && !isNaN(longitude)) {
          openFlightsAirports[iata] = {
            name,
            city,
            country,
            icao,
            latitude,
            longitude,
            altitude: parseInt(altitude) || 0,
            timezone: tzDatabase || null,
            iataCode: iata
          };
        }
      }
    }
  });
  return openFlightsAirports;
}

async function getTimezoneFromCity(airport) {
  try {
    // Try to geocode using city and country
    let searchQuery = airport.city;
    if (airport.country) {
      searchQuery += `, ${airport.country}`;
    }
    
    console.log(`🔍 Geocoding: ${searchQuery} for airport ${airport.iataCode || airport.icaoCode}`);
    
    const results = await geocoder.geocode(searchQuery);
    
    if (results && results.length > 0) {
      const result = results[0];
      const latitude = result.latitude;
      const longitude = result.longitude;
      
      if (latitude && longitude) {
        const timezone = tzlookup(latitude, longitude);
        console.log(`✅ Got timezone ${timezone} for ${searchQuery} (${latitude}, ${longitude})`);
        return timezone;
      }
    }
    
    console.warn(`⚠️ No geocoding results for ${searchQuery}`);
    return null;
  } catch (error) {
    console.warn(`⚠️ Geocoding error for ${airport.city}: ${error.message}`);
    return null;
  }
}

async function scrapeWikipediaAirports() {
  try {
    console.log('🔍 Scraping Wikipedia airport codes...');
    const airportMapping = {};
    let totalCount = 0;
    const letterRanges = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    for (const letter of letterRanges) {
      try {
        console.log(`📋 Scraping airports starting with letter: ${letter}`);
        const url = `https://en.wikipedia.org/wiki/List_of_airports_by_IATA_airport_code:_${letter}`;
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        let pageCount = 0;
        $('table.wikitable').each((tableIndex, table) => {
          const $table = $(table);
          const headers = [];
          $table.find('th').each((i, th) => {
            headers.push($(th).text().trim().toLowerCase());
          });
          if (headers.length < 3) return;
          $table.find('tr').each((rowIndex, row) => {
            if (rowIndex === 0) return;
            const $row = $(row);
            const cells = $row.find('td');
            if (cells.length >= 3) {
              let iataCode = '';
              let icaoCode = '';
              let airportName = '';
              let city = '';
              let country = '';
              let timezone = '';
              cells.each((cellIndex, cell) => {
                const cellText = $(cell).text().trim();
                const header = headers[cellIndex] || '';
                if (header.includes('iata') || header.includes('code')) {
                  iataCode = cellText;
                } else if (header.includes('icao')) {
                  icaoCode = cellText;
                } else if (header.includes('airport') || header.includes('name')) {
                  airportName = cellText;
                } else if (header.includes('city') || header.includes('location') || header.includes('served')) {
                  city = cellText;
                } else if (header.includes('country')) {
                  country = cellText;
                } else if (header.includes('timezone') || header.includes('zone') || header.includes('time')) {
                  timezone = cellText;
                }
              });
              if (!iataCode && !icaoCode && !airportName) {
                if (cells.length >= 6) {
                  iataCode = $(cells[0]).text().trim();
                  icaoCode = $(cells[1]).text().trim();
                  airportName = $(cells[2]).text().trim();
                  city = $(cells[3]).text().trim();
                  country = $(cells[4]).text().trim();
                  timezone = $(cells[5]).text().trim();
                } else if (cells.length >= 4) {
                  iataCode = $(cells[0]).text().trim();
                  icaoCode = $(cells[1]).text().trim();
                  airportName = $(cells[2]).text().trim();
                  city = $(cells[3]).text().trim();
                } else if (cells.length >= 3) {
                  iataCode = $(cells[0]).text().trim();
                  icaoCode = $(cells[1]).text().trim();
                  airportName = $(cells[2]).text().trim();
                }
              }
              iataCode = iataCode.replace(/[^\w]/g, '').toUpperCase();
              icaoCode = icaoCode.replace(/[^\w]/g, '').toUpperCase();
              airportName = cleanWikipediaCitations(airportName);
              city = cleanWikipediaCitations(city);
              country = cleanWikipediaCitations(country);
              timezone = timezone.replace(/\s+/g, ' ').trim();
              if (city && city.includes(',') && !country) {
                const parts = city.split(',').map(part => part.trim());
                if (parts.length > 1) {
                  country = parts[parts.length - 1];
                  city = parts.slice(0, -1).join(', ');
                }
              }
              if (airportName && (iataCode || icaoCode)) {
                const airportData = {
                  iataCode: iataCode || null,
                  icaoCode: icaoCode || null,
                  name: airportName,
                  city: city || null,
                  country: country || null,
                  timezone: timezone || null,
                };
                if (iataCode) {
                  airportMapping[iataCode] = airportData;
                }
                if (icaoCode) {
                  airportMapping[icaoCode] = airportData;
                }
                pageCount++;
                totalCount++;
              }
            }
          });
        });
        console.log(`  ✅ Found ${pageCount} airports for letter ${letter}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.warn(`⚠️ Error scraping letter ${letter}:`, error.message);
        continue;
      }
    }
    console.log(`✅ Found ${totalCount} total airports with data`);
    
    // --- Integrate OpenFlights and tzlookup for missing timezones ---
    const openFlightsAirports = await getOpenFlightsData();
    let filledFromOpenFlights = 0;
    let filledFromTzlookup = 0;
    let filledFromGeocoding = 0;
    const failedTimezones = [];
    
    for (const code of Object.keys(airportMapping)) {
      const airport = airportMapping[code];
      if (!airport.timezone || airport.timezone === null) {
        const openFlights = openFlightsAirports[code];
        
        if (openFlights) {
          try {
            // Prefer OpenFlights timezone if available
            if (openFlights.timezone) {
              airport.timezone = openFlights.timezone;
              filledFromOpenFlights++;
              console.log(`✅ Updated ${code} timezone to ${openFlights.timezone} from OpenFlights`);
            } else if (openFlights.latitude && openFlights.longitude) {
              airport.timezone = tzlookup(openFlights.latitude, openFlights.longitude);
              filledFromTzlookup++;
              console.log(`✅ Updated ${code} timezone to ${airport.timezone} using tzlookup`);
            } else {
              console.warn(`⚠️ ${code}: OpenFlights entry found but no coordinates or timezone`);
              failedTimezones.push({
                code,
                airport,
                reason: 'OpenFlights entry found but no coordinates or timezone'
              });
            }
          } catch (err) {
            console.warn(`⚠️ ${code}: Could not get timezone from OpenFlights: ${err.message}`);
            failedTimezones.push({
              code,
              airport,
              reason: `OpenFlights error: ${err.message}`
            });
          }
        } else {
          // Fallback: use geocoding to get coordinates from city name
          if (airport.city) {
            const geocodedTimezone = await getTimezoneFromCity(airport);
            if (geocodedTimezone) {
              airport.timezone = geocodedTimezone;
              filledFromGeocoding++;
              console.log(`✅ Updated ${code} timezone to ${geocodedTimezone} using geocoding`);
            } else {
              console.warn(`⚠️ ${code}: Geocoding failed for city "${airport.city}"`);
              failedTimezones.push({
                code,
                airport,
                reason: `Geocoding failed for city "${airport.city}"`
              });
            }
          } else {
            console.warn(`⚠️ ${code}: No city name available for geocoding`);
            failedTimezones.push({
              code,
              airport,
              reason: 'No city name available for geocoding'
            });
          }
        }
      }
    }
    
    console.log(`\n📊 Timezone filling summary:`);
    console.log(`  - Filled ${filledFromOpenFlights} airports using OpenFlights timezone data`);
    console.log(`  - Filled ${filledFromTzlookup} airports using tzlookup from OpenFlights coordinates`);
    console.log(`  - Filled ${filledFromGeocoding} airports using geocoding from city name`);
    console.log(`  - Total filled: ${filledFromOpenFlights + filledFromTzlookup + filledFromGeocoding}`);
    
    // Count remaining airports with missing timezones
    const remainingMissing = Object.values(airportMapping).filter(airport => !airport.timezone || airport.timezone === null).length;
    console.log(`  - Remaining airports with missing timezones: ${remainingMissing}`);
    
    if (remainingMissing > 0) {
      console.log('\n⚠️ Airports still missing timezones:');
      Object.entries(airportMapping)
        .filter(([code, airport]) => !airport.timezone || airport.timezone === null)
        .slice(0, 10)
        .forEach(([code, airport]) => {
          console.log(`  ${code}: ${airport.name} (${airport.city}, ${airport.country})`);
        });
      if (remainingMissing > 10) {
        console.log(`  ... and ${remainingMissing - 10} more`);
      }
    }
    
    // Log detailed failure information
    if (failedTimezones.length > 0) {
      console.log('\n❌ Detailed timezone assignment failures:');
      failedTimezones.forEach(failure => {
        console.log(`  ${failure.code}: ${failure.airport.name} (${failure.airport.city}, ${failure.airport.country})`);
        console.log(`    Reason: ${failure.reason}`);
      });
      
      // Save failed timezones to a separate file for review
      const failedTimezonesPath = './failed_timezones.json';
      fs.writeFileSync(failedTimezonesPath, JSON.stringify(failedTimezones, null, 2));
      console.log(`💾 Failed timezone assignments saved to ${failedTimezonesPath}`);
    }
    
    const scrapedAt = new Date().toISOString();
    const output = { scrapedAt, data: airportMapping };
    const outputPath = './src/airports.json';
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`💾 Saved key-value mapping to ${outputPath}`);
    
    // Show some examples
    console.log('\n📋 Examples of key-value mapping:');
    const examples = Object.entries(airportMapping).slice(0, 5);
    examples.forEach(([code, data]) => {
      console.log(`  ${code}: ${data.name}`);
      console.log(`    City: ${data.city || 'N/A'}, Country: ${data.country || 'N/A'}, Timezone: ${data.timezone || 'N/A'}`);
    });
    
    // Statistics
    const withIATA = Object.values(airportMapping).filter(a => a.iataCode).length;
    const withICAO = Object.values(airportMapping).filter(a => a.icaoCode).length;
    const withCity = Object.values(airportMapping).filter(a => a.city).length;
    const withCountry = Object.values(airportMapping).filter(a => a.country).length;
    const withTimezone = Object.values(airportMapping).filter(a => a.timezone).length;
    
    console.log('\n📊 Statistics:');
    console.log(`  Total airports: ${totalCount}`);
    console.log(`  Total codes in mapping: ${Object.keys(airportMapping).length}`);
    console.log(`  With IATA code: ${withIATA}`);
    console.log(`  With ICAO code: ${withICAO}`);
    console.log(`  With city: ${withCity}`);
    console.log(`  With country: ${withCountry}`);
    console.log(`  With timezone: ${withTimezone}`);
    
    return airportMapping;
  } catch (error) {
    console.error('❌ Error scraping Wikipedia:', error.message);
    throw error;
  }
}

// Run the scraper
scrapeWikipediaAirports()
  .then(() => {
    console.log('✅ Airport scraping completed successfully');
  })
  .catch((error) => {
    console.error('❌ Airport scraping failed:', error);
    process.exit(1);
  }); 