console.log("Script is running!");

// script.js for SHC Event Dashboard

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
      insideQuotes = !insideQuotes;  // Toggle quotes flag
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

  // Filter to get all rows matching today's date in the "Date" column.
  const matchingRows = rows.filter(r => r["Date"]?.trim() === todayStr);
  console.log("Matching rows found:", matchingRows);

  // Return the LAST one if it exists
  if (matchingRows.length === 0) {
    return null;
  } else {
    return matchingRows[matchingRows.length - 1];
  }
}

/*****************************************************
 * DEPARTURE TIME CALCULATIONS
 *****************************************************/

/**
 * Determine the event start time from the row.
 * Priority:
 *   - If "Event Start Time" is provided (non-empty), use it.
 *   - Otherwise, consider "Meal Service Start Time", "Cocktail Hour Start Time",
 *     and "Passed Hors D'oeuvres Time Start" (if provided) and pick the earliest.
 *   - Special: If the earliest candidate is "Cocktail Hour Start Time" and
 *     "Passed Hors D'oeuvres" equals "yes" (case-insensitive), use it.
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
  
  if (candidates.length === 0) return null;
  
  candidates.sort((a, b) => a.time - b.time);
  
  if (candidates[0].source === "Cocktail Hour Start Time" &&
      row["Passed Hors D'oeuvres"] && row["Passed Hors D'oeuvres"].toLowerCase() === "yes") {
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
 * Calculate the departure time.
 * Equation:
 *   Departure Time = Event Start Time - (Baseline 2hr + Travel Time + Base Buffer (5 min) + Extra Guest Buffer)
 * Extra Guest Buffer: 15 minutes per 50 guests after 100.
 */
function calculateDepartureTime(eventStartTime, travelTimeStr, guestCount, baseBuffer = 5) {
  const travelMinutes = parseTravelTime(travelTimeStr);
  const baseline = 120; // 2 hours = 120 minutes
  let extraGuestBuffer = 0;
  const count = parseInt(guestCount, 10);
  if (count > 100) {
    extraGuestBuffer = 15 * Math.ceil((count - 100) / 50);
  }
  const totalSubtract = baseline + travelMinutes + baseBuffer + extraGuestBuffer;
  return new Date(eventStartTime.getTime() - totalSubtract * 60000);
}

/*****************************************************
 * RENDER DATA & DEPARTURE TIME
 *****************************************************/

function renderData(eventData) {
  const eventName = eventData["Event Name"] || "(No event name)";
  const guestCount = eventData["Guest Count"] || "0";
  const endTime = eventData["Event Conclusion/Breakdown Time"] || "TBD";

  document.getElementById("eventNameValue").textContent = eventName;
  document.getElementById("guestCountValue").textContent = guestCount;
  document.getElementById("endTimeValue").textContent = endTime;
  
  // Now calculate departure time using our formula.
  const eventStartTime = determineEventStartTime(eventData);
  if (!eventStartTime) {
    document.getElementById("departureTimeValue").textContent = "TBD (No valid event start time)";
    return;
  }
  
  // Read travel time from localStorage (updated by the travel dashboard)
  const travelTime = localStorage.getItem("eventETA"); // e.g., "1 hr 5 min"
  if (!travelTime) {
    document.getElementById("departureTimeValue").textContent = "TBD (No travel time)";
    return;
  }
  
  const departureTime = calculateDepartureTime(eventStartTime, travelTime, guestCount, 5);
  const formattedDepartureTime = departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  document.getElementById("departureTimeValue").textContent = "Leave by: " + formattedDepartureTime;
}

/*****************************************************
 * MAIN INIT & AUTO-REFRESH
 *****************************************************/

async function init() {
  console.log("Initializing event dashboard...");

  const csvText = await fetchCSV();
  const parsedRows = parseCSV(csvText);

  // Find today's event row
  const todayRow = findTodayRow(parsedRows);
  if (!todayRow) {
    console.warn("No row found for today's date!");
    return;
  }

  // Render the data and calculate departure time
  renderData(todayRow);

  // Auto-refresh every 30 seconds
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
  }, 30000);
}

init();
