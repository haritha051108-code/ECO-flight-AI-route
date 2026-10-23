/**
 * EcoFlight AI - Airport & Destination Database + Geocoding
 */

export const MAJOR_AIRPORTS = [
    // North America
    { iata: 'JFK', name: 'John F. Kennedy Intl', city: 'New York', country: 'United States', lat: 40.6413, lon: -73.7781 },
    { iata: 'EWR', name: 'Newark Liberty Intl', city: 'Newark / New York', country: 'United States', lat: 40.6895, lon: -74.1745 },
    { iata: 'LAX', name: 'Los Angeles Intl', city: 'Los Angeles', country: 'United States', lat: 33.9416, lon: -118.4085 },
    { iata: 'SFO', name: 'San Francisco Intl', city: 'San Francisco', country: 'United States', lat: 37.6213, lon: -122.3790 },
    { iata: 'ORD', name: "O'Hare Intl", city: 'Chicago', country: 'United States', lat: 41.9742, lon: -87.9073 },
    { iata: 'ATL', name: 'Hartsfield-Jackson Atlanta', city: 'Atlanta', country: 'United States', lat: 33.6407, lon: -84.4277 },
    { iata: 'DFW', name: 'Dallas/Fort Worth Intl', city: 'Dallas', country: 'United States', lat: 32.8998, lon: -97.0403 },
    { iata: 'SEA', name: 'Seattle-Tacoma Intl', city: 'Seattle', country: 'United States', lat: 47.4502, lon: -122.3088 },
    { iata: 'MIA', name: 'Miami Intl', city: 'Miami', country: 'United States', lat: 25.7959, lon: -80.2870 },
    { iata: 'BOS', name: 'Logan Intl', city: 'Boston', country: 'United States', lat: 42.3656, lon: -71.0096 },
    { iata: 'YYZ', name: 'Toronto Pearson Intl', city: 'Toronto', country: 'Canada', lat: 43.6777, lon: -79.6248 },
    { iata: 'YVR', name: 'Vancouver Intl', city: 'Vancouver', country: 'Canada', lat: 49.1967, lon: -123.1815 },
    { iata: 'MEX', name: 'Benito Juárez Intl', city: 'Mexico City', country: 'Mexico', lat: 19.4363, lon: -99.0721 },

    // Europe
    { iata: 'LHR', name: 'Heathrow Airport', city: 'London', country: 'United Kingdom', lat: 51.4700, lon: -0.4543 },
    { iata: 'LGW', name: 'Gatwick Airport', city: 'London', country: 'United Kingdom', lat: 51.1537, lon: -0.1821 },
    { iata: 'CDG', name: 'Charles de Gaulle', city: 'Paris', country: 'France', lat: 49.0097, lon: 2.5479 },
    { iata: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', lat: 50.0379, lon: 8.5622 },
    { iata: 'AMS', name: 'Amsterdam Schiphol', city: 'Amsterdam', country: 'Netherlands', lat: 52.3105, lon: 4.7683 },
    { iata: 'MAD', name: 'Adolfo Suárez Madrid-Barajas', city: 'Madrid', country: 'Spain', lat: 40.4839, lon: -3.5680 },
    { iata: 'BCN', name: 'Josep Tarradellas Barcelona-El Prat', city: 'Barcelona', country: 'Spain', lat: 41.2974, lon: 2.0833 },
    { iata: 'FCO', name: 'Leonardo da Vinci-Fiumicino', city: 'Rome', country: 'Italy', lat: 41.8003, lon: 12.2389 },
    { iata: 'MUC', name: 'Munich Airport', city: 'Munich', country: 'Germany', lat: 48.3537, lon: 11.7750 },
    { iata: 'ZRH', name: 'Zurich Airport', city: 'Zurich', country: 'Switzerland', lat: 47.4582, lon: 8.5555 },
    { iata: 'VIE', name: 'Vienna Intl', city: 'Vienna', country: 'Austria', lat: 48.1103, lon: 16.5697 },
    { iata: 'DUB', name: 'Dublin Airport', city: 'Dublin', country: 'Ireland', lat: 53.4264, lon: -6.2499 },
    { iata: 'CPH', name: 'Copenhagen Airport', city: 'Copenhagen', country: 'Denmark', lat: 55.6180, lon: 12.6508 },
    { iata: 'OSL', name: 'Oslo Gardermoen', city: 'Oslo', country: 'Norway', lat: 60.1976, lon: 11.1004 },
    { iata: 'ARN', name: 'Stockholm Arlanda', city: 'Stockholm', country: 'Sweden', lat: 59.6498, lon: 17.9238 },
    { iata: 'IST', name: 'Istanbul Airport', city: 'Istanbul', country: 'Turkey', lat: 41.2753, lon: 28.7519 },
    { iata: 'ATH', name: 'Eleftherios Venizelos', city: 'Athens', country: 'Greece', lat: 37.9364, lon: 23.9445 },
    { iata: 'HEL', name: 'Helsinki-Vantaa', city: 'Helsinki', country: 'Finland', lat: 60.3210, lon: 24.9529 },

    // Asia & Middle East
    { iata: 'DXB', name: 'Dubai Intl', city: 'Dubai', country: 'United Arab Emirates', lat: 25.2532, lon: 55.3657 },
    { iata: 'DOH', name: 'Hamad Intl', city: 'Doha', country: 'Qatar', lat: 25.2731, lon: 51.6081 },
    { iata: 'HND', name: 'Tokyo Haneda', city: 'Tokyo', country: 'Japan', lat: 35.5494, lon: 139.7798 },
    { iata: 'NRT', name: 'Narita Intl', city: 'Tokyo', country: 'Japan', lat: 35.7720, lon: 140.3929 },
    { iata: 'SIN', name: 'Singapore Changi', city: 'Singapore', country: 'Singapore', lat: 1.3644, lon: 103.9915 },
    { iata: 'HKG', name: 'Hong Kong Intl', city: 'Hong Kong', country: 'Hong Kong', lat: 22.3080, lon: 113.9185 },
    { iata: 'ICN', name: 'Incheon Intl', city: 'Seoul', country: 'South Korea', lat: 37.4602, lon: 126.4407 },
    { iata: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand', lat: 13.6900, lon: 100.7501 },
    { iata: 'KUL', name: 'Kuala Lumpur Intl', city: 'Kuala Lumpur', country: 'Malaysia', lat: 2.7456, lon: 101.7099 },
    { iata: 'DEL', name: 'Indira Gandhi Intl', city: 'New Delhi', country: 'India', lat: 28.5562, lon: 77.1000 },
    { iata: 'BOM', name: 'Chhatrapati Shivaji Maharaj', city: 'Mumbai', country: 'India', lat: 19.0896, lon: 72.8656 },
    { iata: 'BLR', name: 'Kempegowda Intl', city: 'Bengaluru', country: 'India', lat: 13.1986, lon: 77.7066 },
    { iata: 'PVG', name: 'Shanghai Pudong Intl', city: 'Shanghai', country: 'China', lat: 31.1443, lon: 121.8083 },
    { iata: 'PEK', name: 'Beijing Capital Intl', city: 'Beijing', country: 'China', lat: 40.0799, lon: 116.6031 },
    { iata: 'TPE', name: 'Taiwan Taoyuan Intl', city: 'Taipei', country: 'Taiwan', lat: 25.0797, lon: 121.2342 },
    { iata: 'RUH', name: 'King Khalid Intl', city: 'Riyadh', country: 'Saudi Arabia', lat: 24.9576, lon: 46.6988 },

    // Oceania
    { iata: 'SYD', name: 'Sydney Kingsford Smith', city: 'Sydney', country: 'Australia', lat: -33.9399, lon: 151.1753 },
    { iata: 'MEL', name: 'Melbourne Airport', city: 'Melbourne', country: 'Australia', lat: -37.6690, lon: 144.8410 },
    { iata: 'BNE', name: 'Brisbane Airport', city: 'Brisbane', country: 'Australia', lat: -27.3942, lon: 153.1218 },
    { iata: 'PER', name: 'Perth Airport', city: 'Perth', country: 'Australia', lat: -31.9385, lon: 115.9672 },
    { iata: 'AKL', name: 'Auckland Airport', city: 'Auckland', country: 'New Zealand', lat: -37.0082, lon: 174.7850 },

    // South America & Africa
    { iata: 'GRU', name: 'São Paulo/Guarulhos', city: 'São Paulo', country: 'Brazil', lat: -23.4356, lon: -46.4731 },
    { iata: 'GIG', name: 'Rio de Janeiro/Galeão', city: 'Rio de Janeiro', country: 'Brazil', lat: -22.8134, lon: -43.2494 },
    { iata: 'EZE', name: 'Ministro Pistarini', city: 'Buenos Aires', country: 'Argentina', lat: -34.8222, lon: -58.5358 },
    { iata: 'BOG', name: 'El Dorado Intl', city: 'Bogotá', country: 'Colombia', lat: 4.7016, lon: -74.1469 },
    { iata: 'SCL', name: 'Arturo Merino Benítez', city: 'Santiago', country: 'Chile', lat: -33.3930, lon: -70.7858 },
    { iata: 'JNB', name: 'O. R. Tambo Intl', city: 'Johannesburg', country: 'South Africa', lat: -26.1367, lon: 28.2411 },
    { iata: 'CPT', name: 'Cape Town Intl', city: 'Cape Town', country: 'South Africa', lat: -33.9715, lon: 18.6021 },
    { iata: 'CAI', name: 'Cairo Intl', city: 'Cairo', country: 'Egypt', lat: 30.1219, lon: 31.4056 },
    { iata: 'NBO', name: 'Jomo Kenyatta Intl', city: 'Nairobi', country: 'Kenya', lat: -1.3192, lon: 36.9278 },
];

/**
 * Worldwide destination search:
 * Checks local database of major hubs first, then queries Open-Meteo Geocoding
 * for any city/location in the world.
 */
export async function searchLocations(query) {
    if (!query || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();

    // 1. Check local airports
    const localMatches = MAJOR_AIRPORTS.filter(ap =>
        ap.iata.toLowerCase().startsWith(q) ||
        ap.city.toLowerCase().includes(q) ||
        ap.name.toLowerCase().includes(q) ||
        ap.country.toLowerCase().includes(q)
    ).slice(0, 5).map(ap => ({
        title: `${ap.city} (${ap.iata})`,
        subtitle: `${ap.name}, ${ap.country}`,
        iata: ap.iata,
        city: ap.city,
        country: ap.country,
        lat: ap.lat,
        lon: ap.lon,
        isAirport: true
    }));

    // If exact IATA match found, prioritize it
    const exactIata = MAJOR_AIRPORTS.find(ap => ap.iata.toLowerCase() === q);
    if (exactIata) {
        const list = [exactIata, ...localMatches.filter(m => m.iata !== exactIata.iata)];
        return list.slice(0, 6);
    }

    // 2. Fetch live geocoding worldwide if user typed 3+ chars
    if (q.length >= 3) {
        try {
            const resp = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
            );
            if (resp.ok) {
                const data = await resp.json();
                if (data.results && data.results.length > 0) {
                    const apiMatches = data.results.map(r => ({
                        title: `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}`,
                        subtitle: `${r.country || ''} • Elevation ${r.elevation || 0}m`,
                        iata: null,
                        city: r.name,
                        country: r.country || '',
                        lat: r.latitude,
                        lon: r.longitude,
                        isAirport: false
                    }));

                    // Merge: remove duplicates near same coordinates
                    const combined = [...localMatches];
                    for (const item of apiMatches) {
                        const alreadyExists = combined.some(
                            c => Math.abs(c.lat - item.lat) < 0.3 && Math.abs(c.lon - item.lon) < 0.3
                        );
                        if (!alreadyExists) {
                            combined.push(item);
                        }
                    }
                    return combined.slice(0, 7);
                }
            }
        } catch (err) {
            console.warn('Geocoding search network error, falling back to local dataset', err);
        }
    }

    return localMatches;
}
