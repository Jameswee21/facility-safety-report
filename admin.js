// ===============================================
// 관리자 대시보드 (PC 전용) — 신고 모니터링/처리
// 모바일 신고 사이트와 동일한 저장소(Store)를 사용합니다.
// ===============================================
(function () {
  const $ = (sel) => document.querySelector(sel);
  const Store = window.Store;

  let reportsCache = [];
  let refreshTimer = null;

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

  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 2600);
  }

  // ---------- 로그인 게이트 (3단계 계정) ----------
  const ROLE_NAMES = { master: "마스터", manager: "시설팀장", staff: "담당자(공용)" };
  let role = sessionStorage.getItem("fs_role");
  if (!ROLE_NAMES[role]) role = null;
  sessionStorage.removeItem("fs_admin"); // 이전 버전 세션 정리

  const isMaster = () => role === "master";
  const canManage = () => role === "master" || role === "manager";

  async function resolveRole(code) {
    if (code && code === window.APP_CONFIG.masterCode) return "master";
    const s = await Store.getSettings();
    if (code && code === s.pw_manager) return "manager";
    if (code && code === s.pw_staff) return "staff";
    return null;
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const found = await resolveRole($("#loginCode").value);
    if (found) {
      role = found;
      sessionStorage.setItem("fs_role", role);
      $("#loginError").classList.add("hidden");
      enterDashboard();
    } else {
      $("#loginError").classList.remove("hidden");
      $("#loginCode").value = "";
      $("#loginCode").focus();
    }
  });

  $("#logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("fs_role");
    location.reload();
  });

  function enterDashboard() {
    $("#loginGate").classList.add("hidden");
    $("#dashboard").classList.remove("hidden");
    $("#storeModeBadge").textContent =
      Store.mode === "supabase" ? "운영 DB 연결됨" : "데모 모드 (이 기기 데이터)";
    $("#roleBadge").textContent = `👤 ${ROLE_NAMES[role]}`;
    $("#csvBtn").classList.toggle("hidden", !canManage());
    $("#pwBtn").classList.toggle("hidden", !isMaster());
    startClock();
    loadReports();
    loadSuggestions();
    refreshTimer = setInterval(() => {
      if (document.visibilityState === "visible") loadReports(true);
    }, 60000);
  }

  // ---------- 시계 ----------
  function startClock() {
    const tick = () => {
      const d = new Date();
      $("#clock").textContent =
        `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    tick();
    setInterval(tick, 1000);
  }

  // ---------- 신고 목록 ----------
  async function loadReports(silent) {
    try {
      reportsCache = await Store.listReports();
    } catch (err) {
      console.error(err);
      if (!silent) toast("신고내역을 불러오지 못했습니다.");
      return;
    }
    renderStats();
    renderTable();
  }

  function renderStats() {
    const today = new Date();
    // 접수일시(UTC 저장)를 이 컴퓨터의 현지 시간대로 변환해 오늘 여부 판단
    const isToday = (v) => {
      if (!v) return false;
      const d = new Date(v);
      return !isNaN(d) &&
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate();
    };
    $("#statTotal").textContent = reportsCache.length;
    $("#statProgress").textContent = reportsCache.filter((r) => r.status === "진행중").length;
    $("#statDone").textContent = reportsCache.filter((r) => r.status === "조치완료").length;
    $("#statToday").textContent = reportsCache.filter((r) => isToday(r.createdAt)).length;
  }

  function applyFilters(list) {
    const st = $("#filterStatus").value;
    const ty = $("#filterType").value;
    const q = $("#filterSearch").value.trim().toLowerCase();
    return list.filter((r) => {
      if (st && r.status !== st) return false;
      if (ty && r.type !== ty) return false;
      if (q) {
        const hay = `${r.location} ${r.description} ${r.assignee || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function renderTable() {
    const tbody = $("#reportTbody");
    const list = applyFilters(reportsCache);
    $("#reportEmpty").classList.toggle("hidden", list.length > 0);

    tbody.innerHTML = list.map((r) => {
      const done = r.status === "조치완료";
      return `
      <tr data-id="${escapeHtml(r.id)}">
        <td class="cell-datetime">${fmtDateTime(r.occurredAt)}</td>
        <td><span class="type-badge">${escapeHtml(r.type)}</span></td>
        <td class="cell-loc">${escapeHtml(r.location)}</td>
        <td>
          <div class="inspect-cell" data-act="detail">
            <img src="${escapeHtml(r.photo)}" alt="신고 사진" loading="lazy">
            <span class="desc">${escapeHtml(r.description)}</span>
            <span class="more">상세 ›</span>
          </div>
        </td>
        <td>
          ${canManage()
            ? `<input class="assignee-input" data-act="assignee" value="${escapeHtml(r.assignee || "")}"
                 placeholder="담당자 입력" title="입력 후 Enter 또는 다른 곳 클릭 시 저장">`
            : escapeHtml(r.assignee || "미지정")}
        </td>
        <td class="cell-datetime">${r.completedAt ? fmtDate(r.completedAt) : "-"}</td>
        <td><span class="status-badge ${done ? "status-done" : "status-progress"}">${escapeHtml(r.status)}</span></td>
        <td class="done-cell">
          <label><input type="checkbox" data-act="done" ${done ? "checked" : ""}><span>${done ? "완료됨" : "완료 처리"}</span></label>
        </td>
      </tr>`;
    }).join("");

    // 이벤트 연결
    tbody.querySelectorAll('[data-act="detail"]').forEach((el) =>
      el.addEventListener("click", () => openDetail(el.closest("tr").dataset.id))
    );

    tbody.querySelectorAll('[data-act="assignee"]').forEach((input) => {
      const id = input.closest("tr").dataset.id;
      const original = input.value;
      const save = async () => {
        const name = input.value.trim();
        if (name === original.trim()) return;
        try {
          await Store.updateReport(id, { assignee: name || null });
          toast(name ? `담당자를 '${name}'(으)로 지정했습니다.` : "담당자 지정을 해제했습니다.");
          loadReports(true);
        } catch (err) { console.error(err); toast("담당자 저장에 실패했습니다."); }
      };
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
      input.addEventListener("blur", save);
    });

    tbody.querySelectorAll('[data-act="done"]').forEach((chk) => {
      const id = chk.closest("tr").dataset.id;
      chk.addEventListener("change", async () => {
        const checked = chk.checked;
        if (!checked && !confirm("조치완료를 해제하고 '진행중'으로 되돌릴까요?")) {
          chk.checked = true;
          return;
        }
        try {
          await Store.updateReport(id, {
            status: checked ? "조치완료" : "진행중",
            completedAt: checked ? new Date().toISOString().slice(0, 10) : null
          });
          toast(checked ? "조치완료 처리되었습니다. (조치일 자동 입력)" : "진행중으로 변경되었습니다.");
          loadReports(true);
        } catch (err) { console.error(err); toast("상태 변경에 실패했습니다."); }
      });
    });
  }

  ["filterStatus", "filterType"].forEach((id) =>
    $("#" + id).addEventListener("change", renderTable)
  );
  $("#filterSearch").addEventListener("input", renderTable);
  $("#refreshBtn").addEventListener("click", () => { loadReports(); toast("새로고침했습니다."); });

  // ---------- 상세 모달 ----------
  let detailId = null;
  let detailEditing = false;

  const REPORT_TYPES = [
    "유해 위험 요소(아차사고 포함)",
    "시설파손/고장",
    "위생/환경",
    "기타"
  ];

  // DB의 UTC 값을 datetime-local 입력용 현지 시각 문자열로 변환
  function toLocalInput(v) {
    const d = new Date(v);
    if (isNaN(d)) return "";
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function buildKakaoMsg(r) {
    const photoLine = /^https?:/.test(r.photo || "")
      ? `■ 현장사진: ${r.photo}`
      : "■ 현장사진: 관리자 대시보드에서 확인";
    return [
      "[시설 보수 업무의뢰]",
      `■ 신고유형: ${r.type}`,
      `■ 발생일시: ${fmtDateTime(r.occurredAt)}`,
      `■ 발생위치: ${r.location}`,
      `■ 상황설명: ${r.description}`,
      `■ 담당자: ${r.assignee || ""}`,
      photoLine,
      // 담당자는 주로 휴대폰으로 확인하므로 모바일용 신고 사이트로 연결
      `■ 처리현황 확인: ${new URL(".", location.href).href}`,
      "",
      "확인 후 조치 부탁드립니다. 조치 완료 시 위 링크의 '신고내역·처리현황'에서 관리자 모드로 완료 처리해 주세요."
    ].join("\n");
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    }
  }

  function openDetail(id) {
    detailId = id;
    detailEditing = false;
    renderDetail();
    $("#detailModal").classList.remove("hidden");
  }

  // 마스터 전용: 신고내용 수정 화면
  function renderDetailEdit(r) {
    $("#detailTitleTag").textContent = "(수정 중)";
    $("#detailBody").innerHTML = `
      <div class="edit-form">
        <label class="pw-label">신고유형</label>
        <select id="editType">
          ${REPORT_TYPES.map((t) =>
            `<option value="${escapeHtml(t)}" ${t === r.type ? "selected" : ""}>${escapeHtml(t)}</option>`
          ).join("")}
        </select>

        <label class="pw-label">발생일시</label>
        <input type="datetime-local" id="editOccurredAt" value="${toLocalInput(r.occurredAt)}">

        <label class="pw-label">발생위치</label>
        <input type="text" id="editLocation" value="${escapeHtml(r.location || "")}">

        <label class="pw-label">상황설명</label>
        <textarea id="editDescription" rows="5">${escapeHtml(r.description || "")}</textarea>

        <label class="pw-label">연락처 <span style="font-weight:400;color:var(--muted)">(비우면 삭제)</span></label>
        <input type="text" id="editContact" value="${escapeHtml(r.contact || "")}">

        <div class="edit-btn-row">
          <button type="button" id="editSaveBtn" class="save-btn">💾 저장</button>
          <button type="button" id="editCancelBtn" class="cancel-btn">취소</button>
        </div>
        <p class="kakao-hint">사진은 수정할 수 없습니다. 사진을 바꿔야 하면 신고를 삭제하고 다시 접수해 주세요.</p>
      </div>
    `;

    $("#editSaveBtn").addEventListener("click", async () => {
      const type = $("#editType").value;
      const occurredAt = $("#editOccurredAt").value;
      const location = $("#editLocation").value.trim();
      const description = $("#editDescription").value.trim();
      const contact = $("#editContact").value.trim();
      if (!occurredAt) return toast("발생일시를 입력해 주세요.");
      if (!location) return toast("발생위치를 입력해 주세요.");
      if (!description) return toast("상황설명을 입력해 주세요.");

      const btn = $("#editSaveBtn");
      btn.disabled = true;
      btn.textContent = "저장 중...";
      try {
        await Store.updateReport(r.id, {
          type, occurredAt, location, description, contact: contact || null
        });
        await loadReports(true);
        detailEditing = false;
        renderDetail();
        toast("신고내용이 수정되었습니다.");
      } catch (err) {
        console.error(err);
        toast("수정에 실패했습니다.");
        btn.disabled = false;
        btn.textContent = "💾 저장";
      }
    });

    $("#editCancelBtn").addEventListener("click", () => {
      detailEditing = false;
      renderDetail();
    });
  }

  function renderDetail() {
    const r = reportsCache.find((x) => String(x.id) === String(detailId));
    if (!r) return;
    if (detailEditing && isMaster()) { renderDetailEdit(r); return; }
    const done = r.status === "조치완료";
    const assigned = !!(r.assignee && String(r.assignee).trim());

    $("#detailTitleTag").textContent = assigned ? "" : "(담당자 지정 필요)";

    const manageHtml = canManage() ? `
      <div class="detail-assign">
        <input type="text" id="detailAssignee" placeholder="담당자 이름 입력" value="${escapeHtml(r.assignee || "")}">
        <button type="button" id="detailAssignSave">담당자 지정</button>
      </div>

      <div class="kakao-box">
        <button type="button" id="kakaoGenBtn" class="kakao-btn" ${assigned ? "" : "disabled"}>💬 업무의뢰 카톡 메시지 생성</button>
        ${assigned ? "" : '<p class="kakao-hint">담당자를 지정하면 카톡 메시지를 만들 수 있습니다.</p>'}
        <div id="kakaoMsgWrap" class="kakao-msg-wrap hidden">
          <textarea id="kakaoMsg" readonly rows="11"></textarea>
          <button type="button" id="kakaoCopyBtn" class="kakao-btn">📋 메시지 복사하기</button>
          <p class="kakao-hint">복사한 뒤 담당자와의 카카오톡 채팅방에 붙여넣어 전송하세요. 사진은 링크를 누르면 열립니다.</p>
        </div>
      </div>` : "";

    $("#detailBody").innerHTML = `
      <table class="detail-table">
        <tr><th>신고유형</th><td>${escapeHtml(r.type)}</td></tr>
        <tr><th>발생일시</th><td>${fmtDateTime(r.occurredAt)}</td></tr>
        <tr><th>발생위치</th><td>${escapeHtml(r.location)}</td></tr>
        <tr><th>상황설명</th><td style="white-space:pre-wrap">${escapeHtml(r.description)}</td></tr>
        <tr><th>연락처</th><td>${escapeHtml(r.contact || "-")}</td></tr>
        <tr><th>담당자</th><td>${assigned ? escapeHtml(r.assignee) : '<span class="need-assign">미지정</span>'}</td></tr>
        <tr><th>조치일</th><td>${r.completedAt ? fmtDate(r.completedAt) : "-"}</td></tr>
        <tr><th>상태</th><td><span class="status-badge ${done ? "status-done" : "status-progress"}">${escapeHtml(r.status)}</span></td></tr>
        <tr><th>접수일시</th><td>${fmtDateTime(r.createdAt)}</td></tr>
      </table>

      ${manageHtml}

      <img class="detail-photo" src="${escapeHtml(r.photo)}" alt="신고 사진">

      ${isMaster() ? `
        <div class="master-actions">
          <button type="button" id="detailEditBtn" class="edit-btn-wide">✏️ 신고내용 수정</button>
          <button type="button" id="detailDeleteBtn" class="del-btn-wide">🗑 이 신고 삭제</button>
        </div>` : ""}
    `;

    if (canManage()) {
      $("#detailAssignSave").addEventListener("click", async () => {
        const name = $("#detailAssignee").value.trim();
        try {
          await Store.updateReport(r.id, { assignee: name || null });
          r.assignee = name || null;
          toast(name ? `담당자를 '${name}'(으)로 지정했습니다.` : "담당자 지정을 해제했습니다.");
          renderDetail();
          renderTable();
        } catch (err) { console.error(err); toast("담당자 저장에 실패했습니다."); }
      });

      $("#kakaoGenBtn").addEventListener("click", () => {
        $("#kakaoMsg").value = buildKakaoMsg(r);
        $("#kakaoMsgWrap").classList.remove("hidden");
      });

      $("#kakaoCopyBtn").addEventListener("click", async () => {
        const ok = await copyText($("#kakaoMsg").value);
        if (ok) {
          toast("메시지가 복사되었습니다. 카카오톡에 붙여넣으세요.");
        } else {
          // 자동 복사가 막힌 환경: 메시지를 전체 선택해 두어 Ctrl+C만 누르면 되게 함
          $("#kakaoMsg").focus();
          $("#kakaoMsg").select();
          toast("메시지를 선택해 두었습니다. Ctrl+C로 복사하세요.");
        }
      });
    }

    if (isMaster()) {
      $("#detailEditBtn").addEventListener("click", () => {
        detailEditing = true;
        renderDetail();
      });

      $("#detailDeleteBtn").addEventListener("click", async () => {
        if (!confirm("이 신고를 완전히 삭제할까요? 되돌릴 수 없습니다.")) return;
        try {
          await Store.deleteReport(r.id, r.photo);
          toast("신고가 삭제되었습니다.");
          $("#detailModal").classList.add("hidden");
          loadReports(true);
        } catch (err) { console.error(err); toast("삭제에 실패했습니다."); }
      });
    }
  }
  $("#detailCloseBtn").addEventListener("click", () => $("#detailModal").classList.add("hidden"));
  $("#detailModal").addEventListener("click", (e) => {
    if (e.target === $("#detailModal")) $("#detailModal").classList.add("hidden");
  });

  // ---------- 엑셀 다운로드 (점검사항_조치현황 양식) ----------
  function fmtDateDash(v) {
    if (!v) return "";
    const d = new Date(v);
    if (isNaN(d)) return String(v);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  $("#csvBtn").addEventListener("click", () => {
    // 양식과 동일하게 발생일시 오름차순(오래된 순)으로 순번 부여
    const list = applyFilters(reportsCache)
      .slice()
      .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));

    if (!list.length) return toast("내려받을 신고내역이 없습니다.");

    // [순번, 점검사항, 발생위치, 발생일시, 조치일, 담당부서, 담당자, 비고]
    const rows = list.map((r, i) => [
      String(i + 1),
      r.description || "",
      r.location || "",
      fmtDateDash(r.occurredAt),
      fmtDateDash(r.completedAt),
      "",                       // 담당부서: 시스템에 없는 항목이라 비워둠
      r.assignee || "",
      r.status || ""
    ]);

    const d = new Date();
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const blob = window.makeReportXlsx(rows, "점검사항 조치 현황");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `점검사항_조치현황_${stamp}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(`엑셀 파일을 내려받았습니다. (${rows.length}건)`);
  });

  // ---------- 안전 건의함 ----------
  async function loadSuggestions() {
    let list = [];
    try { list = await Store.listSuggestions(); }
    catch (err) { console.error(err); return; }
    $("#suggestEmpty").classList.toggle("hidden", list.length > 0);
    $("#suggestManageTh").classList.toggle("hidden", !isMaster());
    $("#suggestTbody").innerHTML = list.map((s) => `
      <tr>
        <td class="cell-datetime">${fmtDateTime(s.createdAt)}</td>
        <td style="font-weight:700">${escapeHtml(s.title)}</td>
        <td style="white-space:pre-wrap">${escapeHtml(s.content)}</td>
        <td>${escapeHtml(s.author || "익명")}</td>
        ${isMaster() ? `<td><button type="button" class="del-btn" data-del="${escapeHtml(s.id)}">🗑 삭제</button></td>` : ""}
      </tr>`).join("");

    if (isMaster()) {
      document.querySelectorAll("#suggestTbody [data-del]").forEach((btn) =>
        btn.addEventListener("click", async () => {
          if (!confirm("이 건의 글을 삭제할까요? 되돌릴 수 없습니다.")) return;
          try {
            await Store.deleteSuggestion(btn.dataset.del);
            toast("건의 글이 삭제되었습니다.");
            loadSuggestions();
          } catch (err) { console.error(err); toast("삭제에 실패했습니다."); }
        })
      );
    }
  }

  // ---------- 비밀번호 관리 (마스터 전용) ----------
  $("#pwBtn").addEventListener("click", () => $("#pwModal").classList.remove("hidden"));
  $("#pwCloseBtn").addEventListener("click", () => $("#pwModal").classList.add("hidden"));
  $("#pwModal").addEventListener("click", (e) => {
    if (e.target === $("#pwModal")) $("#pwModal").classList.add("hidden");
  });

  async function savePw(key, sel, label) {
    const v = $(sel).value.trim();
    if (v.length < 4) return toast("비밀번호는 4자 이상으로 입력해 주세요.");
    if (v === window.APP_CONFIG.masterCode) return toast("마스터 비밀번호와 같게 설정할 수 없습니다.");
    try {
      await Store.setSetting(key, v);
      $(sel).value = "";
      toast(`${label} 비밀번호가 변경되었습니다.`);
    } catch (err) {
      console.error(err);
      toast("변경 실패: 운영 DB에 계정 설정(SQL)이 필요합니다. README 참고");
    }
  }
  $("#pwSaveManager").addEventListener("click", () => savePw("pw_manager", "#pwManagerInput", "시설팀장"));
  $("#pwSaveStaff").addEventListener("click", () => savePw("pw_staff", "#pwStaffInput", "담당자(공용)"));

  // ---------- 탭 전환 ----------
  document.querySelectorAll(".page-tab").forEach((t) =>
    t.addEventListener("click", () => {
      document.querySelectorAll(".page-tab").forEach((x) =>
        x.classList.toggle("active", x === t));
      $("#panel-reports").classList.toggle("hidden", t.dataset.tab !== "reports");
      $("#panel-suggestions").classList.toggle("hidden", t.dataset.tab !== "suggestions");
      if (t.dataset.tab === "suggestions") loadSuggestions();
    })
  );

  // ---------- 초기화 ----------
  async function init() {
    // CSS 마스킹을 지원하지 않는 브라우저(Firefox 등)에서는 password 타입으로 전환
    if (!(window.CSS && CSS.supports && CSS.supports("-webkit-text-security", "disc"))) {
      $("#loginCode").type = "password";
    }
    try { await Store.init(); }
    catch (err) { console.error(err); toast("데이터 저장소 연결에 실패했습니다."); }
    if (role) enterDashboard();
  }
  init();
})();
