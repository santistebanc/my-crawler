"use strict";
// Entity interfaces for flight data
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateId = generateId;
exports.extractAirportCode = extractAirportCode;
exports.extractAirportName = extractAirportName;
exports.extractAirlineCode = extractAirlineCode;
// Utility functions for entity management
function generateId(prefix, data) {
    const hash = data.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `${prefix}_${hash}`;
}
function extractAirportCode(airportString) {
    // Extract airport code from strings like "SLP San Luis Potosi" or "MEX Mexico City"
    const match = airportString.match(/^([A-Z]{3})\s/);
    return match ? match[1] : airportString.split(' ')[0];
}
function extractAirportName(airportString) {
    // Extract airport name from strings like "SLP San Luis Potosi" or "MEX Mexico City"
    const parts = airportString.split(' ');
    if (parts.length >= 3 && /^[A-Z]{3}$/.test(parts[0])) {
        return parts.slice(1).join(' ');
    }
    return airportString;
}
function extractAirlineCode(airlineString) {
    // Extract airline code from strings like "Aeromexico AM1531"
    const match = airlineString.match(/^([A-Za-z]+)\s/);
    return match ? match[1] : airlineString;
}
//# sourceMappingURL=entities.js.map