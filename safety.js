// ===============================================
// 안전보건 신고 (위험요소 · 아차사고) 접수 로직
//  · 사진은 선택 항목입니다.
//  · 저장은 safety_reports 테이블(kind = "safety")에 합니다.
// ===============================================
(function () {
  const $ = (sel) => document.querySelector(sel);
  const Store = window.Store;
  const KIND = "safety";

  let photoDataUrl = null;

  // 유형별 추가 안내 (별도 보고 절차가 있는 항목)
  const TYPE_NOTICE = {
    "주사침 찔림 · 혈액 노출":
      "<b>감염 예방 조치가 먼저입니다.</b><br>즉시 상처 부위를 세척하고 감염관리실·부서장에게 보고해 주세요. 이 신고와 별도로 진행해 주셔야 합니다.",
    "환자/보호자 폭력 · 폭언":
      "<b>신변 안전이 우선입니다.</b><br>위급한 상황에서는 먼저 주변에 도움을 요청하고 부서장에게 보고해 주세요. 산업재해 해당 시 별도 절차가 진행됩니다."
  };

  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 3000);
  }

  function setDefaultDateTime() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    $("#occurredAt").value = d.toISOString().slice(0, 16);
  }

  // 유형 선택 시 안내 표시
  document.querySelectorAll('input[name="type"]').forEach((r) =>
    r.addEventListener("change", () => {
      const box = $("#typeNotice");
      const msg = TYPE_NOTICE[r.value];
      if (msg) {
        box.innerHTML = msg;
        box.classList.remove("hidden");
      } else {
        box.classList.add("hidden");
      }
    })
  );

  // 사진 첨부 (선택)
  $("#photo").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      photoDataUrl = await window.compressImage(file);
      $("#photoPreview").src = photoDataUrl;
      $("#photoPreview").classList.remove("hidden");
      $("#photoDropText").textContent = "📷 사진 다시 선택";
    } catch {
      toast("사진을 불러올 수 없습니다. 사진 없이 신고하셔도 됩니다.");
    }
  });

  // 연락처 입력 시 개인정보 동의 화면 표시
  function updateSubmitState() {
    const hasContact = $("#contact").value.trim().length > 0;
    $("#consentBox").classList.toggle("hidden", !hasContact);
    if (!hasContact) $("#consentCheck").checked = false;
    $("#submitBtn").disabled = hasContact && !$("#consentCheck").checked;
  }
  $("#contact").addEventListener("input", updateSubmitState);
  $("#consentCheck").addEventListener("change", updateSubmitState);

  // 제출
  $("#safetyForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const type = document.querySelector('input[name="type"]:checked');
    const witness = document.querySelector('input[name="witness"]:checked');
    const risk = document.querySelector('input[name="risk"]:checked');
    if (!type) return toast("1번 — 어떤 일이 있었는지 선택해 주세요.");
    if (!witness) return toast("2번 — 직접 겪으셨는지 목격하셨는지 선택해 주세요.");
    if (!$("#location").value.trim()) return toast("3번 — 발생 장소를 입력해 주세요.");
    if (!$("#occurredAt").value) return toast("4번 — 발생일시를 선택해 주세요.");
    if (!$("#description").value.trim()) return toast("5번 — 어떤 상황이었는지 적어 주세요.");
    const contact = $("#contact").value.trim();
    if (contact && !$("#consentCheck").checked)
      return toast("개인정보 수집 및 이용에 동의해 주세요.");

    const btn = $("#submitBtn");
    btn.disabled = true;
    btn.textContent = "제출 중...";
    try {
      await Store.addReport({
        id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: type.value,
        witness: witness.value,
        location: $("#location").value.trim(),
        occurredAt: $("#occurredAt").value,
        description: $("#description").value.trim(),
        photo: photoDataUrl,                       // 없으면 null
        risk: risk ? risk.value : null,
        suggestion: $("#suggestion").value.trim() || null,
        contact: contact || null,
        consent: !!contact,
        assignee: null,
        status: "접수",
        completedAt: null,
        donePhoto: null,
        createdAt: new Date().toISOString()
      }, KIND);
      resetForm();
      $("#doneModal").classList.remove("hidden");
    } catch (err) {
      console.error(err);
      toast("제출에 실패했습니다: " + (err.message || "네트워크를 확인해 주세요."));
    } finally {
      btn.disabled = false;
      btn.textContent = "신고 제출";
      updateSubmitState();
    }
  });

  function resetForm() {
    $("#safetyForm").reset();
    photoDataUrl = null;
    $("#photoPreview").classList.add("hidden");
    $("#photoDropText").textContent = "📷 사진 촬영 · 선택";
    $("#typeNotice").classList.add("hidden");
    setDefaultDateTime();
    updateSubmitState();
  }

  $("#againBtn").addEventListener("click", () => {
    $("#doneModal").classList.add("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // ---------- 초기화 ----------
  async function init() {
    setDefaultDateTime();
    updateSubmitState();
    try {
      await Store.init();
    } catch (err) {
      console.error(err);
      toast("데이터 저장소 연결에 실패했습니다.");
    }
  }
  init();
})();
