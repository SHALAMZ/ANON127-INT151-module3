// ========================================
// Combined Script: Reservations & Course Offerings
// ========================================

document.addEventListener("DOMContentLoaded", () => {
  const token = sessionStorage.getItem("kcToken");
  if (!token) {
    console.warn("No token found");
    return;
  }

  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
  const apiBase = isLocal
    ? "http://localhost:3000/api/v1"
    : "/intproj25/ssi2/itb-ecors/api/v1";

  function parseJwt(t) {
    try {
      const base64Url = t.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      return {};
    }
  }

  const info = parseJwt(token);
  const studentId =
    info.studentId ||
    info.student_id ||
    info.preferred_username ||
    info.preferredUsername ||
    info.sub;

  // ========================================
  // Create Error Dialog
  // ========================================
  function showErrorDialog(message) {
    let dialog = document.getElementById("reservationErrorDialog");
    
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "reservationErrorDialog";
      dialog.className = "ecors-dialog";
      dialog.setAttribute("closedby", "none");
      dialog.innerHTML = `
        <p id="reservationErrorMsg" class="ecors-dialog-message"></p>
        <menu style="text-align: center; margin-top: 20px;">
          <button id="reservationErrorOk" class="ecors-button-dialog">ตกลง</button>
        </menu>
      `;
      document.body.appendChild(dialog);

      const okBtn = document.getElementById("reservationErrorOk");
      okBtn.onclick = () => {
        dialog.close();
        dialog.style.display = "none";
      };
    }

    const msgEl = document.getElementById("reservationErrorMsg");
    msgEl.textContent = message;
    dialog.style.display = "block";
    try {
      dialog.showModal();
    } catch (e) {
      console.error("Dialog error:", e);
    }
  }

  if (!studentId) {
    console.error("Cannot extract studentId from token");
    return;
  }

  // ========================================
  // PART 1: YOUR RESERVATIONS
  // ========================================

  async function fetchReservationPeriod() {
    try {
      const res = await fetch(`${apiBase}/reservation-periods`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error("Error fetching period:", err);
      return null;
    }
  }

  async function fetchStudentReservations() {
    try {
      const res = await fetch(
        `${apiBase}/students/${encodeURIComponent(studentId)}/reservations`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error("Error fetching reservations:", err);
      return null;
    }
  }

  function renderReservations(periodData, reservationsData) {
    const reservationsBox = document.querySelector(
      '[data-cy="course-Reservations-box"]:nth-of-type(2)'
    );

    if (!reservationsBox) return;

    const existingParagraphs = reservationsBox.querySelectorAll("p");
    existingParagraphs.forEach((p) => p.remove());

    const currentPeriod = periodData?.currentPeriod;
    const isInReservationPeriod = !!currentPeriod;

    if (!isInReservationPeriod) {
      const noReservationMsg = document.createElement("p");
      noReservationMsg.setAttribute("data-cy", "reservation-message");
      noReservationMsg.textContent = "No reserved courses for the coming semester.";
      noReservationMsg.style.color = "#666";
      noReservationMsg.style.fontStyle = "italic";
      reservationsBox.appendChild(noReservationMsg);
      return;
    }

    const statusMsg = document.createElement("p");
    statusMsg.setAttribute("data-cy", "reservation-message");
    statusMsg.textContent = "You are in the reservation period.";
    statusMsg.style.margin = "6px 0";
    statusMsg.style.fontSize = "0.9rem";
    statusMsg.style.textAlign = "left";
    statusMsg.style.color = "#333";
    reservationsBox.appendChild(statusMsg);

    const reservedCourses = reservationsData?.reservedCourses || [];

    if (reservedCourses.length === 0) {
      const noCourseMsg = document.createElement("p");
      noCourseMsg.setAttribute("data-cy", "course-reserved");
      noCourseMsg.textContent = "No courses reserved yet.";
      noCourseMsg.style.margin = "6px 0";
      noCourseMsg.style.fontSize = "0.9rem";
      noCourseMsg.style.textAlign = "left";
      noCourseMsg.style.color = "#333";
      noCourseMsg.style.fontStyle = "italic";
      reservationsBox.appendChild(noCourseMsg);
    } else {
      reservedCourses.forEach((course) => {
        const courseItem = document.createElement("p");
        courseItem.setAttribute("data-cy", "course-reserved");
        courseItem.textContent = `${course.courseCode} ${course.courseTitle}`;
        courseItem.style.margin = "6px 0";
        courseItem.style.fontSize = "0.9rem";
        courseItem.style.textAlign = "left";
        courseItem.style.color = "#333";
        reservationsBox.appendChild(courseItem);
      });
    }

    const reservedCredits = reservationsData?.reservedCredits || 0;
    const maxCredits = 9;

    const creditMsg = document.createElement("p");
    creditMsg.setAttribute("data-cy", "reservation-message");
    creditMsg.textContent = `Total Credits: ${reservedCredits}/${maxCredits}`;
    creditMsg.style.margin = "6px 0";
    creditMsg.style.fontSize = "0.9rem";
    creditMsg.style.textAlign = "left";
    creditMsg.style.color = "#333";
    reservationsBox.appendChild(creditMsg);
  }

  async function initReservations() {
    try {
      const [periodData, reservationsData] = await Promise.all([
        fetchReservationPeriod(),
        fetchStudentReservations(),
      ]);
      renderReservations(periodData, reservationsData);
    } catch (err) {
      console.error("Error initializing reservations:", err);
    }
  }

  // ========================================
  // PART 2: COURSE OFFERINGS
  // ========================================

  let coreCoursesIds = [];
  let reservedCourseIds = [];
  let allOfferings = [];

  async function fetchCourseOfferings() {
    try {
      console.log("🔍 Fetching course offerings from:", `${apiBase}/course-offerings-plans`);
      const res = await fetch(`${apiBase}/course-offerings-plans`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("📡 Response status:", res.status);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      console.log("📦 Course offerings data:", data);
      return data;
    } catch (err) {
      console.error("❌ Error fetching offerings:", err);
      return null;
    }
  }

  function getCoreCourseIds() {
    const coreCoursesElements = document.querySelectorAll('[data-cy="core-course"]');
    const ids = [];

    coreCoursesElements.forEach((el) => {
      const text = el.textContent.trim();
      const match = text.match(/^([A-Z]+\d+)/);
      if (match) {
        ids.push(match[1]);
      }
    });

    return ids;
  }

  async function reserveCourse(courseOfferingId, courseCode, courseTitle) {
    try {
      const res = await fetch(
        `${apiBase}/students/${encodeURIComponent(studentId)}/reservations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ courseOfferingId }),
        }
      );

      if (res.status === 201) {
        await refreshAllData();
        return { success: true };
      } else {
        const error = await res.json();
        return { success: false, message: error.message || "Failed to reserve" };
      }
    } catch (err) {
      console.error("Error reserving:", err);
      return { success: false, message: "Network error" };
    }
  }

  async function removeCourse(courseOfferingId) {
    try {
      const res = await fetch(
        `${apiBase}/students/${encodeURIComponent(studentId)}/reservations/${courseOfferingId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.status === 204) {
        await refreshAllData();
        return { success: true };
      } else {
        const error = await res.json();
        return { success: false, message: error.message || "Failed to remove" };
      }
    } catch (err) {
      console.error("Error removing:", err);
      return { success: false, message: "Network error" };
    }
  }

  function showRemoveDialog(courseOfferingId, courseCode, courseTitle) {
    const dialog = document.createElement("dialog");
    dialog.className = "ecors-dialog";
    dialog.innerHTML = `
      <p class="ecors-dialog-message">Are you sure you want to remove ${courseCode} ${courseTitle}?</p>
      <menu>
        <button class="ecors-dialog-button-remove" value="remove">Remove</button>
        <button class="ecors-dialog-button-cancel" value="cancel">Cancel</button>
      </menu>
    `;

    document.body.appendChild(dialog);

    const removeBtn = dialog.querySelector(".ecors-dialog-button-remove");
    const cancelBtn = dialog.querySelector(".ecors-dialog-button-cancel");

    removeBtn.onclick = async () => {
      dialog.close();
      const result = await removeCourse(courseOfferingId);
      if (!result.success) {
        showErrorDialog(result.message || "Failed to remove course");
      }
      dialog.remove();
    };

    cancelBtn.onclick = () => {
      dialog.close();
      dialog.remove();
    };

    dialog.showModal();
  }

  function renderCourseOfferings(offeringsData, reservationsData) {
    console.log("🎨 renderCourseOfferings called");
    console.log("📊 offeringsData:", offeringsData);
    console.log("📊 reservationsData:", reservationsData);
    
    const container = document.querySelector(".course-offerings");
    console.log("📦 Container found:", container);
    
    if (!container) {
      console.error("❌ .course-offerings container not found!");
      return;
    }

    const loadingMsg = container.querySelector("p");
    if (loadingMsg) {
      console.log("🗑️ Removing loading message");
      loadingMsg.remove();
    }

    container.querySelectorAll(".course-offering-card").forEach((el) => el.remove());

    if (!offeringsData || !offeringsData.courseOfferings) {
      console.warn("⚠️ No offerings data");
      const noData = document.createElement("p");
      noData.textContent = "No course offerings available.";
      noData.style.color = "#666";
      noData.style.fontStyle = "italic";
      container.appendChild(noData);
      return;
    }

    coreCoursesIds = getCoreCourseIds();
    console.log("📚 Core course IDs:", coreCoursesIds);
    
    reservedCourseIds = (reservationsData?.reservedCourses || []).map(
      (c) => c.courseOfferingId
    );
    console.log("✅ Reserved course IDs:", reservedCourseIds);
    
    allOfferings = offeringsData.courseOfferings;
    console.log(`📋 Total offerings: ${allOfferings.length}`);

    if (allOfferings.length === 0) {
      console.warn("⚠️ No course offerings available for the coming semester");
      const noData = document.createElement("p");
      noData.textContent = "No course offerings available for the coming semester.";
      noData.style.color = "#666";
      noData.style.fontStyle = "italic";
      noData.style.margin = "12px 0";
      container.appendChild(noData);
      return;
    }

    offeringsData.courseOfferings.forEach((offering, index) => {
      console.log(`  ${index + 1}. ${offering.courseCode} - ${offering.courseTitle}`);
      
      const isCoreCourse = coreCoursesIds.includes(offering.courseCode);
      const isReserved = reservedCourseIds.includes(offering.id);

      const card = document.createElement("div");
      card.className = "course-offering-card";

      if (isCoreCourse) {
        card.style.borderLeft = "4px solid #4488e0";
      }

      card.innerHTML = `
        <div class="course-offering-info">
          <div class="course-code">${offering.courseCode}</div>
          <div class="course-title">${offering.courseTitle}</div>
          <div class="course-credits">${offering.courseCredits} credits</div>
        </div>
        <div class="course-offering-actions">
          <button class="button-reserve ${isReserved ? 'disabled' : ''}" 
                  data-cy="button-reserve" 
                  data-offering-id="${offering.id}" 
                  data-course-code="${offering.courseCode}" 
                  data-course-title="${offering.courseTitle}"
                  ${isReserved ? 'disabled' : ''}>
            Reserve
          </button>
          <button class="button-remove ${isReserved ? 'active' : 'disabled'}" 
                  data-cy="button-remove" 
                  data-offering-id="${offering.id}" 
                  data-course-code="${offering.courseCode}" 
                  data-course-title="${offering.courseTitle}"
                  ${!isReserved ? 'disabled' : ''}>
            Remove
          </button>
        </div>
      `;

      container.appendChild(card);
    });
    
    console.log("✅ Finished rendering course offerings");

    container.querySelectorAll(".button-reserve:not([disabled])").forEach((btn) => {
      btn.onclick = async () => {
        const offeringId = parseInt(btn.dataset.offeringId);
        const courseCode = btn.dataset.courseCode;
        const courseTitle = btn.dataset.courseTitle;

        const result = await reserveCourse(offeringId, courseCode, courseTitle);
        if (!result.success) {
          showErrorDialog(result.message || "Failed to reserve course");
        }
      };
    });

    container.querySelectorAll(".button-remove:not([disabled])").forEach((btn) => {
      btn.onclick = () => {
        const offeringId = parseInt(btn.dataset.offeringId);
        const courseCode = btn.dataset.courseCode;
        const courseTitle = btn.dataset.courseTitle;

        showRemoveDialog(offeringId, courseCode, courseTitle);
      };
    });
  }

  async function refreshAllData() {
    const [offeringsData, reservationsData] = await Promise.all([
      fetchCourseOfferings(),
      fetchStudentReservations(),
    ]);

    renderCourseOfferings(offeringsData, reservationsData);
    renderReservations(await fetchReservationPeriod(), reservationsData);
  }

  // ========================================
  // INITIALIZE
  // ========================================

  async function init() {
    console.log("🚀 Initializing...");
    console.log("👤 Student ID:", studentId);
    console.log("🔗 API Base:", apiBase);
    
    await initReservations();
    console.log("✅ Reservations initialized");
    
    console.log("⏰ Waiting 1 second before fetching offerings...");
    setTimeout(async () => {
      console.log("🎯 Now fetching all data...");
      await refreshAllData();
      console.log("✅ All data refreshed");
    }, 1000);
  }

  init();

  window.refreshReservations = initReservations;
});