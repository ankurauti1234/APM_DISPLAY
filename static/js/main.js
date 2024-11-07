import { initializeClock } from "./clock.js";
import { initializeMembers } from "./members.js";
import { initializeSystemStatus } from "./systemStatus.js";
import { initializeWifi } from "./wifi.js";
import { initializeVirtualKeyboard } from "./virtualKeyboard.js";
import { initializeModals } from "./modals.js";
import { initializeShutdown } from "./shutdown.js";

document.addEventListener("DOMContentLoaded", function () {
  initializeClock();
  initializeMembers();
  initializeSystemStatus();
  initializeWifi();
  initializeVirtualKeyboard();
  initializeModals();
  initializeShutdown();
});
