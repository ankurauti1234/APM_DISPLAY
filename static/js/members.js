import { showLoader, hideLoader } from "./utils.js";
import { openModal, closeModal } from "./modals.js";

const membersContainerEl = document.getElementById("members-container");
const memberForm = document.getElementById("member-form");
const modalTitle = document.getElementById("modal-title");
let currentMemberId = null;

export function initializeMembers() {
  fetchMembers();
  memberForm.addEventListener("submit", saveMember);
  membersContainerEl.addEventListener("click", handleMemberCardClick);
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

function getBackgroundImage(age, gender) {
  const ageCategory = getAgeCategory(age);
  return `url('/static/images/${ageCategory}_${
    gender === "m" ? "male" : "female"
  }.svg')`;
}

function getAgeCategory(age) {
  if (age < 13) return "child";
  if (age < 20) return "teen";
  if (age < 60) return "adult";
  return "senior";
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

function handleMemberCardClick(event) {
  const editBtn = event.target.closest(".edit-btn");
  const deleteBtn = event.target.closest(".delete-btn");
  const memberCard = event.target.closest(".member-card");

  if (editBtn) {
    openModal(editBtn.getAttribute("data-id"));
  } else if (deleteBtn) {
    const memberId = deleteBtn.getAttribute("data-id");
    const memberName = memberCard.querySelector(".member-name").textContent;
    showDeleteConfirmation(memberId, memberName);
  } else if (memberCard && !memberCard.classList.contains("empty")) {
    const memberId = memberCard.getAttribute("data-id");
    toggleMemberActive(memberId);
  }
}

function toggleMemberActive(id) {
  const memberCard = document.querySelector(`.member-card[data-id="${id}"]`);
  if (!memberCard) return;

  if (memberCard.classList.contains("active")) {
    setMemberInactive(id);
  } else {
    showActiveDurationModal(id);
  }
}

function showActiveDurationModal(id) {
  currentMemberId = id;
  document.getElementById("active-duration-modal").style.display = "block";
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

export function setMemberActive(id, duration) {
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
      document.getElementById("active-duration-modal").style.display = "none";
    })
    .catch((error) => {
      console.error("Error setting member active:", error);
      memberCard.classList.remove("loading");
    });
}

function showDeleteConfirmation(id, name) {
  const deleteModal = document.getElementById("delete-modal");
  const deleteModalName = document.getElementById("delete-member-name");
  deleteModalName.textContent = name;
  deleteModal.style.display = "block";

  const confirmDeleteBtn = document.getElementById("confirm-delete");
  const cancelDeleteBtn = document.getElementById("cancel-delete");

  confirmDeleteBtn.onclick = () => handleMemberDelete(id);
  cancelDeleteBtn.onclick = () => (deleteModal.style.display = "none");
}

function handleMemberDelete(id) {
  showLoader();
  fetch(`/api/members/${id}`, { method: "DELETE" })
    .then(() => {
      document.getElementById("delete-modal").style.display = "none";
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
