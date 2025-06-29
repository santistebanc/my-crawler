const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrapeWikipediaAirlines() {
  try {
    console.log('🔍 Scraping Wikipedia airline codes...');
    
    // Wikipedia page for airline codes
    const url = 'https://en.wikipedia.org/wiki/List_of_airline_codes';
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    const airlineMapping = {};
    let count = 0;
    
    // Find the main table with airline codes
    $('table.wikitable').each((tableIndex, table) => {
      const $table = $(table);
      const headers = [];
      
      // Get table headers
      $table.find('th').each((i, th) => {
        headers.push($(th).text().trim().toLowerCase());
      });
      
      // Check if this table has IATA and ICAO columns
      const hasIATA = headers.some(h => h.includes('iata') || h.includes('code'));
      const hasICAO = headers.some(h => h.includes('icao'));
      const hasName = headers.some(h => h.includes('airline') || h.includes('name') || h.includes('company'));
      
      if (hasIATA || hasICAO) {
        console.log(`📋 Processing table ${tableIndex + 1} with headers: ${headers.join(', ')}`);
        
        $table.find('tr').each((rowIndex, row) => {
          if (rowIndex === 0) return; // Skip header row
          
          const $row = $(row);
          const cells = $row.find('td');
          
          if (cells.length >= 2) {
            let iataCode = '';
            let icaoCode = '';
            let airlineName = '';
            let callSign = '';
            let country = '';
            let comments = '';
            
            // Try to extract data based on table structure
            cells.each((cellIndex, cell) => {
              const cellText = $(cell).text().trim();
              const header = headers[cellIndex] || '';
              
              if (header.includes('iata') || header.includes('code')) {
                iataCode = cellText;
              } else if (header.includes('icao')) {
                icaoCode = cellText;
              } else if (header.includes('airline') || header.includes('name') || header.includes('company')) {
                airlineName = cellText;
              } else if (header.includes('call') || header.includes('sign')) {
                callSign = cellText;
              } else if (header.includes('country') || header.includes('region')) {
                country = cellText;
              } else if (header.includes('comment')) {
                comments = cellText;
              }
            });
            
            // If we couldn't determine from headers, try common patterns
            if (!iataCode && !icaoCode && !airlineName) {
              if (cells.length >= 6) {
                iataCode = $(cells[0]).text().trim();
                icaoCode = $(cells[1]).text().trim();
                airlineName = $(cells[2]).text().trim();
                callSign = $(cells[3]).text().trim();
                country = $(cells[4]).text().trim();
                comments = $(cells[5]).text().trim();
              } else if (cells.length >= 4) {
                iataCode = $(cells[0]).text().trim();
                icaoCode = $(cells[1]).text().trim();
                airlineName = $(cells[2]).text().trim();
                callSign = $(cells[3]).text().trim();
              } else if (cells.length >= 3) {
                iataCode = $(cells[0]).text().trim();
                icaoCode = $(cells[1]).text().trim();
                airlineName = $(cells[2]).text().trim();
              } else if (cells.length >= 2) {
                iataCode = $(cells[0]).text().trim();
                airlineName = $(cells[1]).text().trim();
              }
            }
            
            // Clean up the data
            iataCode = iataCode.replace(/[^\w]/g, '').toUpperCase();
            icaoCode = icaoCode.replace(/[^\w]/g, '').toUpperCase();
            airlineName = airlineName.replace(/\s+/g, ' ').trim();
            callSign = callSign.replace(/\s+/g, ' ').trim();
            country = country.replace(/\s+/g, ' ').trim();
            comments = comments.replace(/\s+/g, ' ').trim();
            
            // Only add if we have valid data
            if (airlineName && (iataCode || icaoCode)) {
              const airlineData = {
                iataCode: iataCode || null,
                icaoCode: icaoCode || null,
                name: airlineName,
                callSign: callSign || null,
                country: country || null,
                comments: comments || null,
                scrapedAt: new Date().toISOString()
              };
              
              // Add to key-value mapping
              if (iataCode) {
                airlineMapping[iataCode] = airlineData;
              }
              if (icaoCode) {
                airlineMapping[icaoCode] = airlineData;
              }
              
              count++;
            }
          }
        });
      }
    });
    
    console.log(`✅ Found ${count} airlines with data`);
    
    // Save key-value mapping
    const scrapedAt = new Date().toISOString();
    const output = { scrapedAt, data: airlineMapping };
    const outputPath = './src/airlines.json';
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`💾 Saved key-value mapping to ${outputPath}`);
    
    // Show some examples
    console.log('\n📋 Examples of key-value mapping:');
    const examples = Object.entries(airlineMapping).slice(0, 5);
    examples.forEach(([code, data]) => {
      console.log(`  ${code}: ${data.name}`);
      console.log(`    Country: ${data.country || 'N/A'}, Call Sign: ${data.callSign || 'N/A'}`);
    });
    
    // Statistics
    const withIATA = Object.values(airlineMapping).filter(a => a.iataCode).length;
    const withICAO = Object.values(airlineMapping).filter(a => a.icaoCode).length;
    const withCountry = Object.values(airlineMapping).filter(a => a.country).length;
    const withCallSign = Object.values(airlineMapping).filter(a => a.callSign).length;
    
    console.log('\n📊 Statistics:');
    console.log(`  Total airlines: ${count}`);
    console.log(`  Total codes in mapping: ${Object.keys(airlineMapping).length}`);
    console.log(`  With IATA code: ${withIATA}`);
    console.log(`  With ICAO code: ${withICAO}`);
    console.log(`  With country: ${withCountry}`);
    console.log(`  With call sign: ${withCallSign}`);
    
    return airlineMapping;
    
  } catch (error) {
    console.error('❌ Error scraping Wikipedia:', error.message);
    throw error;
  }
}

// Run the scraper
scrapeWikipediaAirlines()
  .then(() => {
    console.log('✅ Scraping completed successfully');
  })
  .catch((error) => {
    console.error('❌ Scraping failed:', error);
    process.exit(1);
  }); 