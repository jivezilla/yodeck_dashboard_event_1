console.log("Countdown_1 script loaded.");

function updateCountdown() {
  // If Banner_1 hasn't yet set departureTime, or it's invalid, show fallback
  if (
    typeof window.departureTime === "undefined" ||
    !window.departureTime ||
    isNaN(window.departureTime.getTime())
  ) {
    document.getElementById("countdownDisplay").textContent =
      "No valid departure time set.";
    return;
  }

  const now = new Date();
  const distance = window.departureTime - now;

  // If time is up or past
  if (distance <= 0) {
    document.getElementById("countdownDisplay").textContent = "Departed!";
    return;
  }

  // Convert milliseconds -> hours, minutes, seconds
  const hours = Math.floor(distance / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  // Display
  document.getElementById("countdownDisplay").textContent =
    `${hours}h ${minutes}m ${seconds}s left`;
}

// Immediately call it once so there's no 1-second delay to show anything
updateCountdown();

// Then update every second
setInterval(updateCountdown, 1000);
