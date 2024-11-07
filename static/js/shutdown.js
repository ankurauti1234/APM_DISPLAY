const shutdownBtn = document.getElementById("shutdown-btn");
const shutdownModal = document.getElementById("shutdown-modal");
const restartBtn = document.getElementById("restart-btn");
const shutdownConfirmBtn = document.getElementById("shutdown-confirm-btn");
const cancelShutdownBtn = document.getElementById("cancel-shutdown");

export function initializeShutdown() {
  shutdownBtn.addEventListener("click", showShutdownModal);
  restartBtn.addEventListener("click", () => performAction("restart"));
  shutdownConfirmBtn.addEventListener("click", () => performAction("shutdown"));
  cancelShutdownBtn.addEventListener("click", hideShutdownModal);

  window.addEventListener("click", (event) => {
    if (event.target === shutdownModal) {
      hideShutdownModal();
    }
  });
}

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
