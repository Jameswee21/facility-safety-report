// ===============================================
// 앱 설정 파일 — 이 파일만 수정하면 됩니다.
// ===============================================
window.APP_CONFIG = {
  // 앱 이름 (헤더에 표시)
  appName: "시설 보수 신고 및 안전 건의",

  // 관리자 인증 코드 (반드시 변경하세요!)
  // 관리자/담당자가 담당자 지정, 조치완료 처리를 할 때 사용합니다.
  adminCode: "2026",

  // -----------------------------------------------
  // Supabase 연동 (실제 운영용, README.md 참고)
  // 아래 두 값을 비워두면 "데모 모드"로 동작하며
  // 데이터가 현재 기기(브라우저)에만 저장됩니다.
  // -----------------------------------------------
  supabaseUrl: "https://ndhicnagwfsulgdehbqg.supabase.co",      // 예: "https://xxxx.supabase.co"
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kaGljbmFnd2ZzdWxnZGVoYnFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4Mzc2MTgsImV4cCI6MjEwMDQxMzYxOH0.ZZ-FnIKHNzsERJp06e62cF2sej480bqJJdm7PM5P-Ow"   // Supabase 프로젝트의 anon public 키
};
