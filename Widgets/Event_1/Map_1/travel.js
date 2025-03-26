console.log("Map_1 travel.js is running!");

// -------------------
// 1) Firebase Initialization (Compat)
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

// -------------------
// 2) Firestore helper: Save travelTime (eventETA)
// -------------------
async function saveTravelTimeToFirestore(timeStr) {
  if (!timeStr) return;
  try {
    await db.collection("Event_1").doc("Main").set(
      { eventETA: timeStr },
      { merge: true }
    );
    console.log("Saved eventETA to Firestore:", timeStr);
  } catch (err) {
    console.error("Error saving eventETA to Firestore:", err);
  }
}

// -------------------
// 3) Original travel.js code
// -------------------
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSOJpWzhoSZ2zgH1l9DcW3gc4RsbTsRqsSCTpGuHcOAfESVohlucF8QaJ6u58wQE0UilF7ChQXhbckE/pub?output=csv";
const ORIGIN_ADDRESS = "221 Corley Mill Rd, Lexington, SC 29072";
// GOOGLE_API_KEY is already defined in the URL of the Maps API above.

// (Include your helper functions: fetchCSV, parseCSV, getTodayInMDYYYY, findTodayRow, geocodeClientSide, formatDuration, getTravelTime)
// For brevity, I assume these functions remain unchanged from your provided travel.js code.

// -------------------
// 4) Update ETA and Map, now saving travelTime to Firestore instead of localStorage
// -------------------
function updateEtaAndMap(eventData) {
  const etaEl = document.getElementById("eta");
  const mapEl = document.getElementById("mapFrame");
  if (!etaEl || !mapEl) return;
  const destAddress = eventData["Address"] + ", " +
                      eventData["City"] + ", " +
                      eventData["State"] + " " +
                      eventData["Zipcode"];

  Promise.all([
    geocodeClientSide(ORIGIN_ADDRESS),
    geocodeClientSide(destAddress)
  ]).then(function(coordsArray) {
    const originCoords = coordsArray[0];
    const destCoords = coordsArray[1];
    if (!originCoords || !destCoords) {
      etaEl.textContent = "Address not found";
      mapEl.src = "";
      return;
    }
    getTravelTime(originCoords, destCoords)
      .then(function(travelTime) {
        etaEl.innerHTML = '<div class="eta-container">' +
                          '<img src="icons/travelTimeicon.png" class="eta-icon" alt="ETA Icon">' +
                          '<span class="eta-text">' + travelTime + '</span>' +
                          '</div>';
        // Save travelTime (eventETA) to Firestore
        saveTravelTimeToFirestore(travelTime);
      })
      .catch(function(error) {
        etaEl.textContent = error;
      });
    const googleMapsEmbedURL = "https://www.google.com/maps/embed/v1/directions?key=" +
                               GOOGLE_API_KEY +
                               "&origin=" + encodeURIComponent(ORIGIN_ADDRESS) +
                               "&destination=" + encodeURIComponent(destAddress) +
                               "&mode=driving";
    mapEl.src = googleMapsEmbedURL;
  });
}

// -------------------
// 5) Main init function for Map_1
// -------------------
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
  setInterval(async function() {
    console.log("Refreshing Map_1 data...");
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

// -------------------
// 6) Expose initMap globally for Google Maps callback
// -------------------
window.initMap = init;
