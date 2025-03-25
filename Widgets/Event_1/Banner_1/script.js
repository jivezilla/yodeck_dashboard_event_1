console.log("Script is running!");

// Constants
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOJpWzhoSZ2zgH1l9DcW3gc4RsbTsRqsSCTpGuHcOAfESVohlucF8QaJ6u58wQE0UilF7ChQXhbckE/pub?output=csv";
const ORIGIN_ADDRESS = "221 Corley Mill Rd, Lexington, SC 29072";

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
  let cell = "";
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"' && csvText[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n" && !insideQuotes) {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (row.length > 0) rows.push(row);

  const headers = rows[0];
  return rows.slice(1).map((row) => {
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
  const matchingRows = rows.filter((r) => r["Date"]?.trim() === todayStr);
  console.log("Matching rows found:", matchingRows);
  return matchingRows.length === 0 ? null : matchingRows[matchingRows.length - 1];
}

/*****************************************************
 * RENDER STATIC DATA
 *****************************************************/
function renderData(eventData) {
  const combinedName =
    (eventData["Event Name"] || "(No event name)") +
    " | " +
    (eventData["Venue Name"] || "(No venue)");
  const guestCount = eventData["Guest Count"] || "0";
  let endTime = eventData["Event Conclusion/Breakdown Time"] || "TBD";
  if (endTime !== "TBD") {
    // remove ":00 " e.g. "9:30:00 PM" -> "9:30 PM"
    endTime = endTime.replace(/:00(\s*[AP]M)/i, "$1");
  }
  document.getElementById("eventNameValue").textContent = combinedName;
  document.getElementById("guestCountValue").textContent = guestCount;
  document.getElementById("endTimeValue").textContent = endTime;
}

/*****************************************************
 * DEPARTURE TIME CALCULATION
 *****************************************************/
function determineEventStartTime(row) {
  let startTimeStr = row["Event Start Time"]?.trim();
  if (startTimeStr) {
    // If no date portion, prepend today's date
    if (!/[\d\/-]/.test(startTimeStr.split(" ")[0])) {
      startTimeStr = getTodayInMDYYYY() + " " + startTimeStr;
    }
    const dt = new Date(startTimeStr);
    if (!isNaN(dt.getTime())) {
      return dt;
    }
  }
  // If no "Event Start Time," check Meal Service, Cocktail, etc.
  const candidates = [];
  if (row["Meal Service Start Time"]?.trim()) {
    candidates.push({
      time: new Date(getTodayInMDYYYY() + " " + row["Meal Service Start Time"].trim()),
      source: "Meal Service Start Time",
    });
  }
  if (row["Cocktail Hour Start Time"]?.trim()) {
    candidates.push({
      time: new Date(getTodayInMDYYYY() + " " + row["Cocktail Hour Start Time"].trim()),
      source: "Cocktail Hour Start Time",
    });
  }
  if (row["Passed Hors D'oeuvres Time Start"]?.trim()) {
    candidates.push({
      time: new Date(getTodayInMDYYYY() + " " + row["Passed Hors D'oeuvres Time Start"].trim()),
      source: "Passed Hors D'oeuvres Time Start",
    });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.time - b.time);

  // If earliest is Cocktail Hour & "Passed Hors D'oeuvres" is "yes," pick that
  if (
    candidates[0].source === "Cocktail Hour Start Time" &&
    row["Passed Hors D'oeuvres"] &&
    row["Passed Hors D'oeuvres"].toLowerCase() === "yes"
  ) {
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
  const baseline = 120; // baseline 2hr
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
  const formattedDepartureTime = departureTime.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
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
  // Update the Banner fields
  renderData(todayRow);
  updateDepartureTimeDisplay(todayRow);

  // Periodic refresh
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

  // Also set up ETA
  updateEta();
}

/**
 * Update the ETA element using the Routes API
 * (If you want to display the travel time in an h2 with id="eta")
 */
function updateEta() {
  const etaEl = document.getElementById("eta");
  if (!etaEl) return; // remove or ignore if you don't want an #eta element
  fetchCSV().then((csvText) => {
    const parsedRows = parseCSV(csvText);
    const todayRow = findTodayRow(parsedRows);
    if (!todayRow) {
      etaEl.textContent = "No event today";
      return;
    }
    const destAddress =
      todayRow["Address"] + ", " + todayRow["City"] + ", " + todayRow["State"] + " " + todayRow["Zipcode"];
    Promise.all([geocodeClientSide(ORIGIN_ADDRESS), geocodeClientSide(destAddress)]).then(function (coordsArray) {
      const originCoords = coordsArray[0];
      const destCoords = coordsArray[1];
      if (!originCoords || !destCoords) {
        etaEl.textContent = "Address not found";
        return;
      }
      getTravelTime(originCoords, destCoords)
        .then(function (travelTime) {
          etaEl.innerHTML =
            '<div class="eta-container">' +
            '<img src="icons/travelTimeicon.png" style="width:50px;height:auto;vertical-align:middle;" alt="ETA Icon" />' +
            '<span class="eta-text" style="font-size:40px;margin-left:8px;vertical-align:middle;">' +
            travelTime +
            "</span>" +
            "</div>";
          localStorage.setItem("eventETA", travelTime);
        })
        .catch(function (error) {
          etaEl.textContent = error;
        });
    });
  });
}

/*****************************************************
 * Google Maps placeholders, if needed
 *****************************************************/
function geocodeClientSide(address) {
  return new Promise(function (resolve) {
    console.log("Geocoding: " + address);
    // If you have a google.maps.Geocoder call, do it here.
    // For now, you might need some placeholder or remove references if you're not using a map.
    // e.g.:
    resolve({ lat: () => 34.0, lng: () => -81.0 });
  });
}
function getTravelTime(originCoords, destCoords) {
  return new Promise(function (resolve) {
    // dummy:  "27 min"
    resolve("27 min");
  });
}

// If you had a real google geocode / routes call, put it back here.
// Expose needed calls globally if required.
window.initMap = init; // If you need a Google callback
