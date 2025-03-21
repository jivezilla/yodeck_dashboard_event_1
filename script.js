console.log("Script is running!");

// script.js for SHC Event Dashboard
// Finds the LAST row matching today's date in the "Event Date" column.

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

  // Filter to get all rows matching today's date.
  const matchingRows = rows.filter(r => r["Date"]?.trim() === todayStr);

  // Log matching rows for debugging
  console.log("Matching rows found:", matchingRows);

  // Return the LAST one if it exists
  if (matchingRows.length === 0) {
    return null;
  } else {
    return matchingRows[matchingRows.length - 1];
  }
}

/*****************************************************
 * RENDER DATA
 *****************************************************/

function renderData(eventData) {
  const eventName = eventData["Event Name"] || "(No event name)";
  const guestCount = eventData["Guest Count"] || "0";
  const departureTime = eventData["Departure Time"] || "TBD";
  const endTime = eventData["Event Conclusion/Breakdown Time"] || "TBD"; // fixed here

  document.getElementById("eventNameValue").textContent = eventName;
  document.getElementById("guestCountValue").textContent = guestCount;
  document.getElementById("departureTimeValue").textContent = departureTime;
  document.getElementById("endTimeValue").textContent = endTime;
}


/*****************************************************
 * MAIN INIT
 *****************************************************/

async function init() {
  console.log("Initializing event dashboard...");

  const csvText = await fetchCSV();
  const parsedRows = parseCSV(csvText);

  // Find today's event
  const todayRow = findTodayRow(parsedRows);

  if (!todayRow) {
    console.warn("No row found for today's date!");
    return;
  }

  // Render that row
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
