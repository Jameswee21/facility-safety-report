// ===============================================
// 데이터 저장 계층
//  - Supabase 설정이 있으면 SupabaseStore (공유 DB)
//  - 없으면 LocalStore (기기 내 localStorage, 데모용)
// 두 저장소는 동일한 API를 제공합니다.
//  report: { id, type, location, occurredAt, description,
//            photo(dataURL 또는 URL), contact, consent,
//            assignee, status, completedAt, createdAt }
//  suggestion: { id, title, content, author, createdAt }
// ===============================================
(function () {
  const CFG = window.APP_CONFIG || {};

  // ---------- 데모 모드 (localStorage) ----------
  const LocalStore = {
    mode: "local",
    async init() {},
    _get(key) {
      try { return JSON.parse(localStorage.getItem(key) || "[]"); }
      catch { return []; }
    },
    _set(key, list) { localStorage.setItem(key, JSON.stringify(list)); },

    async listReports() { return this._get("fs_reports"); },
    async addReport(r) {
      const list = this._get("fs_reports");
      list.unshift(r);
      try { this._set("fs_reports", list); }
      catch { throw new Error("기기 저장 공간이 가득 찼습니다. (데모 모드 한계)"); }
    },
    async updateReport(id, patch) {
      const list = this._get("fs_reports");
      const i = list.findIndex((x) => x.id === id);
      if (i >= 0) { Object.assign(list[i], patch); this._set("fs_reports", list); }
    },

    async listSuggestions() { return this._get("fs_suggestions"); },
    async addSuggestion(s) {
      const list = this._get("fs_suggestions");
      list.unshift(s);
      this._set("fs_suggestions", list);
    }
  };

  // ---------- 운영 모드 (Supabase) ----------
  const SupabaseStore = {
    mode: "supabase",
    client: null,

    async init() {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
        s.onload = resolve;
        s.onerror = () => reject(new Error("Supabase 라이브러리 로드 실패"));
        document.head.appendChild(s);
      });
      this.client = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
    },

    _fromRow(row) {
      return {
        id: row.id,
        type: row.type,
        location: row.location,
        occurredAt: row.occurred_at,
        description: row.description,
        photo: row.photo_url,
        contact: row.contact,
        consent: row.consent,
        assignee: row.assignee,
        status: row.status,
        completedAt: row.completed_at,
        createdAt: row.created_at
      };
    },

    async listReports() {
      const { data, error } = await this.client
        .from("reports").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data.map(this._fromRow);
    },

    async addReport(r) {
      // dataURL → Blob 변환 후 Storage 업로드
      const blob = await (await fetch(r.photo)).blob();
      const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
      const up = await this.client.storage.from("report-photos")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const { data: pub } = this.client.storage.from("report-photos").getPublicUrl(path);

      const { error } = await this.client.from("reports").insert({
        type: r.type,
        location: r.location,
        // datetime-local 값(시간대 없는 현지 시각)을 UTC ISO로 변환해 저장
        // — 그대로 보내면 DB가 UTC로 해석해 9시간 어긋남
        occurred_at: new Date(r.occurredAt).toISOString(),
        description: r.description,
        photo_url: pub.publicUrl,
        contact: r.contact || null,
        consent: r.consent,
        status: r.status
      });
      if (error) throw error;
    },

    async updateReport(id, patch) {
      const row = {};
      if ("assignee" in patch) row.assignee = patch.assignee;
      if ("status" in patch) row.status = patch.status;
      if ("completedAt" in patch) row.completed_at = patch.completedAt;
      const { error } = await this.client.from("reports").update(row).eq("id", id);
      if (error) throw error;
    },

    async listSuggestions() {
      const { data, error } = await this.client
        .from("suggestions").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        author: row.author,
        createdAt: row.created_at
      }));
    },

    async addSuggestion(s) {
      const { error } = await this.client.from("suggestions").insert({
        title: s.title,
        content: s.content,
        author: s.author || null
      });
      if (error) throw error;
    }
  };

  // 주소 뒤에 ?demo=1 을 붙이면 운영 DB 대신 이 기기에만 저장(화면 테스트용)
  const forceDemo = new URLSearchParams(location.search).has("demo");
  window.Store = (!forceDemo && CFG.supabaseUrl && CFG.supabaseAnonKey) ? SupabaseStore : LocalStore;
})();
