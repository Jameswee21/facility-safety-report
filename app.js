// ===============================================
// 시설 보수 신고 및 안전 건의 — 앱 로직
// ===============================================
(function () {
  const $ = (sel) => document.querySelector(sel);
  const Store = window.Store;

  const ROLE_NAMES = { master: "마스터", manager: "시설팀장", staff: "담당자(공용)" };
  let role = sessionStorage.getItem("fs_role");
  if (!ROLE_NAMES[role]) role = null;
  sessionStorage.removeItem("fs_admin"); // 이전 버전 세션 정리
  let adminMode = !!role;
  const canManage = () => role === "master" || role === "manager";
  let reportsCache = [];
  let photoDataUrl = null;

  // ---------- 공통 유틸 ----------
  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function fmtDateTime(v) {
    if (!v) return "-";
    const d = new Date(v);
    if (isNaN(d)) return String(v);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function fmtDate(v) {
    if (!v) return "-";
    const d = new Date(v);
    if (isNaN(d)) return String(v);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2600);
  }

  // ---------- 탭 전환 ----------
  function switchView(name) {
    document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
    $(`#view-${name}`).classList.remove("hidden");
    document.querySelectorAll(".tab").forEach((t) =>
      t.classList.toggle("active", t.dataset.view === name)
    );
    if (name === "list") renderReports();
    if (name === "board") renderSuggestions();
    window.scrollTo(0, 0);
  }

  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => switchView(t.dataset.view))
  );

  // ---------- 관리자 모드 (3단계 계정) ----------
  function refreshAdminUI() {
    $("#adminStateBar").classList.toggle("hidden", !adminMode);
    $("#adminStateText").textContent = adminMode ? `🔑 ${ROLE_NAMES[role]} 계정` : "";
    $("#adminBtn").textContent = adminMode ? "관리자 ✓" : "관리자";
  }

  async function resolveRole(code) {
    if (code && code === window.APP_CONFIG.masterCode) return "master";
    const s = await Store.getSettings();
    if (code && code === s.pw_manager) return "manager";
    if (code && code === s.pw_staff) return "staff";
    return null;
  }

  $("#adminBtn").addEventListener("click", async () => {
    if (adminMode) { switchView("list"); return; }
    const code = prompt("계정 비밀번호를 입력하세요.\n(마스터 / 시설팀장 / 담당자 공용)");
    if (code === null) return;
    const found = await resolveRole(code);
    if (found) {
      role = found;
      adminMode = true;
      sessionStorage.setItem("fs_role", role);
      refreshAdminUI();
      toast(`${ROLE_NAMES[role]} 계정으로 로그인했습니다.`);
      switchView("list");
    } else {
      toast("비밀번호가 올바르지 않습니다.");
    }
  });

  $("#adminLogoutBtn").addEventListener("click", () => {
    adminMode = false;
    role = null;
    sessionStorage.removeItem("fs_role");
    refreshAdminUI();
    renderReports();
    toast("로그아웃했습니다.");
  });

  // ---------- 신고화면 ----------
  function setDefaultDateTime() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    $("#occurredAt").value = d.toISOString().slice(0, 16);
  }

  // 사진 첨부 + 압축(최대 1024px, 목표 150KB 이하가 될 때까지 품질 단계 하향)
  async function compressImage(file, maxDim = 1024, targetKB = 150) {
    const dataUrl = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = dataUrl;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    // 목표 용량에 들어올 때까지 품질을 낮춰가며 재압축 (최저 40%)
    let quality = 0.7;
    let out = canvas.toDataURL("image/jpeg", quality);
    while (out.length * 0.75 > targetKB * 1024 && quality > 0.4) {
      quality -= 0.1;
      out = canvas.toDataURL("image/jpeg", quality);
    }
    return out;
  }

  $("#photo").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      photoDataUrl = await compressImage(file);
      const prev = $("#photoPreview");
      prev.src = photoDataUrl;
      prev.classList.remove("hidden");
      $("#photoDropText").textContent = "📷 사진 변경하기";
      updateSubmitState();
    } catch {
      toast("사진을 불러올 수 없습니다. 다른 사진을 선택해 주세요.");
    }
  });

  // 연락처 입력 시 개인정보 동의 화면 표시 + 제출버튼 제어
  function updateSubmitState() {
    const hasContact = $("#contact").value.trim().length > 0;
    $("#consentBox").classList.toggle("hidden", !hasContact);
    if (!hasContact) $("#consentCheck").checked = false;
    $("#submitBtn").disabled = hasContact && !$("#consentCheck").checked;
  }
  $("#contact").addEventListener("input", updateSubmitState);
  $("#consentCheck").addEventListener("change", updateSubmitState);

  $("#reportForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const type = document.querySelector('input[name="type"]:checked');
    if (!type) return toast("신고유형을 선택해 주세요.");
    if (!$("#location").value.trim()) return toast("발생 위치를 입력해 주세요.");
    if (!$("#occurredAt").value) return toast("발생일시를 선택해 주세요.");
    if (!$("#description").value.trim()) return toast("상황설명을 입력해 주세요.");
    if (!photoDataUrl) return toast("사진첨부는 필수입니다.");
    const contact = $("#contact").value.trim();
    if (contact && !$("#consentCheck").checked)
      return toast("개인정보 수집 및 이용에 동의해 주세요.");

    const btn = $("#submitBtn");
    btn.disabled = true;
    btn.textContent = "제출 중...";
    try {
      await Store.addReport({
        id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: type.value,
        location: $("#location").value.trim(),
        occurredAt: $("#occurredAt").value,
        description: $("#description").value.trim(),
        photo: photoDataUrl,
        contact: contact || null,
        consent: !!contact,
        assignee: null,
        status: "진행중",
        completedAt: null,
        createdAt: new Date().toISOString()
      });
      // 폼 초기화
      $("#reportForm").reset();
      photoDataUrl = null;
      $("#photoPreview").classList.add("hidden");
      $("#photoDropText").textContent = "📷 눌러서 사진 선택 또는 촬영";
      setDefaultDateTime();
      updateSubmitState();
      toast("신고가 접수되었습니다. 감사합니다!");
      switchView("list");
    } catch (err) {
      console.error(err);
      toast("제출에 실패했습니다: " + (err.message || "네트워크를 확인해 주세요."));
    } finally {
      btn.disabled = false;
      btn.textContent = "제출";
      updateSubmitState();
    }
  });

  // ---------- 신고내역 확인 및 처리현황 ----------
  async function renderReports() {
    const wrap = $("#reportList");
    wrap.innerHTML = '<div class="empty-msg">불러오는 중...</div>';
    try {
      reportsCache = await Store.listReports();
    } catch (err) {
      console.error(err);
      wrap.innerHTML = '<div class="empty-msg">신고내역을 불러오지 못했습니다.</div>';
      return;
    }
    if (!reportsCache.length) {
      wrap.innerHTML = '<div class="empty-msg">아직 접수된 신고가 없습니다.</div>';
      return;
    }
    wrap.innerHTML = reportsCache.map((r) => {
      const done = r.status === "조치완료";
      return `
      <div class="report-card" data-id="${escapeHtml(r.id)}">
        <div class="row1">
          <span class="type-badge">${escapeHtml(r.type)}</span>
          <span class="status-badge ${done ? "status-done" : "status-progress"}">${escapeHtml(r.status)}</span>
        </div>
        <div class="loc">${escapeHtml(r.location)}</div>
        <div class="meta">
          <span>발생 ${fmtDateTime(r.occurredAt)}</span>
          <span>담당자 ${escapeHtml(r.assignee || "미지정")}</span>
          <span>조치일 ${r.completedAt ? fmtDate(r.completedAt) : "-"}</span>
        </div>
      </div>`;
    }).join("");

    wrap.querySelectorAll(".report-card").forEach((card) =>
      card.addEventListener("click", () => openDetail(card.dataset.id))
    );
  }

  function openDetail(id) {
    const r = reportsCache.find((x) => String(x.id) === String(id));
    if (!r) return;
    const done = r.status === "조치완료";

    let adminHtml = "";
    if (adminMode) {
      const assignRow = canManage() ? `
        <div class="assignee-row">
          <input type="text" id="assigneeInput" placeholder="담당자 이름" value="${escapeHtml(r.assignee || "")}">
          <button type="button" id="assigneeSaveBtn">담당자 지정</button>
        </div>` : "";
      adminHtml = `
      <div class="admin-panel">
        <h4>🔑 ${ROLE_NAMES[role]} 처리</h4>
        ${assignRow}
        <label class="done-check">
          <input type="checkbox" id="doneCheck" ${done ? "checked" : ""}>
          <span>${done ? "조치완료됨 (해제하면 진행중으로 변경)" : "진행중 — 체크하면 조치완료 처리"}</span>
        </label>
      </div>`;
    }

    $("#detailBody").innerHTML = `
      <table class="detail-table">
        <tr><th>신고유형</th><td>${escapeHtml(r.type)}</td></tr>
        <tr><th>발생일시</th><td>${fmtDateTime(r.occurredAt)}</td></tr>
        <tr><th>발생위치</th><td>${escapeHtml(r.location)}</td></tr>
        <tr><th>상황설명</th><td style="white-space:pre-wrap">${escapeHtml(r.description)}</td></tr>
        <tr><th>담당자</th><td>${escapeHtml(r.assignee || "미지정")}</td></tr>
        <tr><th>조치일</th><td>${r.completedAt ? fmtDate(r.completedAt) : "-"}</td></tr>
        <tr><th>상태</th><td><span class="status-badge ${done ? "status-done" : "status-progress"}">${escapeHtml(r.status)}</span></td></tr>
        ${canManage() && r.contact ? `<tr><th>연락처</th><td>${escapeHtml(r.contact)}</td></tr>` : ""}
      </table>
      <img class="detail-photo" src="${escapeHtml(r.photo)}" alt="신고 사진">
      ${adminHtml}
    `;
    $("#detailModal").classList.remove("hidden");

    if (adminMode) {
      if (canManage()) $("#assigneeSaveBtn").addEventListener("click", async () => {
        const name = $("#assigneeInput").value.trim();
        try {
          await Store.updateReport(r.id, { assignee: name || null });
          toast(name ? `담당자를 '${name}'(으)로 지정했습니다.` : "담당자 지정을 해제했습니다.");
          closeDetail();
          renderReports();
        } catch (err) { console.error(err); toast("저장에 실패했습니다."); }
      });

      $("#doneCheck").addEventListener("change", async (e) => {
        const checked = e.target.checked;
        try {
          await Store.updateReport(r.id, {
            status: checked ? "조치완료" : "진행중",
            completedAt: checked ? new Date().toISOString().slice(0, 10) : null
          });
          toast(checked ? "조치완료 처리되었습니다. (조치일 자동 입력)" : "진행중으로 변경되었습니다.");
          closeDetail();
          renderReports();
        } catch (err) { console.error(err); toast("저장에 실패했습니다."); }
      });
    }
  }

  function closeDetail() { $("#detailModal").classList.add("hidden"); }
  $("#detailCloseBtn").addEventListener("click", closeDetail);
  $("#detailModal").addEventListener("click", (e) => {
    if (e.target === $("#detailModal")) closeDetail();
  });

  // ---------- 안전 건의함 ----------
  $("#writeBtn").addEventListener("click", () => {
    $("#suggestForm").classList.toggle("hidden");
  });
  $("#writeCancelBtn").addEventListener("click", () => {
    $("#suggestForm").reset();
    $("#suggestForm").classList.add("hidden");
  });

  $("#suggestForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("#sTitle").value.trim();
    const content = $("#sContent").value.trim();
    if (!title || !content) return toast("제목과 내용을 입력해 주세요.");
    try {
      await Store.addSuggestion({
        id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title,
        content,
        author: $("#sAuthor").value.trim() || null,
        createdAt: new Date().toISOString()
      });
      $("#suggestForm").reset();
      $("#suggestForm").classList.add("hidden");
      toast("건의가 등록되었습니다.");
      renderSuggestions();
    } catch (err) {
      console.error(err);
      toast("등록에 실패했습니다.");
    }
  });

  async function renderSuggestions() {
    const wrap = $("#suggestList");
    wrap.innerHTML = '<div class="empty-msg">불러오는 중...</div>';
    let list = [];
    try {
      list = await Store.listSuggestions();
    } catch (err) {
      console.error(err);
      wrap.innerHTML = '<div class="empty-msg">건의 목록을 불러오지 못했습니다.</div>';
      return;
    }
    if (!list.length) {
      wrap.innerHTML = '<div class="empty-msg">등록된 건의가 없습니다.<br>첫 번째 안전 건의를 남겨보세요!</div>';
      return;
    }
    wrap.innerHTML = list.map((s) => `
      <div class="suggest-card">
        <div class="s-title">${escapeHtml(s.title)}</div>
        <div class="s-meta">${escapeHtml(s.author || "익명")} · ${fmtDateTime(s.createdAt)}</div>
        <div class="s-content">${escapeHtml(s.content)}</div>
      </div>`).join("");
  }

  // ---------- 초기화 ----------
  async function init() {
    $("#headerTitle").textContent = window.APP_CONFIG.appName;
    document.title = window.APP_CONFIG.appName;
    setDefaultDateTime();
    updateSubmitState();
    refreshAdminUI();
    try {
      await Store.init();
    } catch (err) {
      console.error(err);
      toast("데이터 저장소 연결에 실패했습니다.");
    }
    if (Store.mode === "local") $("#modeBanner").classList.remove("hidden");
  }
  init();
})();
