console.log("Script is running!");

// script.js for SHC Event Dashboard
// Finds the LAST row matching today's date in the "Date" column.

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOJpWzhoSZ2zgH1l9DcW3gc4RsbTsRqsSCTpGuHcOAfESVohlucF8QaJ6u58wQE0UilF7ChQXhbckE/pub?output=csv";

/*****************************************************
 * FETCH & PARSE CSV
 *****************************************************/

async function fetchCSV() {
  console.log("Fetching CSV data...");
  try {
    const response = await fetch(SHEET_CSV_URL);
    const csvText = await response.text();
    console.log("CSV Fetch Successful:", csvText.substring(0, 100)); // Show first 100 chars
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
      cell += '"';  // Handle escaped quotes ("" -> ")
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
  
  if (row.length > 0) {
    rows.push(row);
  }

  // Convert array to objects using headers
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
  const M = today.getMonth() + 1; // No leading zero
  const D = today.getDate();      // No leading zero
  const YYYY = today.getFullYear();
  return `${M}/${D}/${YYYY}`;
}

/*****************************************************
 * FIND LAST ROW FOR TODAY
 *****************************************************/

function findTodayRow(rows) {
  const todayStr = getTodayInMDYYYY();
  console.log("Today's date for filtering:", todayStr);

  // Filter to get all rows matching today's date.
  const matchingRows = rows.filter(r => r["Date"]?.trim() === todayStr);
  console.log("Matching rows found:", matchingRows);

  // Return the LAST one if it exists.
  return matchingRows.length === 0 ? null : matchingRows[matchingRows.length - 1];
}

/*****************************************************
 * RENDER STATIC DATA
 *****************************************************/

function renderData(eventData) {
  const eventName = eventData["Event Name"] || "(No event name)";
  const guestCount = eventData["Guest Count"] || "0";
  const endTime = eventData["Event Conclusion/Breakdown Time"] || "TBD";

  document.getElementById("eventNameValue").textContent = eventName;
  document.getElementById("guestCountValue").textContent = guestCount;
  document.getElementById("endTimeValue").textContent = endTime;
}

/*****************************************************
 * DEPARTURE TIME CALCULATION FUNCTIONS
 *****************************************************/

/**
 * Determine the event start time from candidate columns.
 * Priority:
 *   1. If "Event Start Time" is present, use it.
 *   2. Otherwise, consider the earliest among:
 *      "Meal Service Start Time", "Cocktail Hour Start Time", and "Passed Hors D'oeuvres Time Start".
 *      Special rule: if Cocktail Hour is the earliest and "Passed Hors D'oeuvres" equals "yes",
 *      then use that value.
 */
function determineEventStartTime(row) {
  if (row["Event Start Time"] && row["Event Start Time"].trim() !== "") {
    return new Date(row["Event Start Time"]);
  }
  const candidates = [];
  if (row["Meal Service Start Time"] && row["Meal Service Start Time"].trim() !== "") {
    candidates.push({ time: new Date(row["Meal Service Start Time"]), source: "Meal Service Start Time" });
  }
  if (row["Cocktail Hour Start Time"] && row["Cocktail Hour Start Time"].trim() !== "") {
    candidates.push({ time: new Date(row["Cocktail Hour Start Time"]), source: "Cocktail Hour Start Time" });
  }
  if (row["Passed Hors D'oeuvres Time Start"] && row["Passed Hors D'oeuvres Time Start"].trim() !== "") {
    candidates.push({ time: new Date(row["Passed Hors D'oeuvres Time Start"]), source: "Passed Hors D'oeuvres Time Start" });
  }
  if (candidates.length === 0) {
    return null;
  }
  // Sort candidates by time (earliest first)
  candidates.sort((a, b) => a.time - b.time);
  // Special rule for Cocktail Hour and Passed Hors D'oeuvres:
  if (candidates[0].source === "Cocktail Hour Start Time" &&
      row["Passed Hors D'oeuvres"] &&
      row["Passed Hors D'oeuvres"].toLowerCase() === "yes") {
    return candidates[0].time;
  }
  return candidates[0].time;
}

/**
 * Parse a formatted travel time string (e.g., "1 hr 5 min" or "3 min") into total minutes.
 */
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

/**
 * Calculate Departure Time using:
 * Departure Time = Event Start Time - (2hr baseline (120 min) + Travel Time + Base Buffer (5 min) + Extra Guest Buffer)
 * Extra Guest Buffer: 15 minutes per 50 guests above 100.
 */
function calculateDepartureTime(eventStartTime, travelTimeStr, guestCount, baseBuffer) {
  baseBuffer = baseBuffer || 5; // Default to 5 minutes.
  const travelMinutes = parseTravelTime(travelTimeStr);
  const baseline = 120; // 2 hours = 120 minutes.
  let extraGuestBuffer = 0;
  if (guestCount > 100) {
    extraGuestBuffer = 15 * Math.ceil((guestCount - 100) / 50);
  }
  const totalSubtract = baseline + travelMinutes + baseBuffer + extraGuestBuffer;
  return new Date(eventStartTime.getTime() - totalSubtract * 60000);
}

/**
 * Update the Departure Time display using the computed departure time.
 */
function updateDepartureTimeDisplay(eventData) {
  const eventStartTime = determineEventStartTime(eventData);
  if (!eventStartTime) {
    console.error("No valid event start time found.");
    return;
  }
  const travelTime = localStorage.getItem("eventETA"); // e.g., "1 hr 5 min"
  if (!travelTime) {
    console.error("No travel time available.");
    return;
  }
  const guestCount = parseInt(eventData["Guest Count"], 10) || 0;
  const departureTime = calculateDepartureTime(eventStartTime, travelTime, guestCount, 5);
  const formattedDepartureTime = departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  document.getElementById("departureTimeValue").textContent = "Leave by: " + formattedDepartureTime;
}

/*****************************************************
 * MAIN INIT
 *****************************************************/

async function init() {
  console.log("Initializing event dashboard...");

  const csvText = await fetchCSV();
  const parsedRows = parseCSV(csvText);

  // Find today's event row.
  const todayRow = findTodayRow(parsedRows);

  if (!todayRow) {
    console.warn("No row found for today's date!");
    return;
  }

  // Render static data.
  renderData(todayRow);
  // Compute and update departure time.
  updateDepartureTimeDisplay(todayRow);

  // Auto-refresh every 30 seconds.
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
}

init();
