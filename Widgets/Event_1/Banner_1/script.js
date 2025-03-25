console.log("Script is running!");

// Constants
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOJpWzhoSZ2zgH1l9DcW3gc4RsbTsRqsSCTpGuHcOAfESVohlucF8QaJ6u58wQE0UilF7ChQXhbckE/pub?output=csv";

/*****************************************************
 * FETCH & PARSE CSV
 *****************************************************/
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

/*****************************************************
 * HELPER: Today in M/D/YYYY
 *****************************************************/
function getTodayInMDYYYY() {
  const today = new Date();
  const M = today.getMonth() + 1;
  const D = today.getDate();
  const YYYY = today.getFullYear();
  return `${M}/${D}/${YYYY}`;
}

/*****************************************************
 * FIND LAST ROW FOR TODAY
 *****************************************************/
function findTodayRow(rows) {
  const todayStr = getTodayInMDYYYY();
  console.log("Today's date for filtering:", todayStr);
  const matchingRows = rows.filter(r => r["Date"]?.trim() === todayStr);
  console.log("Matching rows found:", matchingRows);
  return matchingRows.length === 0 ? null : matchingRows[matchingRows.length - 1];
}

/*****************************************************
 * RENDER STATIC DATA
 *****************************************************/
function renderData(eventData) {
  const combinedName = (eventData["Event Name"] || "(No event name)") +
                       " | " + (eventData["Venue Name"] || "(No venue)");
  const guestCount = eventData["Guest Count"] || "0";
  let endTime = eventData["Event Conclusion/Breakdown Time"] || "TBD";
  if (endTime !== "TBD") {
    endTime = endTime.replace(/:00(\s*[AP]M)/i, "$1");
  }
  document.getElementById("eventNameValue").textContent = combinedName;
  document.getElementById("guestCountValue").textContent = guestCount;
  document.getElementById("endTimeValue").textContent = endTime;
}

/*****************************************************
 * DEPARTURE TIME CALCULATION FUNCTIONS
 *****************************************************/
function determineEventStartTime(row) {
  let startTimeStr = row["Event Start Time"]?.trim();
  if (startTimeStr) {
    if (!/[\d\/-]/.test(startTimeStr.split(" ")[0])) {
      startTimeStr = getTodayInMDYYYY() + " " + startTimeStr;
    }
    const dt = new Date(startTimeStr);
    if (!isNaN(dt.getTime())) {
      return dt;
    }
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
  if (candidates.length === 0) {
    return null;
  }
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
  if (hrMatch) {
    totalMinutes += parseInt(hrMatch[1], 10) * 60;
  }
  const minMatch = travelTimeStr.match(/(\d+)\s*min/);
  if (minMatch) {
    totalMinutes += parseInt(minMatch[1], 10);
  }
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
  document.getElementById("departureTimeValue").textContent = formattedDepartureTime;
}

/*****************************************************
 * MAIN INIT
 *****************************************************/
async function init() {
  console.log("Initializing event dashboard...");
  const csvText = await fetchCSV();
  const parsedRows = parseCSV(csvText);
  const todayRow = findTodayRow(parsedRows);
  if (!todayRow) {
    console.warn("No row found for today's date!");
    return;
  }
  renderData(todayRow);
  updateDepartureTimeDisplay(todayRow);
  
  setInterval(async () => {
    console.log("Refreshing data...");
    const newCSV = await fetchCSV();
    const newRows = parseCSV(newCSV);
    const newTodayRow = findTodayRow(newRows);
    if (!newTodayRow) {
      console.warn("No row found for today's date on refresh!");
      return;
    }
    renderData(newTodayRow);
    updateDepartureTimeDisplay(newTodayRow);
  }, 30000);
  
  // Also update the travel time (ETA) display.
  updateEta();
}

/**
 * Update the ETA element using the Routes API.
 */
function updateEta() {
  const etaEl = document.getElementById("eta");
  if (!etaEl) return;
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
            // Use the correct path for the travel time icon (in the same folder as index.html)
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

init();

// Expose necessary functions globally.
window.initMap = init;
window.geocodeClientSide = geocodeClientSide;
