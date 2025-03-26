console.log("Map_1 travel.js is running!");

// -------------------
// 1) Firebase init
// -------------------
  const firebaseConfig = {
      apiKey: "AIzaSyAI25Nnbddli39RgU5482o7QPVavIFLfUs",
      authDomain: "shc-yodeck-dashboard.firebaseapp.com",
      projectId: "shc-yodeck-dashboard",
      storageBucket: "shc-yodeck-dashboard.appspot.com",
      messagingSenderId: "75263286816",
      appId: "1:75263286816:web:b22b0d1853e3daee68e645",
      measurementId: "G-07BS7GD6DK"
    };
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Where do we store travelTime in Firestore? => /Event_1/Main => field: eventETA
async function saveTravelTimeToFirestore(timeStr) {
  if (!timeStr) return;
  try {
    await db.collection("Event_1").doc("Main").set(
      { eventETA: timeStr },
      { merge: true } // so we don't overwrite other fields
    );
    console.log("Wrote eventETA to Firestore:", timeStr);
  } catch (err) {
    console.error("Error writing eventETA to Firestore:", err);
  }
}

// -------------------
// 2) Original code
// -------------------
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOJpWzhoSZ2zgH1l9DcW3gc4RsbTsRqsSCTpGuHcOAfESVohlucF8QaJ6u58wQE0UilF7ChQXhbckE/pub?output=csv";
const GOOGLE_API_KEY = "AIzaSyB4b4Ho4rNwF9hyPKCYFYXNU6dXI550M6U";
const ORIGIN_ADDRESS = "221 Corley Mill Rd, Lexington, SC 29072";

/*********************
 * Helper Functions
 *********************/
async function fetchCSV() { ... } // same parseCSV, findTodayRow, etc. from your code

function getTodayInMDYYYY() { ... }

function findTodayRow(rows) { ... }

function geocodeClientSide(address) { ... }

function formatDuration(durationStr) { ... }

function getTravelTime(originCoords, destCoords) { ... }

/**
 * Instead of localStorage.setItem("eventETA", travelTime),
 * we call saveTravelTimeToFirestore(travelTime).
 */
function updateEtaAndMap(eventData) {
  const etaEl = document.getElementById("eta");
  const mapEl = document.getElementById("mapFrame");
  if (!etaEl || !mapEl) return;

  const destAddress = eventData["Address"] + ", " +
                      eventData["City"] + ", " +
                      eventData["State"] + " " +
                      eventData["Zipcode"];

  // geocode both origin & dest
  Promise.all([
    geocodeClientSide(ORIGIN_ADDRESS),
    geocodeClientSide(destAddress)
  ]).then(([originCoords, destCoords]) => {
    if (!originCoords || !destCoords) {
      etaEl.textContent = "Address not found";
      mapEl.src = "";
      return;
    }

    // get travelTime from routes API
    getTravelTime(originCoords, destCoords)
      .then(travelTime => {
        // show on page
        etaEl.innerHTML = `
          <div class="eta-container">
            <img src="icons/travelTimeicon.png" class="eta-icon" alt="ETA Icon">
            <span class="eta-text">${travelTime}</span>
          </div>
        `;
        // *** Save to Firestore instead of localStorage ***
        saveTravelTimeToFirestore(travelTime);
      })
      .catch(err => {
        etaEl.textContent = err;
      });

    // also set the map iframe
    const googleMapsEmbedURL = "https://www.google.com/maps/embed/v1/directions?key=" + GOOGLE_API_KEY +
                               "&origin=" + encodeURIComponent(ORIGIN_ADDRESS) +
                               "&destination=" + encodeURIComponent(destAddress) +
                               "&mode=driving";
    mapEl.src = googleMapsEmbedURL;
  });
}

/**
 * init() fetches CSV, finds today's row, calls updateEtaAndMap, etc.
 */
async function init() {
  console.log("Initializing Map_1...");
  const csvText = await fetchCSV();
  const parsedRows = parseCSV(csvText);
  const todayRow = findTodayRow(parsedRows);
  if (!todayRow) {
    console.warn("No row found for today's date!");
    return;
  }
  updateEtaAndMap(todayRow);

  // If you want to refresh every 30s:
  setInterval(async () => {
    console.log("Refreshing data...");
    const newCSV = await fetchCSV();
    const newRows = parseCSV(newCSV);
    const newTodayRow = findTodayRow(newRows);
    if (!newTodayRow) {
      console.warn("No row found for today's date on refresh!");
      return;
    }
    updateEtaAndMap(newTodayRow);
  }, 30000);
}

// Expose initMap for the Google Maps callback
window.initMap = init;
