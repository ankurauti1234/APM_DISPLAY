const modal = document.getElementById("modal");
const infoModal = document.getElementById("info-modal");
const settingsModal = document.getElementById("settings-modal");
const closeBtns = document.getElementsByClassName("close");

export function initializeModals() {
  Array.from(closeBtns).forEach((btn) =>
    btn.addEventListener("click", closeModal)
  );

  const infoBtn = document.getElementById("info-btn");
  const settingsBtn = document.getElementById("settings-btn");

  infoBtn.addEventListener("click", () => {
    infoModal.style.display = "block";
  });

  settingsBtn.addEventListener("click", () => {
    settingsModal.style.display = "block";
  });
}

export function openModal(memberId = null) {
  modal.style.display = "block";
  const modalTitle = document.getElementById("modal-title");
  if (memberId) {
    modalTitle.textContent = "Edit Member";
    fetch(`/api/members/${memberId}`)
      .then((response) => response.json())
      .then((member) => {
        document.getElementById("member-id").value = member.id;
        document.getElementById("name").value = member.name;
        document.getElementById("age").value = member.age;
        document.getElementById("gender").value = member.gender;
      });
  } else {
    modalTitle.textContent = "Add Member";
    document.getElementById("member-form").reset();
    document.getElementById("member-id").value = "";
  }
}

export function closeModal() {
  modal.style.display = "none";
  infoModal.style.display = "none";
  settingsModal.style.display = "none";
}
