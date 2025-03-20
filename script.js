console.log("Script is running!");

// script.js for SHC Event Dashboard
// This version finds the LAST row matching today's date in the "Event Date" column.

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
  // Filter to get all rows matching today's date.
  const matchingRows = rows.filter(r => r["Event Date"] === todayStr);

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
  console.log("Rendering event data:", eventData);

  document.getElementById("eventNameValue").textContent = eventData["Event Name"] || "(No event name)";
  document.getElementById("guestCountValue").textContent = eventData["Guest Count"] || "0";
  document.getElementById("departureTimeValue").textContent = eventData["Departure Time"] || "TBD";
  document.getElementById("endTimeValue").textContent = eventData["End Time"] || "TBD";
}

/*****************************************************
 * MAIN INIT
 *****************************************************/

async function init() {
  console.log("Today's row data:", todayRow
  const csvText = await fetchCSV();
  const parsedRows = parseCSV(csvText);

  // Filter for the LAST row that matches today's date
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
  }, 30_000);
}

init();
);
