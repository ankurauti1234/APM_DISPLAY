import { showLoader, hideLoader } from "./utils.js";

const wifiForm = document.getElementById("wifi-form");
const disconnectWifiBtn = document.getElementById("disconnect-wifi");

export function initializeWifi() {
  fetchWifiNetworks();
  wifiForm.addEventListener("submit", connectWifi);
  disconnectWifiBtn.addEventListener("click", disconnectWifi);
  setInterval(fetchWifiNetworks, 30000); // Refresh every 30 seconds
}

function fetchWifiNetworks() {
  showLoader();
  fetch("/api/wifi/networks")
    .then((response) => response.json())
    .then((data) => {
      const networkList = document.getElementById("wifi-network-list");
      networkList.innerHTML = "";
      data.forEach((network) => {
        const li = document.createElement("li");
        li.textContent = `${network.ssid} (Signal: ${network.signal_strength})`;
        li.addEventListener("click", () => {
          document.getElementById("wifi-ssid").value = network.ssid;
        });
        networkList.appendChild(li);
      });
    })
    .catch((error) => {
      console.error("Error fetching Wi-Fi networks:", error);
    })
    .finally(() => {
      hideLoader();
    });
}

function connectWifi(event) {
  event.preventDefault();
  const ssid = document.getElementById("wifi-ssid").value;
  const password = document.getElementById("wifi-password").value;

  showLoader();
  fetch("/api/wifi/connect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ssid, password }),
  })
    .then((response) => response.json())
    .then((data) => {
      alert(data.message);
      fetchWifiNetworks();
    })
    .catch((error) => {
      console.error("Error connecting to Wi-Fi:", error);
      alert("Error connecting to Wi-Fi.");
    })
    .finally(() => {
      hideLoader();
    });
}

function disconnectWifi() {
  showLoader();
  fetch("/api/wifi/disconnect", {
    method: "POST",
  })
    .then((response) => response.json())
    .then((data) => {
      alert(data.message);
      fetchWifiNetworks();
    })
    .catch((error) => {
      console.error("Error disconnecting from Wi-Fi:", error);
      alert("Error disconnecting from Wi-Fi.");
    })
    .finally(() => {
      hideLoader();
    });
}
