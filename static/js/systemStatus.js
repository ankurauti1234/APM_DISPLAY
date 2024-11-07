import { showLoader, hideLoader } from "./utils.js";

const systemStatusEl = document.getElementById("system-status");
const overlay = document.querySelector(".overlay");

export function initializeSystemStatus() {
  fetchSystemStatus();
  setInterval(fetchSystemStatus, 15000); // Refresh every 15 seconds
}

function fetchSystemStatus() {
  showLoader();
  fetch("/api/system_status")
    .then((response) => response.json())
    .then((data) => {
      systemStatusEl.innerHTML = `
                <p>BLE Power Adapter Connected: ${data.is_ble_power_adapter_connected}</p>
                <p>BLE Remote Connected: ${data.is_ble_remote_connected}</p>
                <p>RTC Battery: ${data.rtc_battery_percentage}%</p>
                <p>Meter Battery: ${data.meter_battery_percentage}%</p>
                <p>TV Cable Plugged In: ${data.is_tv_cable_plugged_in}</p>
                <p>TV Tamper Detected: ${data.is_tv_tamper_detected}</p>
            `;

      updateOverlayState(data.is_tv_cable_plugged_in);
    })
    .finally(() => {
      hideLoader();
    });
}

function updateOverlayState(isTvCablePluggedIn) {
  if (!isTvCablePluggedIn) {
    overlay.classList.add("active");
  } else {
    overlay.classList.remove("active");
  }
}
