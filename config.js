window.PMB_CONFIG = {
  // Google Apps Script Web App URL setelah deploy.
  sheetsWebAppUrl: "https://script.google.com/macros/s/AKfycbx-eVcaBmjSkrYuYoykN4YEGaEDwDbADAHTLfoy0dOEt_Uw9A678_YhN-87rxD88D3n/exec",

  // Ubah password HANYA di file ini agar password lama tidak ikut aktif dari file lain.
  // Setelah mengganti adminPassword, samakan juga Script Property ADMIN_PASSWORD di Apps Script.
  adminPassword: "adminstipi2026",
  candidatePassword: "stipi2026",

  // Seluruh waktu ujian, submit, reset, dan dashboard menggunakan WIB (Asia/Jakarta).
  timeZone: "Asia/Jakarta",

  // Batas tunggu agar peserta tidak terjebak loading terlalu lama ketika jaringan tidak stabil.
  requestTimeoutMs: 9000,

  // Monitoring dibuat ringan untuk ratusan peserta: tanpa kamera, tanpa mic, tanpa upload media.
  monitoring: {
    cameraOptional: false,
    micOptional: false,
    cameraRequired: false,
    micRequired: false,
    fullscreenRequired: false,
    fullscreenOnMobile: false,
    syncActivities: false,
    heartbeatSeconds: 180
  }
};
