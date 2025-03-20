// script.js for SHC Event Dashboard
// This version finds the LAST row matching today's date in the "Event Date" column.

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOJpWzhoSZ2zgH1l9DcW3gc4RsbTsRqsSCTpGuHcOAfESVohlucF8QaJ6u58wQE0UilF7ChQXhbckE/pub?output=csv";

/*****************************************************
 * FETCH & PARSE CSV
 *****************************************************/

async function fetchCSV() {
  try {
    const response = await fetch(SHEET_CSV_URL);
    const csvText = await response.text();
    return csvText;
  } catch (error) {
    console.error("Failed to fetch CSV:", error);
    return "";
  }
}

function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");
  const headers = lines[0].split(",").map(h => h.trim());
  const dataRows = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cells = lines[i].split(",");
    const rowObj = {};
    headers.forEach((header, idx) => {
      rowObj[header] = (cells[idx] || "").trim();
    });
    dataRows.push(rowObj);
  }
  return dataRows;
}

/*****************************************************
 * HELPER: Today in MM/DD/YYYY
 *****************************************************/

function getTodayInMMDDYYYY() {
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, '0'); // e.g. '03'
  const dd = String(today.getDate()).padStart(2, '0');      // e.g. '19'
  const yyyy = today.getFullYear();
  return `${mm}/${dd}/${yyyy}`; // e.g. '03/19/2025'
}

/*****************************************************
 * FIND LAST ROW FOR TODAY
 *****************************************************/

function findTodayRow(rows) {
  const todayStr = getTodayInMMDDYYYY();
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
  // Adjust these keys as needed to match your actual columns
  const eventName = eventData["Event Name"] || "(No event name)";
  const guestCount = eventData["Guest Count"] || "0";
  const departureTime = eventData["Departure Time"] || "TBD";
  const endTime = eventData["End Time"] || "TBD";

  document.getElementById("eventNameValue").textContent = eventName;
  document.getElementById("guestCountValue").textContent = guestCount;
  document.getElementById("departureTimeValue").textContent = departureTime;
  document.getElementById("endTimeValue").textContent = endTime;
}

/*****************************************************
 * MAIN INIT
 *****************************************************/

async function init() {
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
