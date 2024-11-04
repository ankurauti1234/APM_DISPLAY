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

    clockTime.textContent = `${hours}:${minutes}`;
    clockDate.textContent = `${days[now.getDay()]}, ${
      months[now.getMonth()]
    } ${now.getDate()}`;
    clockMeridiem.textContent = meridiem;
  }

  function updateOverlayState(isTvCablePluggedIn) {
    if (!isTvCablePluggedIn) {
      overlay.classList.add("active");
      // Start updating clock if overlay is shown
      if (!window.clockInterval) {
        updateClock(); // Initial update
        window.clockInterval = setInterval(updateClock, 1000);
      }
    } else {
      overlay.classList.remove("active");
      // Stop clock updates if overlay is hidden
      if (window.clockInterval) {
        clearInterval(window.clockInterval);
        window.clockInterval = null;
      }
    }
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

  function toggleMemberActive(id) {
    const memberCard = document.querySelector(`.member-card[data-id="${id}"]`);
    if (!memberCard) return;

    memberCard.classList.add("loading");
    fetch(`/api/members/${id}/toggle_active`, { method: "POST" })
      .then((response) => response.json())
      .then(() => {
        // Only fetch members to update UI
        fetchMembers().then(() => {
          memberCard.classList.remove("loading");
        });
      })
      .catch((error) => {
        console.error("Error toggling member active state:", error);
        memberCard.classList.remove("loading");
      });
  }

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

  const keys = {
    numbers: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    topRow: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    middleRow: ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    bottomRow: ["z", "x", "c", "v", "b", "n", "m", "Backspace"],
  };

  function initializeKeyboard() {
    // Number row
    const numberRow = document.getElementById("number-row");
    keys.numbers.forEach((key) => {
      const button = createKeyButton(key);
      numberRow.appendChild(button);
    });

    // Top row
    const topRow = document.getElementById("top-row");
    keys.topRow.forEach((key) => {
      const button = createKeyButton(key);
      topRow.appendChild(button);
    });

    // Middle row
    const middleRow = document.getElementById("middle-row");
    const shiftKey = createKeyButton("CapsLk");
    shiftKey.classList.add("shift-key");
    middleRow.appendChild(shiftKey);
    keys.middleRow.forEach((key) => {
      const button = createKeyButton(key);
      middleRow.appendChild(button);
    });

    // Bottom row
    const bottomRow = document.getElementById("bottom-row");
    keys.bottomRow.forEach((key) => {
      const button = createKeyButton(key);
      if (key === "Backspace") {
        button.innerHTML = "←";
        button.classList.add("backspace-key");
      }
      bottomRow.appendChild(button);
    });

    // Add event listeners for keyboard special keys
    document.querySelector(".shift-key").addEventListener("click", toggleShift);
    document
      .querySelector(".space-key")
      .addEventListener("click", () => handleInput(" "));
    document
      .querySelector(".enter-key")
      .addEventListener("click", hideKeyboard);
    document
      .querySelector(".backspace-key")
      .addEventListener("click", handleBackspace);
  }

  function createKeyButton(key) {
    const button = document.createElement("button");
    button.className = "keyboard-key";
    button.textContent = key;
    if (key.length === 1) {
      // Regular keys
      button.addEventListener("click", () => handleInput(key));
    }
    return button;
  }

  function toggleShift() {
    isShiftActive = !isShiftActive;
    document.querySelector(".shift-key").classList.toggle("active");
    updateKeyboardCase();
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

    // Switch keyboard layout based on input type
    if (input.type === "number") {
      keyboard.classList.add("number-keyboard");
      // Hide letter rows
      document.getElementById("top-row").style.display = "none";
      document.getElementById("middle-row").style.display = "none";
      document.getElementById("bottom-row").style.display = "none";
      document.querySelector(".space-key").style.display = "none";
    } else {
      keyboard.classList.remove("number-keyboard");
      // Show all rows
      document.getElementById("top-row").style.display = "flex";
      document.getElementById("middle-row").style.display = "flex";
      document.getElementById("bottom-row").style.display = "flex";
      document.querySelector(".space-key").style.display = "block";
    }
  }

  function hideKeyboard() {
    keyboard.style.display = "none";
    currentInput = null;
    isShiftActive = false;
    document.querySelector(".shift-key")?.classList.remove("active");
    updateKeyboardCase();
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

  // Initial fetches
  fetchSystemStatus();
  fetchMembers();
  // Fetch Wi-Fi networks on page load
  fetchWifiNetworks();

  // Refresh Wi-Fi networks every 30 seconds
  setInterval(fetchWifiNetworks, 30000);

  // Set up polling for system status every 30 seconds
  setInterval(fetchSystemStatus, 15000);
});

