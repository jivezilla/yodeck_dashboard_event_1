// Your published CSV URL (from your message):
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOJpWzhoSZ2zgH1l9DcW3gc4RsbTsRqsSCTpGuHcOAfESVohlucF8QaJ6u58wQE0UilF7ChQXhbckE/pub?output=csv";

// STEP 1: Fetch the CSV
async function fetchSheetData() {
  try {
    const response = await fetch(SHEET_CSV_URL);
    const csvText = await response.text();
    return parseCSV(csvText);
  } catch (error) {
    console.error("Error fetching sheet data:", error);
    return [];
  }
}

// STEP 2: Parse the CSV into an array of objects
function parseCSV(csvText) {
  const lines = csvText.split("\n").map(line => line.trim());
  const headers = lines[0].split(",").map(h => h.trim());

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue; // skip empty lines
    const rowData = {};
    const cells = lines[i].split(",");
    headers.forEach((header, idx) => {
      // Some cells might have commas inside quotes, so you might want a more robust CSV parser
      // but for a minimal approach, this often works if your form data doesn't contain messy commas
      rowData[header] = (cells[idx] || "").trim();
    });
    data.push(rowData);
  }
  return data;
}

// STEP 3: Render the relevant columns on the page
function renderEvents(events) {
  const container = document.getElementById("events-container");
  container.innerHTML = "";

  // We'll just loop over each "row" from the CSV
  // and display whichever columns you want:
  events.forEach((ev) => {
    // Example columns we care about:
    const eventName = ev["Event Name"] || "N/A";
    const date = ev["Date"] || "N/A";
    const startTime = ev["Event Start Time"] || "N/A";
    const breakdownTime = ev["Event Conclusion/Breakdown Time"] || "N/A";
    const venueName = ev["Venue Name"] || "N/A";
    const guestCount = ev["Guest Count"] || "N/A";
    const otherDetails = ev["Other Details"] || "";

    // Build an HTML block
    const div = document.createElement("div");
    div.classList.add("event");

    div.innerHTML = `
      <h2>${eventName}</h2>
      <p><strong>Date:</strong> ${date}</p>
      <p><strong>Start Time:</strong> ${startTime}</p>
      <p><strong>Breakdown Time:</strong> ${breakdownTime}</p>
      <p><strong>Venue Name:</strong> ${venueName}</p>
      <p><strong>Guest Count:</strong> ${guestCount}</p>
      <p><strong>Other Details:</strong> ${otherDetails}</p>
    `;
    container.appendChild(div);
  });
}

// STEP 4: Initialize
async function init() {
  const data = await fetchSheetData();
  // You can filter or sort 'data' if needed (e.g., only show events for today)

  renderEvents(data);

  // If you want it to auto-refresh every X minutes:
  setInterval(async () => {
    const updatedData = await fetchSheetData();
    renderEvents(updatedData);
  }, 300000); // 300000 ms = 5 minutes
}

// Kick off the script
init();
