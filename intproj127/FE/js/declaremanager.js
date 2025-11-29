document.addEventListener("DOMContentLoaded", () => {
  // ป้องกันการ init ซ้ำ
  if (document.querySelector(".declare-section")) return;
  if (window.__declareStatusInitialized) return;
  window.__declareStatusInitialized = true;

  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
  const apiBase = isLocal
    ? "http://localhost:3000/api/v1"
    : "/intproj25/ssi2/itb-ecors/api/v1";

  const token = sessionStorage.getItem("kcToken");
  if (!token) return;

  // --- GLOBAL STATE ---
  if (!window.__ecorsState) {
    window.__ecorsState = {
      studyPlans: [],
      declaredPlanObj: null,
      lastSuccessfulFetchTime: 0,
      isFetching: false,
      mainInitDone: false,
    };
  }

  const DEBOUNCE_MS = 2000;

  // --- HELPER: Parse JWT ---
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

  const declaredPlanUrl = `${apiBase}/students/${encodeURIComponent(
    studentId
  )}/declared-plan`;

  const main = document.querySelector("main") || document.body;

  // --- Create UI ---
  const declareSection = document.createElement("div");
  declareSection.className = "declare-section";
  declareSection.innerHTML = `
    <h2>Declare Your Major</h2>
    <select id="majorSelect" class="ecors-dropdown-plan">
      <option value="" selected>-- Select Major --</option>
    </select>
    <div id="buttonArea" style="margin-top:12px;"></div>

    <dialog id="infoDialog" class="ecors-dialog">
      <form method="dialog">
        <p id="infoMsg" class="ecors-dialog-message"></p>
        <menu>
          <button id="infoOk" value="ok" class="ecors-button-dialog">Ok</button>
          <button id="dialogCancel" class="ecors-button-cancel">Cancel Declaration</button>
          <button id="dialogKeep" class="ecors-button-keep">Keep Declaration</button>
        </menu>
      </form>
    </dialog>
  `;

  const mm = document.getElementById("majorManagementSection");
  if (mm) mm.appendChild(declareSection);
  else main.appendChild(declareSection);

  // --- Elements ---
  const select = document.getElementById("majorSelect");
  const buttonArea = document.getElementById("buttonArea");
  const infoDialog = document.getElementById("infoDialog");
  const infoMsg = document.getElementById("infoMsg");
  const infoOk = document.getElementById("infoOk");
  const dialogCancelBtn = document.getElementById("dialogCancel");
  const dialogKeepBtn = document.getElementById("dialogKeep");
  const statusEl = document.getElementById("declareStatus");

  // Getters/Setters สำหรับ state
  function getStudyPlans() {
    return window.__ecorsState.studyPlans;
  }
  function setStudyPlans(val) {
    window.__ecorsState.studyPlans = val;
  }
  function getDeclaredPlan() {
    return window.__ecorsState.declaredPlanObj;
  }
  function setDeclaredPlan(val) {
    window.__ecorsState.declaredPlanObj = val;
  }
  function getLastFetchTime() {
    return window.__ecorsState.lastSuccessfulFetchTime;
  }
  function setLastFetchTime(val) {
    window.__ecorsState.lastSuccessfulFetchTime = val;
  }

  // --- DIALOG HELPERS ---
  function closeInfoDialog() {
    try {
      infoDialog.close();
    } catch (e) { }
    infoDialog.style.display = "none";
  }

  function showInfo(text) {
    infoMsg.textContent = text;
    if (infoOk) infoOk.style.display = "";
    if (dialogCancelBtn) dialogCancelBtn.style.display = "none";
    if (dialogKeepBtn) dialogKeepBtn.style.display = "none";
    infoDialog.style.display = "block";
    try {
      infoDialog.showModal();
    } catch (e) { }
  }

  function showCancelConfirm(text) {
    infoMsg.textContent = text;
    if (infoOk) infoOk.style.display = "none";
    if (dialogCancelBtn) dialogCancelBtn.style.display = "";
    if (dialogKeepBtn) dialogKeepBtn.style.display = "";
    infoDialog.style.display = "block";
    try {
      infoDialog.showModal();
    } catch (e) { }
  }

  function showNotFound(sid) {
    showInfo(`No declared plan found for student with id=${sid}.`);
  }

  // กด OK ใน dialog info
  if (infoOk) {
    infoOk.onclick = () => {
      closeInfoDialog();
      updateStatusDisplay();
      renderButtons();
    };
  }

  if (dialogKeepBtn) {
    dialogKeepBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeInfoDialog();
    });
  }

  // ===============================
  // API Calls
  // ===============================
  async function loadStudyPlans() {
    try {
      const res = await fetch(`${apiBase}/study-plans`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setStudyPlans(await res.json());
        const currentVal = select.value;
        select.innerHTML = `<option value="" selected>-- Select Major --</option>`;
        getStudyPlans().forEach((p) => {
          const opt = document.createElement("option");
          opt.value = p.id;
          opt.textContent = `${p.planCode} - ${p.nameEng}`;
          opt.className = "ecors-plan-row";
          select.appendChild(opt);
        });
        if (currentVal) select.value = currentVal;
      }
    } catch (err) {
      select.innerHTML = `<option value="">Cannot load plans</option>`;
    }
  }

  async function fetchDeclaredPlan(forceRefresh = false) {
    // Lock: ป้องกัน concurrent fetches
    if (window.__ecorsState.isFetching) {
      return;
    }

    // Debounce: ถ้าเพิ่ง fetch ไปไม่นาน ให้ skip
    const now = Date.now();
    if (
      !forceRefresh &&
      getLastFetchTime() > 0 &&
      now - getLastFetchTime() < DEBOUNCE_MS
    ) {
      updateStatusDisplay();
      renderButtons();
      return;
    }

    window.__ecorsState.isFetching = true;
    let nextDeclared = null;

    try {
      const res = await fetch(declaredPlanUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });

      if (res.status === 404) {
        setLastFetchTime(now);
      } else if (res.ok) {
        const text = await res.text();
        if (text.trim() !== "") {
          const body = JSON.parse(text);
          const data = Array.isArray(body) ? body[0] : body;

          if (data) {
            const pid =
              data.planId ??
              data.plan_id ??
              data.id ??
              parseInt(data.planCode);
            const status = (data.status ?? "DECLARED").toUpperCase();

            if (pid) {
              nextDeclared = {
                planId: Number(pid),
                status,
                createdAt:
                  data.createdAt ||
                  data.created_at ||
                  new Date().toISOString(),
                updatedAt:
                  data.updatedAt ||
                  data.updated_at ||
                  new Date().toISOString(),
                studentId,
              };
            }
          }
        }
        setLastFetchTime(now);
      }
    } catch (e) {
      // network error - keep existing state
    } finally {
      window.__ecorsState.isFetching = false;
    }

    setDeclaredPlan(nextDeclared);
    updateStatusDisplay();
    renderButtons();
  }

  // ===============================
  // Status text
  // ===============================
  function updateStatusDisplay() {
    if (!statusEl) return;

    const declaredPlanObj = getDeclaredPlan();
    const studyPlans = getStudyPlans();

    if (!declaredPlanObj) {
      statusEl.textContent = "Declaration Status: Not Declared";
      return;
    }

    const plan = studyPlans.find((p) => p.id == declaredPlanObj.planId);
    const planName = plan ? `${plan.planCode} - ${plan.nameEng}` : "Unknown Plan";

    let timeTxt = "";
    if (declaredPlanObj.updatedAt || declaredPlanObj.createdAt) {
      const d = new Date(
        declaredPlanObj.updatedAt || declaredPlanObj.createdAt
      );
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      timeTxt =
        " on " +
        d.toLocaleString("en-GB", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: tz,
        }) +
        ` (${tz})`;
    }

    if (declaredPlanObj.status === "CANCELLED") {
      statusEl.textContent = `Declaration Status: Cancelled ${planName}${timeTxt}`;
    } else {
      statusEl.textContent = `Declaration Status: Declared ${planName}${timeTxt}`;
    }
  }

// ===============================
// Render Buttons
// ===============================
function renderButtons() {
  const declaredPlanObj = getDeclaredPlan();

  // ลบปุ่ม Change ที่อาจหลงเหลือ
  document
    .querySelectorAll(".ecors-button-change")
    .forEach((el) => el.remove());
  buttonArea.innerHTML = "";

  const declareBtn = document.createElement("button");
  declareBtn.className = "ecors-button-declare";
  declareBtn.textContent = "Declare";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "ecors-button-cancel";
  cancelBtn.textContent = "Cancel Declaration";

  // เริ่มต้น: ใส่ Declare + Cancel ไว้ก่อน
  buttonArea.appendChild(declareBtn);
  buttonArea.appendChild(cancelBtn);

  const hasRecord = !!declaredPlanObj;
  const isCancelled =
    declaredPlanObj && declaredPlanObj.status === "CANCELLED";

  // --- CASE 1: ไม่มี record เลย (Not Declared) ---
  if (!hasRecord) {
    select.disabled = false;
    select.value = "";
    cancelBtn.style.display = "none";
    declareBtn.style.display = "inline-block";
    declareBtn.disabled = true;

    select.onchange = () => {
      declareBtn.disabled = !select.value;
    };

    declareBtn.onclick = () => handleDeclare();
    return;
  }

  // --- CASE 2: มี record และ status = CANCELLED ---
  if (isCancelled) {
    select.disabled = false;
    select.value = "";
    declareBtn.style.display = "inline-block";
    declareBtn.disabled = true;
    cancelBtn.style.display = "none";

    select.onchange = () => {
      declareBtn.disabled = !select.value;
    };

    declareBtn.onclick = () => handleDeclare();
    return;
  }

  // --- CASE 3: มี record และ status = DECLARED (ปกติ) ---
  declareBtn.style.display = "none";
  cancelBtn.style.display = "inline-block";
  cancelBtn.disabled = false;

  select.disabled = false;
  select.value = declaredPlanObj.planId;

  // สร้างปุ่ม Change
  const changeBtn = document.createElement("button");
  changeBtn.className = "ecors-button-change";
  changeBtn.textContent = "Change";

  // 🔥 สลับลำดับ ให้ Change อยู่ซ้าย, Cancel อยู่ขวา
  buttonArea.innerHTML = "";
  buttonArea.appendChild(changeBtn);   // ซ้าย
  buttonArea.appendChild(cancelBtn);  // ขวา

  let hasMatching = false;
  for (let i = 0; i < select.options.length; i++) {
    if (select.options[i].value == declaredPlanObj.planId) {
      hasMatching = true;
      break;
    }
  }

  if (!hasMatching) {
    changeBtn.style.display = "none";
    changeBtn.disabled = true;
  } else {
    changeBtn.style.display = "inline-block";
    const isSame = select.value == declaredPlanObj.planId;
    changeBtn.disabled = isSame || !select.value;

    select.onchange = () => {
      const currentDeclared = getDeclaredPlan();
      const same = currentDeclared && select.value == currentDeclared.planId;
      changeBtn.disabled = same || !select.value;
    };
  }

  changeBtn.onclick = () => handleChange();
  cancelBtn.onclick = () => handleCancelClick();
}


  // ===============================
  // Action Handlers
  // ===============================
  async function handleDeclare() {
    const val = select.value;
    if (!val) return;

    try {
      const res = await fetch(declaredPlanUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId: Number(val) }),
      });

      if (res.ok) {
        let data = null;
        try {
          data = await res.json();
        } catch (e) { }

        setDeclaredPlan({
          studentId,
          planId: Number(val),
          status: "DECLARED",
          createdAt:
            data?.createdAt || data?.created_at || new Date().toISOString(),
          updatedAt:
            data?.updatedAt || data?.updated_at || new Date().toISOString(),
        });
        setLastFetchTime(Date.now());
        updateStatusDisplay();
        renderButtons();

        // 🔥 อัปเดต core courses ให้ตรงกับแผนที่เพิ่ง declare
        await fetchPlanCoreCourses();
      } else if (res.status === 409) {
        // ✅ TC-PBI4-3: POST 409 ใช้ hardcoded message (ไม่อ่านจาก API)
        await fetchDeclaredPlan(true);
        await fetchPlanCoreCourses();
        showInfo(
          "You may have declared study plan already. Please check again."
        );
      } else {
        showInfo("There is a problem. Please try again later.");
      }
    } catch (e) {
      showInfo("There is a problem. Please try again later.");
    }
  }

  async function handleChange() {
    const val = select.value;
    if (!val) return;

    try {
      const res = await fetch(declaredPlanUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId: Number(val) }),
      });

      if (res.ok) {
        let data = null;
        try {
          data = await res.json();
        } catch (e) { }

        const currentDeclared = getDeclaredPlan();
        setDeclaredPlan({
          ...currentDeclared,
          planId: Number(val),
          status: "DECLARED",
          updatedAt:
            data?.updatedAt || data?.updated_at || new Date().toISOString(),
          createdAt:
            data?.createdAt ||
            data?.created_at ||
            currentDeclared?.createdAt,
        });
        setLastFetchTime(Date.now());
        updateStatusDisplay();
        renderButtons();
        showInfo("Declaration updated.");

        // 🔥 เปลี่ยนสายแล้ว → core courses ต้องเปลี่ยนตาม
        await fetchPlanCoreCourses();
      } else if (res.status === 404) {
        setDeclaredPlan(null);
        select.value = "";
        updateStatusDisplay();
        renderButtons();
        await fetchPlanCoreCourses();
        showNotFound(studentId);
      } else if (res.status === 409) {
        // ✅ TC-PBI7-3: PUT 409 อ่าน message จาก API
        let errorMsg =
          "You may have declared study plan already. Please check again.";
        try {
          const errorBody = await res.json();
          if (errorBody && errorBody.message) {
            errorMsg = errorBody.message;
          }
        } catch (e) { }
        await fetchDeclaredPlan(true);
        await fetchPlanCoreCourses();
        showInfo(errorMsg);
      } else {
        showInfo("There is a problem. Please try again later.");
      }
    } catch (e) {
      showInfo("There is a problem. Please try again later.");
    }
  }

  function handleCancelClick() {
    const declaredPlanObj = getDeclaredPlan();
    if (!declaredPlanObj) return;

    const studyPlans = getStudyPlans();
    const plan = studyPlans.find((p) => p.id == declaredPlanObj.planId);
    const pName = plan
      ? `${plan.planCode} - ${plan.nameEng}`
      : "your study plan";

    let formatted = "";
    if (declaredPlanObj.updatedAt || declaredPlanObj.createdAt) {
      const d = new Date(
        declaredPlanObj.updatedAt || declaredPlanObj.createdAt
      );
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      formatted =
        d.toLocaleString("en-GB", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: tz,
        }) +
        ` (${tz})`;
    }

    let msg = "Are you sure you want to cancel this declaration?";
    if (formatted) {
      msg = `You have declared ${pName} as your plan on ${formatted}. Are you sure you want to cancel this declaration?`;
    }
    showCancelConfirm(msg);
  }

  // --- Click Cancel Declaration ใน Dialog ---
  if (dialogCancelBtn) {
    dialogCancelBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      const beforeCancel = getDeclaredPlan()
        ? { ...getDeclaredPlan() }
        : null;

      try {
        const res = await fetch(declaredPlanUrl, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        closeInfoDialog();

        if (res.status === 404) {
          setDeclaredPlan(null);
          select.value = "";
          updateStatusDisplay();
          renderButtons();
          await fetchPlanCoreCourses();
          showNotFound(studentId);
          return;
        }

        if (res.status === 409) {
          // ✅ TC-PBI7-2: DELETE 409 อ่าน message จาก API
          let errorMsg =
            "Cannot cancel the declared plan because it is already cancelled.";
          try {
            const errorBody = await res.json();
            if (errorBody && errorBody.message) {
              errorMsg = errorBody.message;
            }
          } catch (e) { }
          await fetchDeclaredPlan(true);
          await fetchPlanCoreCourses();
          showInfo(errorMsg);
          return;
        }

        if (res.ok || res.status === 204) {
          if (beforeCancel) {
            setDeclaredPlan({
              ...beforeCancel,
              status: "CANCELLED",
              updatedAt: new Date().toISOString(),
            });
          } else {
            setDeclaredPlan(null);
          }
          setLastFetchTime(Date.now());
          select.value = "";
          updateStatusDisplay();
          renderButtons();
          await fetchPlanCoreCourses();
          showInfo("Declaration cancelled.");
        } else {
          showInfo("There is a problem. Please try again later.");
        }
      } catch (e) {
        closeInfoDialog();
        showInfo("There is a problem. Please try again later.");
      }
    });
  }

  // ==============================
  // Helper: format วันที่ช่วง Period
  // ==============================
  const CURRENT_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

  function formatPeriod(start, end) {
    if (!start || !end) return "-";

    const s = new Date(start);
    const e = new Date(end);

    const opt = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    };

    const sStr = s.toLocaleString("en-GB", opt);
    const eStr = e.toLocaleString("en-GB", opt);

    return `${sStr} - ${eStr} (${CURRENT_TZ})`;
  }

  // ==============================
  // FETCH Reservation Periods
  // ==============================
  async function fetchReservationPeriods() {
    const url = `${apiBase}/reservation-periods`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch periods: ${res.status}`);
      }

      const data = await res.json();
      const current = data.currentPeriod;
      const next = data.nextPeriod;

      const currentMsgEl = document.querySelector(
        '[data-cy="current-message"]'
      );
      const currentPeriodEl = document.querySelector(
        '[data-cy="current-period"]'
      );
      const nextMsgEl = document.querySelector('[data-cy="next-message"]');
      const nextPeriodEl = document.querySelector('[data-cy="next-period"]');

      // ---------- Current ----------
      if (current) {
        if (currentMsgEl) currentMsgEl.textContent = "Reservation is open";
        if (currentPeriodEl) {
          currentPeriodEl.textContent =
            "Period: " +
            formatPeriod(
              current.start_datetime,
              current.end_datetime
            );
        }
      } else {
        if (currentMsgEl) currentMsgEl.textContent = "Reservation is closed";
        if (currentPeriodEl) currentPeriodEl.textContent = "Period: -";
      }

      // ---------- Next ----------
      if (next) {
        if (nextPeriodEl) {
          nextPeriodEl.textContent =
            "Period: " +
            formatPeriod(next.start_datetime, next.end_datetime);
        }
      } else {
        if (nextPeriodEl) nextPeriodEl.textContent = "Period: -";
      }
    } catch (err) {
      console.error(err);
      const currentPeriodEl = document.querySelector(
        '[data-cy="current-period"]'
      );
      const nextPeriodEl = document.querySelector('[data-cy="next-period"]');
      if (currentPeriodEl) currentPeriodEl.textContent = "Period: -";
      if (nextPeriodEl) nextPeriodEl.textContent = "Period: -";
    }
  }

  // ------------ helper แสดง courses -------------
  function renderCoreCourses(courses, planName, options = {}) {
    const { requireDeclare = false } = options;

    const headerEl = document.querySelector('[data-cy="core-courses-header"]');
    const firstCourseEl = document.querySelector('[data-cy="core-course"]');

    if (!headerEl || !firstCourseEl) return;

    const parent = firstCourseEl.parentElement;

    // เคลียร์ p เดิมๆ ทั้งหมด (รวม Loading / ของเก่า)
    parent.querySelectorAll('[data-cy="core-course"]').forEach((el) => el.remove());

    // =========================
    // กรณียังไม่ได้ declare plan
    // =========================
    if (requireDeclare) {
      headerEl.textContent = "Core Courses for : Not Declared";

      const p = document.createElement("p");
      p.dataset.cy = "core-course";
      p.textContent = "Please declare your study plan first.";
      parent.appendChild(p);
      return;
    }

    // =========================
    // กรณีมีแผนแล้ว แสดงรายวิชา
    // =========================
    headerEl.textContent = `Core Courses for : ${planName}`;

    if (!courses || courses.length === 0) {
      const p = document.createElement("p");
      p.dataset.cy = "core-course";
      p.textContent = "No core courses found.";
      parent.appendChild(p);
      return;
    }

    for (const c of courses) {
      const p = document.createElement("p");
      p.dataset.cy = "core-course";
      p.textContent = `${c.code} ${c.title}`;
      parent.appendChild(p);
    }
  }


  // ------------ helper fetch จาก API -------------
  async function fetchPlanCoreCourses() {
    const url = `${apiBase}/plan-courses`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch plan courses: ${res.status}`);

      const data = await res.json();
      console.log("plan-courses response =", data);

      const declared = getDeclaredPlan();

      // 1) ยังไม่ declared หรือ status = CANCELLED
      if (!declared || declared.status === "CANCELLED") {
        renderCoreCourses([], "Your Plan", { requireDeclare: true });
        return;
      }

      // 2) มี declared แต่ต้องดึง planId ให้ได้ก่อน
      let declaredPlanId =
        declared.planId ?? declared.plan_id ?? declared.study_plan_id ?? null;

      if (!declaredPlanId) {
        renderCoreCourses([], "Your Plan", { requireDeclare: true });
        return;
      }

      const studyPlans = window.__ecorsState.studyPlans || [];

      // หา plan ใน /plan-courses ที่ตรงกับ planId
      let targetPlan =
        data.find((p) => Number(p.planId) === Number(declaredPlanId)) || null;

      if (!targetPlan) {
        // ถ้าหาไม่เจอ ให้ขึ้นว่าไม่มีรายวิชา
        renderCoreCourses([], "Your Plan");
        return;
      }

      // ---------- หาชื่อ plan ให้สวย ๆ ----------
      let planName = "Your Plan";

      // 2.1 ลอง map จาก study_plans ตาม planId ก่อน
      const spName = studyPlans.find(
        (sp) => Number(sp.id) === Number(targetPlan.planId)
      );
      if (spName && spName.name_eng) {
        planName = spName.name_eng;
      } else {
        // 2.2 ถ้าไม่เจอใน study_plans ใช้ข้อความบน declareStatus เป็น fallback
        const statusEl = document.getElementById("declareStatus");
        if (statusEl) {
          const text = statusEl.textContent || "";
          const m = text.match(/Declared\s+(.+?)\s+on/i);
          if (m) {
            const full = m[1].trim(); // "FS - Full-Stack Developer"
            planName = full.replace(/^[A-Z]{2}\s*-\s*/, ""); // ตัด "FS - " ออก
          }
        }
      }

      // แสดงผลปกติ
      renderCoreCourses(targetPlan.courses, planName);
    } catch (err) {
      console.error("fetchPlanCoreCourses error", err);
      renderCoreCourses([], "Your Plan", { requireDeclare: true });
    }
  }


  // --- INIT ---
  (async function mainInit() {
    if (window.__ecorsState.mainInitDone) {
      updateStatusDisplay();
      renderButtons();
      return;
    }

    await loadStudyPlans();
    await fetchDeclaredPlan(true);
    await fetchReservationPeriods();
    await fetchPlanCoreCourses();
    window.__ecorsState.mainInitDone = true;
  })();
});
