// ===============================================
// 신고 상세 단일 화면 — 카톡 업무의뢰 링크로 열립니다.
//  · 사진과 상황설명을 한 화면에서 확인
//  · 로그인 상태면 그 자리에서 조치완료 처리
// ===============================================
(function () {
  const $ = (sel) => document.querySelector(sel);
  const Store = window.Store;

  const ROLE_NAMES = { master: "마스터", manager: "시설팀장", staff: "담당자(공용)" };
  const ROLE_KEY = "fs_role";
  let role = sessionStorage.getItem(ROLE_KEY) || localStorage.getItem(ROLE_KEY);
  if (!ROLE_NAMES[role]) role = null;

  const reportId = new URLSearchParams(location.search).get("id");
  let report = null;

  // ---------- 공통 유틸 ----------
  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
  const pad = (n) => String(n).padStart(2, "0");
  function fmtDateTime(v) {
    if (!v) return "-";
    const d = new Date(v);
    if (isNaN(d)) return String(v);
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fmtDate(v) {
    if (!v) return "-";
    const d = new Date(v);
    if (isNaN(d)) return String(v);
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  }
  function statusOf(r) {
    if (r.status === "조치완료") return "조치완료";
    return (r.assignee && String(r.assignee).trim()) ? "진행중" : "접수";
  }
  function statusClass(s) {
    return s === "조치완료" ? "status-done" : s === "진행중" ? "status-progress" : "status-new";
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2600);
  }

  let donePhotoData = null;   // 첨부한 완료사진 (업로드 전)

  // ---------- 화면 그리기 ----------
  function render() {
    if (!report) {
      $("#viewBody").innerHTML =
        '<p class="empty-msg">신고를 찾을 수 없습니다.<br>링크가 정확한지 확인해 주세요.</p>';
      return;
    }
    const r = report;
    const st = statusOf(r);
    const done = st === "조치완료";

    // 조치완료 처리 영역 (로그인 상태에 따라 다름)
    let actHtml;
    if (done) {
      actHtml = `
        <div class="act-card done">
          <div class="done-banner"><span class="mark">✓</span><span>조치완료 처리되었습니다</span></div>
          <p class="act-sub" style="margin:10px 0 0">조치일 ${fmtDate(r.completedAt)}</p>
          ${role ? '<button type="button" id="undoBtn" class="undo-btn">조치완료 해제</button>' : ""}
        </div>`;
    } else if (role) {
      actHtml = `
        <div class="act-card">
          <div class="act-title">현장 조치를 마치셨나요?</div>
          <p class="act-sub">조치한 상태를 찍은 <b>완료 사진을 첨부해야</b> 완료 처리할 수 있습니다.</p>
          <label class="photo-drop" id="donePhotoDrop">
            <input type="file" id="donePhoto" accept="image/*" hidden>
            <span id="donePhotoText">📷 완료 사진 촬영 · 선택</span>
          </label>
          <img id="donePreview" class="done-preview hidden" alt="완료 사진 미리보기">
          <button type="button" id="doneBtn" class="done-big" disabled>조치완료 처리</button>
          <p class="act-note" id="doneNote">완료 사진을 첨부하면 버튼이 활성화됩니다.</p>
        </div>`;
    } else {
      actHtml = `
        <div class="act-card">
          <div class="act-title">조치완료 처리</div>
          <p class="act-sub">담당자 로그인 후 완료 사진을 첨부하고 완료 처리할 수 있습니다.</p>
          <button type="button" id="loginBtn" class="done-big">로그인하고 완료 처리</button>
        </div>`;
    }

    // 조치완료된 건은 조치 전·후 사진을 나란히 표시
    const photoHtml = (done && r.donePhoto) ? `
        <div class="ba-grid">
          <div class="ba-item">
            <div class="ba-label before">조치 전</div>
            <img class="view-photo" data-full="${escapeHtml(r.photo)}" src="${escapeHtml(r.photo)}" alt="조치 전 사진">
          </div>
          <div class="ba-item">
            <div class="ba-label after">조치 후</div>
            <img class="view-photo" data-full="${escapeHtml(r.donePhoto)}" src="${escapeHtml(r.donePhoto)}" alt="조치 후 사진">
          </div>
        </div>
        <p class="photo-hint">사진을 누르면 크게 볼 수 있습니다</p>`
      : `
        <img class="view-photo" data-full="${escapeHtml(r.photo)}" src="${escapeHtml(r.photo)}" alt="현장 사진">
        <p class="photo-hint">사진을 누르면 크게 볼 수 있습니다</p>`;

    $("#viewBody").innerHTML = `
      <div class="view-card">
        <div class="view-top">
          <span class="type-badge">${escapeHtml(r.type)}</span>
          <span class="status-badge ${statusClass(st)}">${escapeHtml(st)}</span>
        </div>
        <div class="view-loc">${escapeHtml(r.location)}</div>
        <div class="view-when">발생일시 ${fmtDateTime(r.occurredAt)}</div>

        <div class="view-desc">${escapeHtml(r.description)}</div>

        ${photoHtml}
      </div>

      <div class="view-card">
        <table class="view-table">
          <tr><th>담당자</th><td>${escapeHtml(r.assignee || "미지정")}</td></tr>
          <tr><th>상태</th><td><span class="status-badge ${statusClass(st)}">${escapeHtml(st)}</span></td></tr>
          <tr><th>조치일</th><td>${r.completedAt ? fmtDate(r.completedAt) : "-"}</td></tr>
          ${role && r.contact ? `<tr><th>연락처</th><td>${escapeHtml(r.contact)}</td></tr>` : ""}
        </table>
      </div>

      ${actHtml}
    `;

    // 사진 크게 보기
    document.querySelectorAll(".view-photo").forEach((img) =>
      img.addEventListener("click", () => {
        $("#photoFull").src = img.dataset.full;
        $("#photoModal").classList.remove("hidden");
      })
    );

    // 완료 사진 첨부
    if ($("#donePhoto")) {
      $("#donePhoto").addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          donePhotoData = await window.compressImage(file);
          $("#donePreview").src = donePhotoData;
          $("#donePreview").classList.remove("hidden");
          $("#donePhotoText").textContent = "📷 사진 다시 선택";
          $("#doneBtn").disabled = false;
          $("#doneNote").textContent = "이제 아래 버튼을 눌러 완료 처리하세요.";
        } catch {
          toast("사진을 불러올 수 없습니다. 다시 시도해 주세요.");
        }
      });
    }

    if ($("#doneBtn")) $("#doneBtn").addEventListener("click", () => setDone(true));
    if ($("#undoBtn")) $("#undoBtn").addEventListener("click", () => {
      if (confirm("조치완료를 해제할까요? 첨부한 완료 사진도 함께 지워집니다.")) setDone(false);
    });
    if ($("#loginBtn")) $("#loginBtn").addEventListener("click", openLogin);
  }

  async function setDone(done) {
    if (done && !donePhotoData) return toast("완료 사진을 먼저 첨부해 주세요.");
    const btn = $("#doneBtn") || $("#undoBtn");
    if (btn) { btn.disabled = true; btn.textContent = done ? "사진 올리는 중..." : "처리 중..."; }
    try {
      const back = (report.assignee && String(report.assignee).trim()) ? "진행중" : "접수";
      const patch = {
        status: done ? "조치완료" : back,
        completedAt: done ? new Date().toISOString().slice(0, 10) : null,
        donePhoto: done ? await Store.uploadPhoto(donePhotoData) : null
      };
      await Store.updateReport(report.id, patch);
      Object.assign(report, patch);
      donePhotoData = null;
      render();
      toast(done ? "조치완료 처리되었습니다. 수고하셨습니다!" : "진행중으로 되돌렸습니다.");
    } catch (err) {
      console.error(err);
      toast("처리에 실패했습니다. 네트워크를 확인해 주세요.");
      render();
    }
  }

  // ---------- 사진 원본 ----------
  function closePhoto() { $("#photoModal").classList.add("hidden"); }
  $("#photoCloseBtn").addEventListener("click", closePhoto);
  $("#photoModal").addEventListener("click", (e) => {
    if (e.target !== $("#photoFull")) closePhoto();
  });

  // ---------- 로그인 ----------
  function openLogin() {
    $("#mLoginError").classList.add("hidden");
    $("#loginModal").classList.remove("hidden");
    setTimeout(() => $("#mLoginCode").focus(), 50);
  }
  function closeLogin() {
    $("#loginModal").classList.add("hidden");
    $("#mLoginCode").value = "";
  }
  $("#loginCloseBtn").addEventListener("click", closeLogin);
  $("#loginModal").addEventListener("click", (e) => {
    if (e.target === $("#loginModal")) closeLogin();
  });

  async function resolveRole(code) {
    if (code && code === window.APP_CONFIG.masterCode) return "master";
    const s = await Store.getSettings();
    if (code && code === s.pw_manager) return "manager";
    if (code && code === s.pw_staff) return "staff";
    return null;
  }

  $("#mLoginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const found = await resolveRole($("#mLoginCode").value);
    if (found) {
      role = found;
      if ($("#mRemember").checked) {
        localStorage.setItem(ROLE_KEY, role);
        sessionStorage.removeItem(ROLE_KEY);
      } else {
        sessionStorage.setItem(ROLE_KEY, role);
        localStorage.removeItem(ROLE_KEY);
      }
      closeLogin();
      render();
      toast(`${ROLE_NAMES[role]} 계정으로 로그인했습니다.`);
    } else {
      $("#mLoginError").classList.remove("hidden");
      $("#mLoginCode").value = "";
      $("#mLoginCode").focus();
    }
  });

  // ---------- 초기화 ----------
  async function init() {
    if (!(window.CSS && CSS.supports && CSS.supports("-webkit-text-security", "disc"))) {
      $("#mLoginCode").type = "password";
    }
    if (!reportId) {
      $("#viewBody").innerHTML =
        '<p class="empty-msg">신고 번호가 없습니다.<br>카카오톡으로 받은 링크를 그대로 열어 주세요.</p>';
      return;
    }
    try {
      await Store.init();
      report = await Store.getReport(reportId);
    } catch (err) {
      console.error(err);
      $("#viewBody").innerHTML = '<p class="empty-msg">신고를 불러오지 못했습니다.</p>';
      return;
    }
    render();
  }
  init();
})();
