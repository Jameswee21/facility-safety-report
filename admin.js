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

  // ---------- 로그인 게이트 ----------
  function isLoggedIn() { return sessionStorage.getItem("fs_admin") === "1"; }

  $("#loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if ($("#loginCode").value === window.APP_CONFIG.adminCode) {
      sessionStorage.setItem("fs_admin", "1");
      enterDashboard();
    } else {
      $("#loginError").classList.remove("hidden");
      $("#loginCode").value = "";
      $("#loginCode").focus();
    }
  });

  $("#logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("fs_admin");
    location.reload();
  });

  function enterDashboard() {
    $("#loginGate").classList.add("hidden");
    $("#dashboard").classList.remove("hidden");
    $("#storeModeBadge").textContent =
      Store.mode === "supabase" ? "운영 DB 연결됨" : "데모 모드 (이 기기 데이터)";
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
          <input class="assignee-input" data-act="assignee" value="${escapeHtml(r.assignee || "")}"
                 placeholder="담당자 입력" title="입력 후 Enter 또는 다른 곳 클릭 시 저장">
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
  function openDetail(id) {
    const r = reportsCache.find((x) => String(x.id) === String(id));
    if (!r) return;
    const done = r.status === "조치완료";
    $("#detailBody").innerHTML = `
      <table class="detail-table">
        <tr><th>신고유형</th><td>${escapeHtml(r.type)}</td></tr>
        <tr><th>발생일시</th><td>${fmtDateTime(r.occurredAt)}</td></tr>
        <tr><th>발생위치</th><td>${escapeHtml(r.location)}</td></tr>
        <tr><th>상황설명</th><td style="white-space:pre-wrap">${escapeHtml(r.description)}</td></tr>
        <tr><th>연락처</th><td>${escapeHtml(r.contact || "-")}</td></tr>
        <tr><th>담당자</th><td>${escapeHtml(r.assignee || "미지정")}</td></tr>
        <tr><th>조치일</th><td>${r.completedAt ? fmtDate(r.completedAt) : "-"}</td></tr>
        <tr><th>상태</th><td><span class="status-badge ${done ? "status-done" : "status-progress"}">${escapeHtml(r.status)}</span></td></tr>
        <tr><th>접수일시</th><td>${fmtDateTime(r.createdAt)}</td></tr>
      </table>
      <img class="detail-photo" src="${escapeHtml(r.photo)}" alt="신고 사진">
    `;
    $("#detailModal").classList.remove("hidden");
  }
  $("#detailCloseBtn").addEventListener("click", () => $("#detailModal").classList.add("hidden"));
  $("#detailModal").addEventListener("click", (e) => {
    if (e.target === $("#detailModal")) $("#detailModal").classList.add("hidden");
  });

  // ---------- CSV 다운로드 ----------
  $("#csvBtn").addEventListener("click", () => {
    const cols = ["접수일시", "발생일시", "신고유형", "발생위치", "상황설명", "담당자", "조치일", "상태", "연락처"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = applyFilters(reportsCache).map((r) => [
      fmtDateTime(r.createdAt), fmtDateTime(r.occurredAt), r.type, r.location,
      r.description, r.assignee || "", r.completedAt ? fmtDate(r.completedAt) : "", r.status, r.contact || ""
    ].map(esc).join(","));
    const csv = "﻿" + cols.map(esc).join(",") + "\r\n" + rows.join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const d = new Date();
    a.download = `신고처리현황_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("CSV 파일을 내려받았습니다.");
  });

  // ---------- 안전 건의함 ----------
  async function loadSuggestions() {
    let list = [];
    try { list = await Store.listSuggestions(); }
    catch (err) { console.error(err); return; }
    $("#suggestEmpty").classList.toggle("hidden", list.length > 0);
    $("#suggestTbody").innerHTML = list.map((s) => `
      <tr>
        <td class="cell-datetime">${fmtDateTime(s.createdAt)}</td>
        <td style="font-weight:700">${escapeHtml(s.title)}</td>
        <td style="white-space:pre-wrap">${escapeHtml(s.content)}</td>
        <td>${escapeHtml(s.author || "익명")}</td>
      </tr>`).join("");
  }

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
    try { await Store.init(); }
    catch (err) { console.error(err); toast("데이터 저장소 연결에 실패했습니다."); }
    if (isLoggedIn()) enterDashboard();
  }
  init();
})();
