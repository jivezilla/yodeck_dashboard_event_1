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
 * Get travel time from origin to destination using the new Routes API.
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
 * Update the ETA and Map.
 */
function updateEtaAndMap(eventData) {
  const etaEl = document.getElementById("eta");
  const mapEl = document.getElementById("mapFrame");
  if (!etaEl || !mapEl) return;
  const destAddress = eventData["Address"] + ", " + eventData["City"] + ", " + eventData["State"] + " " + eventData["Zipcode"];
  Promise.all([ geocodeClientSide(ORIGIN_ADDRESS), geocodeClientSide(destAddress) ])
    .then(function(coordsArray) {
      const originCoords = coordsArray[0];
      const destCoords = coordsArray[1];
      if (!originCoords || !destCoords) {
        etaEl.textContent = "Address not found";
        mapEl.src = "";
        return;
      }
      getTravelTime(originCoords, destCoords)
        .then(function(travelTime) {
          // Ensure the icon filename matches exactly; adjust if necessary.
          etaEl.innerHTML = '<div class="eta-container">' +
                            '<img src="icons/travelTimeicon.png" class="eta-icon" alt="ETA Icon">' +
                            '<span class="eta-text">' + travelTime + '</span>' +
                            '</div>';
          localStorage.setItem("eventETA", travelTime);
        })
        .catch(function(error) {
          etaEl.textContent = error;
        });
      const googleMapsEmbedURL = "https://www.google.com/maps/embed/v1/directions?key=" + GOOGLE_API_KEY +
                                 "&origin=" + encodeURIComponent(ORIGIN_ADDRESS) +
                                 "&destination=" + encodeURIComponent(destAddress) +
                                 "&mode=driving";
      mapEl.src = googleMapsEmbedURL;
    });
}

/**
 * Render static data for Banner widget.
 */
function renderData(eventData) {
  const eventNameEl = document.getElementById("eventNameValue");
  const guestCountEl = document.getElementById("guestCountValue");
  const endTimeEl = document.getElementById("endTimeValue");
  
  if (eventNameEl) {
    const combinedName = (eventData["Event Name"] || "(No event name)") +
                         " | " + (eventData["Venue Name"] || "(No venue)");
    eventNameEl.textContent = combinedName;
  }
  if (guestCountEl) {
    guestCountEl.textContent = eventData["Guest Count"] || "0";
  }
  if (endTimeEl) {
    let endTime = eventData["Event Conclusion/Breakdown Time"] || "TBD";
    if (endTime !== "TBD") {
      endTime = endTime.replace(/:00(\s*[AP]M)/i, "$1");
    }
    endTimeEl.textContent = endTime;
  }
}

/**
 * Calculate the departure time for Banner widget.
 */
function determineEventStartTime(row) {
  let startTimeStr = row["Event Start Time"]?.trim();
  if (startTimeStr) {
    if (!/[\d\/-]/.test(startTimeStr.split(" ")[0])) {
      startTimeStr = getTodayInMDYYYY() + " " + startTimeStr;
    }
    const dt = new Date(startTimeStr);
    if (!isNaN(dt.getTime())) return dt;
  }
  const candidates = [];
  if (row["Meal Service Start Time"]?.trim()) {
    candidates.push({ time: new Date(getTodayInMDYYYY() + " " + row["Meal Service Start Time"].trim()), source: "Meal Service Start Time" });
  }
  if (row["Cocktail Hour Start Time"]?.trim()) {
    candidates.push({ time: new Date(getTodayInMDYYYY() + " " + row["Cocktail Hour Start Time"].trim()), source: "Cocktail Hour Start Time" });
  }
  if (row["Passed Hors D'oeuvres Time Start"]?.trim()) {
    candidates.push({ time: new Date(getTodayInMDYYYY() + " " + row["Passed Hors D'oeuvres Time Start"].trim()), source: "Passed Hors D'oeuvres Time Start" });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.time - b.time);
  if (candidates[0].source === "Cocktail Hour Start Time" &&
      row["Passed Hors D'oeuvres"] &&
      row["Passed Hors D'oeuvres"].toLowerCase() === "yes") {
    return candidates[0].time;
  }
  return candidates[0].time;
}

function parseTravelTime(travelTimeStr) {
  let totalMinutes = 0;
  const hrMatch = travelTimeStr.match(/(\d+)\s*hr/);
  if (hrMatch) totalMinutes += parseInt(hrMatch[1], 10) * 60;
  const minMatch = travelTimeStr.match(/(\d+)\s*min/);
  if (minMatch) totalMinutes += parseInt(minMatch[1], 10);
  return totalMinutes;
}

function calculateDepartureTime(eventStartTime, travelTimeStr, guestCount, baseBuffer) {
  baseBuffer = baseBuffer || 5;
  const travelMinutes = parseTravelTime(travelTimeStr);
  const baseline = 120;
  let extraGuestBuffer = 0;
  if (guestCount > 100) {
    extraGuestBuffer = 15 * Math.ceil((guestCount - 100) / 50);
  }
  const totalSubtract = baseline + travelMinutes + baseBuffer + extraGuestBuffer;
  return new Date(eventStartTime.getTime() - totalSubtract * 60000);
}

function updateDepartureTimeDisplay(eventData) {
  const departureTimeEl = document.getElementById("departureTimeValue");
  if (!departureTimeEl) return;
  const eventStartTime = determineEventStartTime(eventData);
  if (!eventStartTime) {
    console.error("No valid event start time found.");
    return;
  }
  const travelTime = localStorage.getItem("eventETA");
  if (!travelTime) {
    console.error("No travel time available.");
    return;
  }
  const guestCount = parseInt(eventData["Guest Count"], 10) || 0;
  const departureTime = calculateDepartureTime(eventStartTime, travelTime, guestCount, 5);
  const formattedDepartureTime = departureTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  departureTimeEl.textContent = formattedDepartureTime;
}

/*********************
 * MAIN INIT
 *********************/
async function init() {
  console.log("Initializing event dashboard...");
  const csvText = await fetchCSV();
  const parsedRows = parseCSV(csvText);
  const todayRow = findTodayRow(parsedRows);
  if (!todayRow) {
    console.warn("No row found for today's date!");
    return;
  }
  // Banner-specific updates (if elements exist)
  if (document.getElementById("eventNameValue")) renderData(todayRow);
  if (document.getElementById("departureTimeValue")) updateDepartureTimeDisplay(todayRow);
  // Common ETA & Map update
  updateEtaAndMap(todayRow);

  setInterval(async () => {
    console.log("Refreshing data...");
    const newCSV = await fetchCSV();
    const newRows = parseCSV(newCSV);
    const newTodayRow = findTodayRow(newRows);
    if (!newTodayRow) {
      console.warn("No row found for today's date on refresh!");
      return;
    }
    if (document.getElementById("eventNameValue")) renderData(newTodayRow);
    if (document.getElementById("departureTimeValue")) updateDepartureTimeDisplay(newTodayRow);
    updateEtaAndMap(newTodayRow);
  }, 30000);
}

// Ensure global functions are accessible for the Google Maps callback.
window.initMap = init;
window.geocodeClientSide = geocodeClientSide;
