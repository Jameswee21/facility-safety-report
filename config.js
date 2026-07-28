// ===============================================
// 앱 설정 파일 — 이 파일만 수정하면 됩니다.
// ===============================================
window.APP_CONFIG = {
  // 앱 이름 (헤더에 표시)
  appName: "시설 보수 신고 및 안전 건의",

  // ── 계정 안내 (3단계) ─────────────────────────────
  // 1. 마스터 계정: 아래 masterCode 로 로그인 (반드시 변경하세요!)
  //    → 전체 기능 + 신고/건의 삭제 + 아래 두 계정 비밀번호 변경
  // 2. 시설팀장 계정: 초기 비밀번호 2026
  // 3. 담당자(공용) 계정: 초기 비밀번호 1111
  //    → 2,3번 비밀번호는 마스터로 로그인 후
  //      대시보드의 '비밀번호 관리'에서 변경합니다.
  masterCode: "6398",

  // -----------------------------------------------
  // Supabase 연동 (실제 운영용, README.md 참고)
  // 아래 두 값을 비워두면 "데모 모드"로 동작하며
  // 데이터가 현재 기기(브라우저)에만 저장됩니다.
  // -----------------------------------------------
  supabaseUrl: "https://ndhicnagwfsulgdehbqg.supabase.co",      // 예: "https://xxxx.supabase.co"
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kaGljbmFnd2ZzdWxnZGVoYnFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4Mzc2MTgsImV4cCI6MjEwMDQxMzYxOH0.ZZ-FnIKHNzsERJp06e62cF2sej480bqJJdm7PM5P-Ow"   // Supabase 프로젝트의 anon public 키
};
