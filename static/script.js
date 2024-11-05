document.addEventListener("DOMContentLoaded", function () {
  const systemStatusEl = document.getElementById("system-status");
  const membersContainerEl = document.getElementById("members-container");
  const overlay = document.querySelector(".overlay");
  const modal = document.getElementById("modal");
  const infoModal = document.getElementById("info-modal");
  const settingsModal = document.getElementById("settings-modal");
  const closeBtns = document.getElementsByClassName("close");
  const memberForm = document.getElementById("member-form");
  const modalTitle = document.getElementById("modal-title");
  const currentTimeEl = document.getElementById("current-time");
  const infoBtn = document.getElementById("info-btn");
  const settingsBtn = document.getElementById("settings-btn");
  const loader = document.getElementById("loader");
  const clockTime = document.querySelector(".overlay .time");
  const clockDate = document.querySelector(".overlay .date");
  const clockMeridiem = document.querySelector(".overlay .meridiem");
  const wifiForm = document.getElementById("wifi-form");
  const disconnectWifiBtn = document.getElementById("disconnect-wifi");
  const activeDurationModal = document.getElementById("active-duration-modal");
  const durationOptions = document.querySelectorAll(".duration-btn");

  wifiForm.addEventListener("submit", connectWifi);
  disconnectWifiBtn.addEventListener("click", disconnectWifi);

  function updateClock() {
    const now = new Date();

    // Update time
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const meridiem = hours >= 12 ? "PM" : "AM";

    // Convert to 12-hour format
    hours = hours % 12;
    hours = hours ? hours : 12; // Convert 0 to 12

    // Get elements
    const timeEl = document.querySelector(".clock-display .time");
    const dateEl = document.querySelector(".clock-display .date");
    const meridiemEl = document.querySelector(".clock-display .meridiem");

    // Update time display
    timeEl.textContent = `${hours}:${minutes}`;
    meridiemEl.textContent = meridiem;

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

    dateEl.textContent = `${days[now.getDay()]}, ${
      months[now.getMonth()]
    } ${now.getDate()}`;
  }

  // Start the clock
  function startClock() {
    updateClock(); // Initial update
    setInterval(updateClock, 1000); // Update every second
  }

  function showLoader() {
    loader.style.display = "flex";
  }

  function hideLoader() {
    loader.style.display = "none";
  }

  function updateOverlayState(isTvCablePluggedIn) {
    if (!isTvCablePluggedIn) {
      overlay.classList.add("active");
    } else {
      overlay.classList.remove("active");
    }
  }

  function getAgeCategory(age) {
    if (age < 13) return "child";
    if (age < 20) return "teen";
    if (age < 60) return "adult";
    return "senior";
  }

  function getBackgroundImage(age, gender) {
    const ageCategory = getAgeCategory(age);
    return `url('/static/images/${ageCategory}_${
      gender === "m" ? "male" : "female"
    }.svg')`;
  }

  function updateCurrentTime() {
    const now = new Date();
    currentTimeEl.textContent = now.toLocaleTimeString();
  }

  setInterval(updateCurrentTime, 1000);
  updateCurrentTime();

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

        // Update overlay state based on TV cable status
        updateOverlayState(data.is_tv_cable_plugged_in);

        // If TV cable is not plugged in, refresh the members list
        if (!data.is_tv_cable_plugged_in) {
          fetchMembers();
        }
      })
      .finally(() => {
        hideLoader();
      });
  }

  function fetchMembers() {
    showLoader();
    fetch("/api/members")
      .then((response) => response.json())
      .then((data) => {
        membersContainerEl.innerHTML = "";
        for (let i = 0; i < 8; i++) {
          const memberCard = document.createElement("div");
          if (i < data.length) {
            const member = data[i];
            memberCard.className = `member-card ${
              member.is_active ? "active" : ""
            }`;
            memberCard.setAttribute("data-id", member.id);
            memberCard.style.backgroundImage = getBackgroundImage(
              member.age,
              member.gender
            );
            memberCard.innerHTML = `
                            <h3 class="member-name">${member.name}</h3>
                            <div class="card-actions">
                                <button class="card-btn edit-btn" data-id="${member.id}">
                                    <span class="material-icons">edit</span>
                                </button>
                                <button class="card-btn delete-btn" data-id="${member.id}">
                                    <span class="material-icons">delete</span>
                                </button>
                            </div>
                        `;
            memberCard.addEventListener("click", (e) => {
              if (!e.target.closest(".card-btn")) {
                toggleMemberActive(member.id);
              }
            });
          } else {
            memberCard.className = "member-card empty";
            memberCard.textContent = "Add Member";
            memberCard.addEventListener("click", () => openModal());
          }
          membersContainerEl.appendChild(memberCard);
        }
      })
      .finally(() => {
        hideLoader();
      });
  }

  function openModal(memberId = null) {
    modal.style.display = "block";
    if (memberId) {
      modalTitle.textContent = "Edit Member";
      showLoader();
      fetch(`/api/members/${memberId}`)
        .then((response) => response.json())
        .then((member) => {
          document.getElementById("member-id").value = member.id;
          document.getElementById("name").value = member.name;
          document.getElementById("age").value = member.age;
          document.getElementById("gender").value = member.gender;
        })
        .finally(() => {
          hideLoader();
        });
    } else {
      modalTitle.textContent = "Add Member";
      memberForm.reset();
      document.getElementById("member-id").value = "";
    }
  }

  function closeModal() {
    modal.style.display = "none";
    infoModal.style.display = "none";
    settingsModal.style.display = "none";
  }

  function saveMember(event) {
    event.preventDefault();
    const memberId = document.getElementById("member-id").value;
    const name = document.getElementById("name").value;
    const age = document.getElementById("age").value;
    const gender = document.getElementById("gender").value;

    const method = memberId ? "PUT" : "POST";
    const url = memberId ? `/api/members/${memberId}` : "/api/members";

    showLoader();
    fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, age, gender }),
    })
      .then((response) => response.json())
      .then(() => {
        closeModal();
        fetchMembers();
      })
      .finally(() => {
        hideLoader();
      });
  }

  let currentMemberId = null;

  function toggleMemberActive(id) {
    const memberCard = document.querySelector(`.member-card[data-id="${id}"]`);
    if (!memberCard) return;

    if (memberCard.classList.contains("active")) {
      // If already active, set to inactive immediately
      setMemberInactive(id);
    } else {
      // If inactive, show the duration modal
      showActiveDurationModal(id);
    }
  }

  // Add these new functions
  function showActiveDurationModal(id) {
    currentMemberId = id;
    activeDurationModal.style.display = "block";
  }

  function setMemberInactive(id) {
    const memberCard = document.querySelector(`.member-card[data-id="${id}"]`);
    memberCard.classList.add("loading");
    fetch(`/api/members/${id}/toggle_active`, { method: "POST" })
      .then((response) => response.json())
      .then(() => {
        fetchMembers();
      })
      .catch((error) => {
        console.error("Error toggling member active state:", error);
        memberCard.classList.remove("loading");
      });
  }

  function setMemberActive(id, duration) {
    const memberCard = document.querySelector(`.member-card[data-id="${id}"]`);
    memberCard.classList.add("loading");
    fetch(`/api/members/${id}/set_active`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ duration: duration }),
    })
      .then((response) => response.json())
      .then(() => {
        fetchMembers();
        activeDurationModal.style.display = "none";
      })
      .catch((error) => {
        console.error("Error setting member active:", error);
        memberCard.classList.remove("loading");
      });
  }

  // Add event listeners for duration buttons
  durationOptions.forEach((btn) => {
    btn.addEventListener("click", function () {
      const duration = parseInt(this.getAttribute("data-duration"));
      setMemberActive(currentMemberId, duration);
    });
  });

  // Close the active duration modal when clicking outside or on the close button
  activeDurationModal.addEventListener("click", function (event) {
    if (
      event.target === activeDurationModal ||
      event.target.classList.contains("close")
    ) {
      activeDurationModal.style.display = "none";
    }
  });

  // Update the existing event listener for member cards
  membersContainerEl.addEventListener("click", function (event) {
    const memberCard = event.target.closest(".member-card");
    if (memberCard && !event.target.closest(".card-btn")) {
      const memberId = memberCard.getAttribute("data-id");
      toggleMemberActive(memberId);
    }
  });

  Array.from(closeBtns).forEach((btn) =>
    btn.addEventListener("click", closeModal)
  );
  memberForm.addEventListener("submit", saveMember);

  infoBtn.addEventListener("click", () => {
    fetchSystemStatus();
    infoModal.style.display = "block";
  });

  settingsBtn.addEventListener("click", () => {
    settingsModal.style.display = "block";
  });

  membersContainerEl.addEventListener("click", function (event) {
    const editBtn = event.target.closest(".edit-btn");
    const deleteBtn = event.target.closest(".delete-btn");

    if (editBtn) {
      openModal(editBtn.getAttribute("data-id"));
    } else if (deleteBtn) {
      const memberId = deleteBtn.getAttribute("data-id");
      const memberCard = deleteBtn.closest(".member-card");
      const memberName = memberCard.querySelector(".member-name").textContent;
      showDeleteConfirmation(memberId, memberName);
    }
  });

  // Virtual Keyboard Setup
  const keyboard = document.getElementById("virtual-keyboard");
  let currentInput = null;
  let isShiftActive = false;
  let isSymbolsActive = false;

  const keys = {
    numbers: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    symbols1: ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"],
    symbols2: ["-", "_", "=", "+", "[", "]", "{", "}", "|", "\\"],
    symbols3: [";", ":", "'", '"', ",", ".", "<", ">", "?", "/"],
    topRow: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    middleRow: ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    bottomRow: ["z", "x", "c", "v", "b", "n", "m"],
  };

  function initializeKeyboard() {
    // Create keyboard layout container
    keyboard.innerHTML = `
    <div class="keyboard">
      <div class="keyboard-row" id="number-row"></div>
      <div class="keyboard-row" id="symbols1-row"></div>
      <div class="keyboard-row" id="symbols2-row"></div>
      <div class="keyboard-row" id="symbols3-row"></div>
      <div class="keyboard-row" id="top-row"></div>
      <div class="keyboard-row" id="middle-row"></div>
      <div class="keyboard-row" id="bottom-row"></div>
      <div class="keyboard-row" id="action-row">
        <button class="keyboard-key shift-key">Shift</button>
        <button class="keyboard-key symbols-key">!#$</button>
        <button class="keyboard-key space-key">Space</button>
        <button class="keyboard-key backspace-key">←</button>
        <button class="keyboard-key enter-key">Enter</button>
      </div>
    </div>
  `;

    // Initialize all rows
    initializeRow("number-row", keys.numbers);
    initializeRow("symbols1-row", keys.symbols1);
    initializeRow("symbols2-row", keys.symbols2);
    initializeRow("symbols3-row", keys.symbols3);
    initializeRow("top-row", keys.topRow);
    initializeRow("middle-row", keys.middleRow);
    initializeRow("bottom-row", keys.bottomRow);

    // Add event listeners for special keys
    document.querySelector(".shift-key").addEventListener("click", toggleShift);
    document
      .querySelector(".symbols-key")
      .addEventListener("click", toggleSymbols);
    document
      .querySelector(".space-key")
      .addEventListener("click", () => handleInput(" "));
    document
      .querySelector(".backspace-key")
      .addEventListener("click", handleBackspace);
    document
      .querySelector(".enter-key")
      .addEventListener("click", hideKeyboard);

    // Initially hide symbol rows
    toggleSymbolRows(false);
  }

  function initializeRow(rowId, keys) {
    const row = document.getElementById(rowId);
    keys.forEach((key) => {
      const button = createKeyButton(key);
      row.appendChild(button);
    });
  }

  function createKeyButton(key) {
    const button = document.createElement("button");
    button.className = "keyboard-key";
    button.textContent = key;
    if (key.length === 1) {
      button.addEventListener("click", () => handleInput(key));
    }
    return button;
  }

  function toggleShift() {
    isShiftActive = !isShiftActive;
    document.querySelector(".shift-key").classList.toggle("active");
    updateKeyboardCase();
  }

  function toggleSymbols() {
    isSymbolsActive = !isSymbolsActive;
    document.querySelector(".symbols-key").classList.toggle("active");
    toggleSymbolRows(isSymbolsActive);
  }

  function toggleSymbolRows(show) {
    const symbolRows = [
      document.getElementById("symbols1-row"),
      document.getElementById("symbols2-row"),
      document.getElementById("symbols3-row"),
    ];

    symbolRows.forEach((row) => {
      row.style.display = show ? "flex" : "none";
    });
  }

  function updateKeyboardCase() {
    const keyButtons = document.querySelectorAll(".keyboard-key");
    keyButtons.forEach((button) => {
      if (button.textContent.length === 1) {
        button.textContent = isShiftActive
          ? button.textContent.toUpperCase()
          : button.textContent.toLowerCase();
      }
    });
  }

  function handleInput(key) {
    if (!currentInput) return;

    const newValue =
      currentInput.value + (isShiftActive ? key.toUpperCase() : key);
    currentInput.value = newValue;

    // Trigger input event for validation
    const event = new Event("input", { bubbles: true });
    currentInput.dispatchEvent(event);
  }

  function handleBackspace() {
    if (!currentInput) return;
    currentInput.value = currentInput.value.slice(0, -1);

    // Trigger input event for validation
    const event = new Event("input", { bubbles: true });
    currentInput.dispatchEvent(event);
  }

  function showKeyboard(input) {
    currentInput = input;
    keyboard.style.display = "block";

    // Reset keyboard state
    isShiftActive = false;
    isSymbolsActive = false;
    document.querySelector(".shift-key")?.classList.remove("active");
    document.querySelector(".symbols-key")?.classList.remove("active");

    // Switch keyboard layout based on input type
    if (input.type === "number") {
      showNumberKeyboard();
    } else if (input.type === "password") {
      showPasswordKeyboard();
    } else {
      showFullKeyboard();
    }

    updateKeyboardCase();
  }

  function showNumberKeyboard() {
    // Show only number row and hide others
    const rows = keyboard.querySelectorAll(".keyboard-row");
    rows.forEach((row) => {
      if (row.id === "number-row" || row.id === "action-row") {
        row.style.display = "flex";
      } else {
        row.style.display = "none";
      }
    });

    // Hide unnecessary action buttons
    keyboard.querySelector(".shift-key").style.display = "none";
    keyboard.querySelector(".symbols-key").style.display = "none";
    keyboard.querySelector(".space-key").style.display = "none";
  }

  function showPasswordKeyboard() {
    // Show all rows but keep symbols hidden initially
    const rows = keyboard.querySelectorAll(".keyboard-row");
    rows.forEach((row) => (row.style.display = "flex"));
    toggleSymbolRows(false);

    // Show all action buttons
    keyboard.querySelector(".shift-key").style.display = "block";
    keyboard.querySelector(".symbols-key").style.display = "block";
    keyboard.querySelector(".space-key").style.display = "block";
  }

  function showFullKeyboard() {
    // Show all rows except symbols
    const rows = keyboard.querySelectorAll(".keyboard-row");
    rows.forEach((row) => (row.style.display = "flex"));
    toggleSymbolRows(false);

    // Show all action buttons
    keyboard.querySelector(".shift-key").style.display = "block";
    keyboard.querySelector(".symbols-key").style.display = "block";
    keyboard.querySelector(".space-key").style.display = "block";
  }

  function hideKeyboard() {
    keyboard.style.display = "none";
    currentInput = null;
    isShiftActive = false;
    isSymbolsActive = false;
  }

  // Initialize keyboard

  initializeKeyboard();

  // Add input focus listeners
  const inputs = document.querySelectorAll(
    'input[type="text"], input[type="password"], input[type="number"]'
  );
  inputs.forEach((input) => {
    input.addEventListener("focus", () => showKeyboard(input));
  });

  // Hide keyboard when clicking outside
  document.addEventListener("click", (e) => {
    if (
      !keyboard.contains(e.target) &&
      !e.target.matches(
        'input[type="text"], input[type="password"], input[type="number"]'
      )
    ) {
      hideKeyboard();
    }
  });

  // Delete Confirmation Modal Setup
  const deleteModal = document.getElementById("delete-modal");
  const deleteModalName = document.getElementById("delete-member-name");
  const confirmDeleteBtn = document.getElementById("confirm-delete");
  const cancelDeleteBtn = document.getElementById("cancel-delete");
  let pendingDeleteId = null;

  function showDeleteConfirmation(id, name) {
    pendingDeleteId = id;
    deleteModalName.textContent = name;
    deleteModal.style.display = "block";
  }

  function handleMemberDelete(id) {
    showLoader();
    fetch(`/api/members/${id}`, { method: "DELETE" })
      .then(() => {
        deleteModal.style.display = "none";
        fetchMembers();
      })
      .catch((error) => {
        console.error("Error deleting member:", error);
        alert("Failed to delete member. Please try again.");
      })
      .finally(() => {
        hideLoader();
      });
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

  // Confirm delete button handler
  confirmDeleteBtn.addEventListener("click", () => {
    if (pendingDeleteId) {
      handleMemberDelete(pendingDeleteId);
      pendingDeleteId = null;
    }
  });

  // Cancel delete button handler
  cancelDeleteBtn.addEventListener("click", () => {
    deleteModal.style.display = "none";
    pendingDeleteId = null;
  });

  // Also close delete modal when clicking the close button or outside the modal
  window.addEventListener("click", (event) => {
    if (event.target === deleteModal) {
      deleteModal.style.display = "none";
      pendingDeleteId = null;
    }
  });

  // Add these variables at the top of your script
  const shutdownBtn = document.getElementById("shutdown-btn");
  const shutdownModal = document.getElementById("shutdown-modal");
  const restartBtn = document.getElementById("restart-btn");
  const shutdownConfirmBtn = document.getElementById("shutdown-confirm-btn");
  const cancelShutdownBtn = document.getElementById("cancel-shutdown");

  // Add event listeners
  shutdownBtn.addEventListener("click", showShutdownModal);
  restartBtn.addEventListener("click", () => performAction("restart"));
  shutdownConfirmBtn.addEventListener("click", () => performAction("shutdown"));
  cancelShutdownBtn.addEventListener("click", hideShutdownModal);

  function showShutdownModal() {
    shutdownModal.style.display = "block";
  }

  function hideShutdownModal() {
    shutdownModal.style.display = "none";
  }

  function performAction(action) {
    fetch(`/api/${action}`, { method: "POST" })
      .then((response) => response.json())
      .then((data) => {
        alert(data.message);
        hideShutdownModal();
      })
      .catch((error) => {
        console.error(`Error during ${action}:`, error);
        alert(`Failed to ${action}. Please try again.`);
      });
  }

  // Close the shutdown modal when clicking outside
  window.addEventListener("click", (event) => {
    if (event.target === shutdownModal) {
      hideShutdownModal();
    }
  });

  // Initial fetches
  fetchSystemStatus();
  fetchMembers();
  // Fetch Wi-Fi networks on page load
  fetchWifiNetworks();

  startClock();

  // Refresh Wi-Fi networks every 30 seconds
  setInterval(fetchWifiNetworks, 30000);

  // Set up polling for system status every 30 seconds
  setInterval(fetchSystemStatus, 15000);
});

