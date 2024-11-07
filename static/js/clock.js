export function initializeClock() {
  const clockTime = document.querySelector(".overlay .time");
  const clockDate = document.querySelector(".overlay .date");
  const clockMeridiem = document.querySelector(".overlay .meridiem");
  const currentTimeEl = document.getElementById("current-time");

  function updateClock() {
    const now = new Date();

    // Update time
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const meridiem = hours >= 12 ? "PM" : "AM";

    // Convert to 12-hour format
    hours = hours % 12;
    hours = hours ? hours : 12; // Convert 0 to 12

    // Update time display
    clockTime.textContent = `${hours}:${minutes}`;
    clockMeridiem.textContent = meridiem;

    // Update date
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    clockDate.textContent = `${days[now.getDay()]}, ${
      months[now.getMonth()]
    } ${now.getDate()}`;

    // Update current time in header
    currentTimeEl.textContent = now.toLocaleTimeString();
  }

  // Start the clock
  updateClock(); // Initial update
  setInterval(updateClock, 1000); // Update every second
}
