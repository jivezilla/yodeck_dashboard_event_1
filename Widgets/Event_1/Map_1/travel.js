console.log("Script is running!");

// Constants
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOJpWzhoSZ2zgH1l9DcW3gc4RsbTsRqsSCTpGuHcOAfESVohlucF8QaJ6u58wQE0UilF7ChQXhbckE/pub?output=csv";
const GOOGLE_API_KEY = "AIzaSyB4b4Ho4rNwF9hyPKCYFYXNU6dXI550M6U";
const ORIGIN_ADDRESS = "221 Corley Mill Rd, Lexington, SC 29072";

/*********************
 * Helper Functions
 *********************/

/**
 * Fetch CSV data from Google Sheets.
 */
async function fetchCSV() {
  console.log("Fetching CSV data...");
  try {
    const response = await fetch(SHEET_CSV_URL);
    const csvText = await response.text();
    console.log("CSV Fetch Successful:", csvText.substring(0, 100));
    return csvText;
  } catch (error) {
    console.error("Failed to fetch CSV:", error);
    return "";
  }
}

/**
 * Parse CSV text into an array of objects.
 */
function parseCSV(csvText) {
  const rows = [];
  let insideQuotes = false;
  let row = [];
  let cell = '';
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"' && csvText[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if (char === '\n' && !insideQuotes) {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (row.length > 0) rows.push(row);
  const headers = rows[0];
  return rows.slice(1).map(row => {
    let obj = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx] || "";
    });
    return obj;
  });
}

/**
 * Return today's date in M/D/YYYY format.
 */
function getTodayInMDYYYY() {
  const today = new Date();
  const M = today.getMonth() + 1;
  const D = today.getDate();
  const YYYY = today.getFullYear();
  return `${M}/${D}/${YYYY}`;
}

/**
 * Find the last row in the CSV data for today.
 */
function findTodayRow(rows) {
  const todayStr = getTodayInMDYYYY();
  console.log("Today's date for filtering:", todayStr);
  const matchingRows = rows.filter(r => r["Date"]?.trim() === todayStr);
  console.log("Matching rows found:", matchingRows);
  return matchingRows.length === 0 ? null : matchingRows[matchingRows.length - 1];
}

/**
 * Geocode an address using the Maps JavaScript API.
 */
function geocodeClientSide(address) {
  return new Promise(function(resolve, reject) {
    console.log("Geocoding: " + address);
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: address }, function(results, status) {
      if (status === "OK") {
        resolve(results[0].geometry.location);
      } else {
        console.error("Geocoding failed:", status);
        resolve(null);
      }
    });
  });
}

/**
 * Format a raw duration string (e.g., "165s") into a user-friendly string.
 */
function formatDuration(durationStr) {
  const seconds = parseInt(durationStr.replace(/s/i, ""), 10);
  if (isNaN(seconds)) return durationStr;
  if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return minutes + " min";
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return hours + " hr " + minutes + " min";
  }
}

/**
 * Get travel time from origin to destination using the Routes API.
 */
function getTravelTime(originCoords, destCoords) {
  return new Promise(function(resolve, reject) {
    if (!originCoords || !destCoords) {
      reject("Invalid coordinates");
      return;
    }
    const url = "https://routes.googleapis.com/directions/v2:computeRoutes?key=" + GOOGLE_API_KEY;
    const requestBody = {
      origin: { location: { latLng: { latitude: originCoords.lat(), longitude: originCoords.lng() } } },
      destination: { location: { latLng: { latitude: destCoords.lat(), longitude: destCoords.lng() } } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: false,
      routeModifiers: { avoidHighways: false, avoidTolls: false, avoidFerries: false },
      languageCode: "en-US",
      units: "IMPERIAL"
    };
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-FieldMask": "routes.duration"
      },
      body: JSON.stringify(requestBody)
    })
      .then(function(response) {
        if (!response.ok) {
          reject("Routes API request failed with status " + response.status);
          return;
        }
        return response.json();
      })
      .then(function(data) {
        if (data.routes && data.routes.length > 0) {
          const rawDuration = data.routes[0].duration;
          const formatted = formatDuration(rawDuration);
          resolve(formatted);
        } else {
          reject("No valid route found in response.");
        }
      })
      .catch(function(err) {
        reject("Routes API error: " + err);
      });
  });
}

/**
 * Update the ETA element.
 * (This function is common to both Banner and Map widgets.)
 */
function updateEta() {
  const etaEl = document.getElementById("eta");
  if (!etaEl) return;
  // (Assume that updateEtaAndMap from your working code only updates the travel time text.)
  // Here we call getTravelTime using the existing CSV data.
  // For simplicity, we'll use a hard-coded destination from CSV (if available) – adjust as needed.
  fetchCSV().then(csvText => {
    const parsedRows = parseCSV(csvText);
    const todayRow = findTodayRow(parsedRows);
    if (!todayRow) {
      etaEl.textContent = "No event today";
      return;
    }
    const destAddress = todayRow["Address"] + ", " + todayRow["City"] + ", " + todayRow["State"] + " " + todayRow["Zipcode"];
    Promise.all([ geocodeClientSide(ORIGIN_ADDRESS), geocodeClientSide(destAddress) ])
      .then(function(coordsArray) {
        const originCoords = coordsArray[0];
        const destCoords = coordsArray[1];
        if (!originCoords || !destCoords) {
          etaEl.textContent = "Address not found";
          return;
        }
        getTravelTime(originCoords, destCoords)
          .then(function(travelTime) {
            etaEl.innerHTML = '<div class="eta-container">' +
                              '<img src="icons/travelTimeicon.png" class="eta-icon" alt="ETA Icon">' +
                              '<span class="eta-text">' + travelTime + '</span>' +
                              '</div>';
            localStorage.setItem("eventETA", travelTime);
          })
          .catch(function(error) {
            etaEl.textContent = error;
          });
      });
  });
}

/*********************
 * Custom Map Initialization
 * (This is used to display the map without the directions card, zoom controls, and inset map button.)
 *********************/
function initCustomMap() {
  console.log("Initializing custom map...");
  // Fetch CSV data to determine the destination address.
  fetchCSV().then(csvText => {
    const parsedRows = parseCSV(csvText);
    const todayRow = findTodayRow(parsedRows);
    if (!todayRow) {
      console.warn("No row found for today's date!");
      return;
    }
    const destAddress = todayRow["Address"] + ", " + todayRow["City"] + ", " + todayRow["State"] + " " + todayRow["Zipcode"];
    Promise.all([ geocodeClientSide(ORIGIN_ADDRESS), geocodeClientSide(destAddress) ])
      .then(function(coordsArray) {
        const originCoords = coordsArray[0];
        const destCoords = coordsArray[1];
        if (!originCoords || !destCoords) {
          console.error("Address geocoding failed.");
          return;
        }
        // Compute center as average of origin and destination.
        const centerLat = (originCoords.lat() + destCoords.lat()) / 2;
        const centerLng = (originCoords.lng() + destCoords.lng()) / 2;
        // Create custom map with UI controls disabled.
        const mapOptions = {
          center: { lat: centerLat, lng: centerLng },
          zoom: 14,
          zoomControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: [ 
            /* Insert your custom style array here to further hide features if needed.
               For example, to hide POIs:
               { featureType: "poi", elementType: "labels", stylers: [ { visibility: "off" } ] }
            */
          ]
        };
        const mapContainer = document.getElementById("customMap");
        if (mapContainer) {
          const map = new google.maps.Map(mapContainer, mapOptions);
          // (Optionally, if you want to display the route polyline using the Routes API,
          // you would call that API and decode/display the polyline on this map.)
        } else {
          console.error("Custom map container not found!");
        }
      });
  });
}

/*********************
 * MAIN INIT
 *********************/
async function init() {
  console.log("Initializing event dashboard...");
  // Update ETA (travel time) display.
  updateEta();
  
  // For Map_1, initialize the custom map.
  initCustomMap();
  
  // Optional: set up periodic refresh for ETA updates.
  setInterval(() => {
    console.log("Refreshing ETA...");
    updateEta();
  }, 30000);
}

// Hook the custom map initializer into the Google Maps API callback.
window.initMap = init;
window.geocodeClientSide = geocodeClientSide;
