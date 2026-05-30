const ADMIN_PASSWORD_DEFAULT = ''; // Fail-closed: isi Script Property ADMIN_PASSWORD sebelum digunakan.
const JAKARTA_TIME_ZONE = 'Asia/Jakarta';
const WIB_OFFSET = '+07:00';
const EXAM_SORT_ORDER = {arabic:1, english:1, math:2};
const RESULT_ORDER_VERSION = '2026-05-30-wib-natural-order-v1';

const RESULT_HEADERS = [
  'ID','No Ujian','Username','Nama','Paket','Exam Key','Ujian','Nilai','Benar','Salah/Kosong','Total','Mulai','Submit','Durasi Detik','Auto Submit','Tab Keluar','Proctoring JSON','Detail JSON'
];

const ACTIVITY_HEADERS = [
  'Timestamp','No Ujian','Username','Nama','Ujian','Event','Detail','Proctoring JSON'
];

const PARTICIPANT_HEADERS = [
  'No Ujian','Username','Nama','Paket','Completed Exams','Status','First Locked At','Last Started At','Last Submitted At','Updated At','Reset At','Notes','Reset Exam Key'
];

const PACKAGE_EXAMS = {
  arabic_math: ['arabic','math'],
  english_math: ['english','math']
};

function getAdminPassword_() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD') || ADMIN_PASSWORD_DEFAULT;
}

function output_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function normalizeNo_(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function parseDate_(value) {
  const date = value instanceof Date ? value : (value ? new Date(value) : new Date());
  return isNaN(date.getTime()) ? new Date() : date;
}

function jakartaIso_(value) {
  return Utilities.formatDate(parseDate_(value), JAKARTA_TIME_ZONE, "yyyy-MM-dd'T'HH:mm:ss") + WIB_OFFSET;
}

function naturalParts_(value) {
  return normalizeNo_(value).match(/\d+|\D+/g) || [''];
}

function compareNatural_(a, b) {
  const left = naturalParts_(a);
  const right = naturalParts_(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    if (left[i] === undefined) return -1;
    if (right[i] === undefined) return 1;
    const aPart = left[i];
    const bPart = right[i];
    const aNumber = /^\d+$/.test(aPart);
    const bNumber = /^\d+$/.test(bPart);
    if (aNumber && bNumber) {
      const diff = Number(aPart) - Number(bPart);
      if (diff) return diff;
      if (aPart.length !== bPart.length) return aPart.length - bPart.length;
    } else {
      const diff = String(aPart).localeCompare(String(bPart));
      if (diff) return diff;
    }
  }
  return 0;
}

function compareResultRows_(a, b) {
  const noCompare = compareNatural_(a[1] || a[2] || '', b[1] || b[2] || '');
  if (noCompare) return noCompare;
  const examCompare = (EXAM_SORT_ORDER[String(a[5] || '')] || 99) - (EXAM_SORT_ORDER[String(b[5] || '')] || 99);
  if (examCompare) return examCompare;
  return String(a[12] || '').localeCompare(String(b[12] || ''));
}

function sortResultSheetByNoUjian_(sheet) {
  if (!sheet || sheet.getLastRow() < 3) return;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, RESULT_HEADERS.length).getValues();
  rows.sort(compareResultRows_);
  sheet.getRange(2, 1, rows.length, RESULT_HEADERS.length).setValues(rows);
}

function ensureResultSheetSortedOnce_(sheet) {
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty('RESULT_ORDER_VERSION') === RESULT_ORDER_VERSION) return;
  sortResultSheetByNoUjian_(sheet);
  properties.setProperty('RESULT_ORDER_VERSION', RESULT_ORDER_VERSION);
}

function compareResultIndexRow_(values, indexRow) {
  const noCompare = compareNatural_(values[1] || values[2] || '', indexRow[0] || indexRow[1] || '');
  if (noCompare) return noCompare;
  const examCompare = (EXAM_SORT_ORDER[String(values[5] || '')] || 99) - (EXAM_SORT_ORDER[String(indexRow[4] || '')] || 99);
  if (examCompare) return examCompare;
  return String(values[5] || '').localeCompare(String(indexRow[4] || ''));
}

function insertResultRowSorted_(sheet, values) {
  ensureResultSheetSortedOnce_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    sheet.appendRow(values);
    return;
  }
  // Membaca indeks ringkas B:F saja agar submit tetap ringan untuk banyak peserta.
  const indexRows = sheet.getRange(2, 2, lastRow - 1, 5).getValues();
  let target = -1;
  for (let i = 0; i < indexRows.length; i++) {
    if (compareResultIndexRow_(values, indexRows[i]) < 0) {
      target = i + 2;
      break;
    }
  }
  if (target < 0) {
    sheet.appendRow(values);
  } else {
    sheet.insertRowBefore(target);
    sheet.getRange(target, 1, 1, RESULT_HEADERS.length).setValues([values]);
  }
}

// Jalankan manual bila admin mengubah urutan baris langsung dari Google Sheets.
function rapikanUrutanHasilPMB() {
  const sheet = getOrCreateSheet_('Hasil PMB', RESULT_HEADERS);
  sortResultSheetByNoUjian_(sheet);
  PropertiesService.getScriptProperties().setProperty('RESULT_ORDER_VERSION', RESULT_ORDER_VERSION);
}

function sortResultObjects_(rows) {
  return rows.sort((a, b) => {
    const noCompare = compareNatural_(a.noUjian || a.username || '', b.noUjian || b.username || '');
    if (noCompare) return noCompare;
    const examCompare = (EXAM_SORT_ORDER[String(a.examKey || '')] || 99) - (EXAM_SORT_ORDER[String(b.examKey || '')] || 99);
    if (examCompare) return examCompare;
    return String(a.submittedAt || '').localeCompare(String(b.submittedAt || ''));
  });
}

function normalizePackage_(value) {
  const key = String(value || '').trim();
  return PACKAGE_EXAMS[key] ? key : '';
}

function normalizeExamList_(value) {
  if (Array.isArray(value)) return value.map(String).map(s => s.trim()).filter(Boolean);
  return String(value || '').split(/[,\|]/).map(s => s.trim()).filter(Boolean);
}

function safeJson_(value, fallback) {
  try {
    if (typeof value === 'string') return JSON.parse(value);
    return value || fallback;
  } catch (err) {
    return fallback;
  }
}

function getOrCreateSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Seluruh sheet dipaksa memakai WIB agar konsisten dengan waktu aplikasi.
  if (ss.getSpreadsheetTimeZone() !== JAKARTA_TIME_ZONE) ss.setSpreadsheetTimeZone(JAKARTA_TIME_ZONE);
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  // Menuliskan header lengkap juga memperbarui sheet lama ketika versi baru menambah kolom.
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

function sheetToObjects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(String);
  return values.map(row => {
    const o = {};
    headers.forEach((h, i) => o[h] = row[i]);
    return o;
  });
}

function resultRows_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Hasil PMB');
  return sortResultObjects_(sheetToObjects_(sheet).map(r => ({
    id: r['ID'] || '',
    noUjian: normalizeNo_(r['No Ujian'] || r['Username'] || ''),
    username: normalizeNo_(r['Username'] || r['No Ujian'] || ''),
    name: r['Nama'] || '',
    examPackage: r['Paket'] || '',
    examKey: r['Exam Key'] || '',
    examTitle: r['Ujian'] || '',
    score: Number(r['Nilai'] || 0),
    correct: Number(r['Benar'] || 0),
    wrong: Number(r['Salah/Kosong'] || 0),
    total: Number(r['Total'] || 0),
    startedAt: r['Mulai'] || '',
    submittedAt: r['Submit'] || '',
    durationSeconds: Number(r['Durasi Detik'] || 0),
    autoSubmitted: String(r['Auto Submit']).toLowerCase() === 'true',
    lostFocus: Number(r['Tab Keluar'] || 0),
    proctoring: safeJson_(r['Proctoring JSON'], {}),
    details: safeJson_(r['Detail JSON'], [])
  })));
}

function findParticipantRow_(sheet, noUjian) {
  const no = normalizeNo_(noUjian);
  if (!no || sheet.getLastRow() < 2) return -1;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (normalizeNo_(values[i][0]) === no) return i + 2;
  }
  return -1;
}

function readParticipantAtRow_(sheet, rowNumber) {
  if (rowNumber < 2) return null;
  const row = sheet.getRange(rowNumber, 1, 1, PARTICIPANT_HEADERS.length).getValues()[0];
  const o = {};
  PARTICIPANT_HEADERS.forEach((h, i) => o[h] = row[i]);
  return {
    noUjian: normalizeNo_(o['No Ujian']),
    username: normalizeNo_(o['Username'] || o['No Ujian']),
    name: o['Nama'] || '',
    package: normalizePackage_(o['Paket']),
    completedExams: normalizeExamList_(o['Completed Exams']),
    status: o['Status'] || '',
    lockedAt: o['First Locked At'] || '',
    lastStartedAt: o['Last Started At'] || '',
    lastSubmittedAt: o['Last Submitted At'] || '',
    updatedAt: o['Updated At'] || '',
    resetAt: o['Reset At'] || '',
    notes: o['Notes'] || '',
    resetExamKey: String(o['Reset Exam Key'] || '').trim()
  };
}

function writeParticipant_(sheet, participant) {
  const no = normalizeNo_(participant.noUjian || participant.username);
  if (!no) throw new Error('No Ujian kosong.');
  const now = jakartaIso_();
  let rowNumber = findParticipantRow_(sheet, no);
  const existing = rowNumber > 0 ? readParticipantAtRow_(sheet, rowNumber) : {};
  const merged = {
    noUjian: no,
    username: normalizeNo_(participant.username || existing.username || no),
    name: participant.name !== undefined ? participant.name : (existing.name || ''),
    package: participant.package !== undefined ? normalizePackage_(participant.package) : (existing.package || ''),
    completedExams: participant.completedExams !== undefined ? normalizeExamList_(participant.completedExams) : (existing.completedExams || []),
    status: participant.status !== undefined ? participant.status : (existing.status || ''),
    lockedAt: participant.lockedAt !== undefined ? participant.lockedAt : (existing.lockedAt || ''),
    lastStartedAt: participant.lastStartedAt !== undefined ? participant.lastStartedAt : (existing.lastStartedAt || ''),
    lastSubmittedAt: participant.lastSubmittedAt !== undefined ? participant.lastSubmittedAt : (existing.lastSubmittedAt || ''),
    updatedAt: participant.updatedAt || now,
    resetAt: participant.resetAt !== undefined ? participant.resetAt : (existing.resetAt || ''),
    notes: participant.notes !== undefined ? participant.notes : (existing.notes || ''),
    resetExamKey: participant.resetExamKey !== undefined ? String(participant.resetExamKey || '').trim() : (existing.resetExamKey || '')
  };
  const values = [[
    merged.noUjian,
    merged.username,
    merged.name,
    merged.package,
    merged.completedExams.join('|'),
    merged.status,
    merged.lockedAt,
    merged.lastStartedAt,
    merged.lastSubmittedAt,
    merged.updatedAt,
    merged.resetAt,
    merged.notes,
    merged.resetExamKey
  ]];
  if (rowNumber < 2) {
    sheet.appendRow(values[0]);
  } else {
    sheet.getRange(rowNumber, 1, 1, PARTICIPANT_HEADERS.length).setValues(values);
  }
  return merged;
}

function completedExamKeysFromResults_(noUjian) {
  const no = normalizeNo_(noUjian);
  const keys = resultRows_()
    .filter(r => normalizeNo_(r.noUjian || r.username) === no)
    .map(r => r.examKey)
    .filter(Boolean);
  return Array.from(new Set(keys));
}

function getParticipant_(noUjian, name) {
  const no = normalizeNo_(noUjian);
  const sheet = getOrCreateSheet_('Peserta PMB', PARTICIPANT_HEADERS);
  const rowNumber = findParticipantRow_(sheet, no);
  if (rowNumber > 0) {
    const participant = readParticipantAtRow_(sheet, rowNumber);
    return {...participant, name: participant.name || name || ''};
  }
  return {
    noUjian: no,
    username: no,
    name: name || '',
    package: '',
    completedExams: [],
    status: 'NEW',
    lockedAt: '',
    lastStartedAt: '',
    lastSubmittedAt: '',
    updatedAt: '',
    resetAt: '',
    notes: '',
    resetExamKey: ''
  };
}

function deleteResultsForParticipant_(noUjian) {
  const no = normalizeNo_(noUjian);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Hasil PMB');
  if (!sheet || sheet.getLastRow() < 2) return 0;
  let deleted = 0;
  const values = sheet.getRange(2, 2, sheet.getLastRow() - 1, 2).getValues(); // No Ujian, Username
  for (let i = values.length - 1; i >= 0; i--) {
    const rowNo = normalizeNo_(values[i][0] || values[i][1]);
    if (rowNo === no) {
      sheet.deleteRow(i + 2);
      deleted++;
    }
  }
  return deleted;
}

function deleteResultsForParticipantExam_(noUjian, examKey) {
  const no = normalizeNo_(noUjian);
  const key = String(examKey || '').trim();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Hasil PMB');
  if (!sheet || sheet.getLastRow() < 2) return 0;
  let deleted = 0;
  const values = sheet.getRange(2, 2, sheet.getLastRow() - 1, 5).getValues(); // No Ujian s.d. Exam Key
  for (let i = values.length - 1; i >= 0; i--) {
    const rowNo = normalizeNo_(values[i][0] || values[i][1]);
    const rowExamKey = String(values[i][4] || '').trim();
    if (rowNo === no && rowExamKey === key) {
      sheet.deleteRow(i + 2);
      deleted++;
    }
  }
  return deleted;
}

function resultIdExists_(id) {
  if (!id) return false;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Hasil PMB');
  if (!sheet || sheet.getLastRow() < 2) return false;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  return values.some(r => String(r[0]) === String(id));
}

function packageAllowsExam_(packageKey, examKey) {
  const pkg = normalizePackage_(packageKey);
  if (!pkg) return true;
  return PACKAGE_EXAMS[pkg].indexOf(String(examKey || '')) !== -1;
}

function handleActivity_(data) {
  const sheet = getOrCreateSheet_('Aktivitas PMB', ACTIVITY_HEADERS);
  sheet.appendRow([
    jakartaIso_(data.timestamp),
    normalizeNo_(data.noUjian || data.username || ''),
    normalizeNo_(data.username || data.noUjian || ''),
    data.name || '',
    data.examTitle || data.examKey || '',
    data.eventType || '',
    data.detail || '',
    JSON.stringify(data.proctoring || {})
  ]);
  return output_({ok:true, type:'activity'});
}

function handleResult_(data) {
  const no = normalizeNo_(data.noUjian || data.username || data.participantKey || '');
  if (!no) return output_({ok:false, type:'result', error:'No Ujian kosong.'});

  const lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try {
    const participantSheet = getOrCreateSheet_('Peserta PMB', PARTICIPANT_HEADERS);
    const participant = getParticipant_(no, data.name || '');
    const incomingPackage = normalizePackage_(data.examPackage || participant.package || '');
    const finalPackage = participant.package || incomingPackage;

    if (participant.package && incomingPackage && participant.package !== incomingPackage) {
      return output_({ok:false, type:'result', error:'Paket peserta tidak sesuai dengan paket yang sudah terkunci.'});
    }
    if (finalPackage && !packageAllowsExam_(finalPackage, data.examKey)) {
      return output_({ok:false, type:'result', error:'Mata ujian tidak sesuai dengan paket peserta.'});
    }
    if (resultIdExists_(data.id)) {
      return output_({ok:true, type:'result', duplicate:true});
    }
    if ((participant.completedExams || []).indexOf(String(data.examKey || '')) !== -1) {
      return output_({ok:false, type:'result', error:'Mata ujian ini sudah pernah disubmit. Hubungi admin jika peserta perlu reset mata pelajaran.'});
    }

    const resultSheet = getOrCreateSheet_('Hasil PMB', RESULT_HEADERS);
    insertResultRowSorted_(resultSheet, [
      data.id || ('R' + Date.now()),
      no,
      normalizeNo_(data.username || no),
      data.name || participant.name || '',
      finalPackage,
      data.examKey || '',
      data.examTitle || '',
      data.score || 0,
      data.correct || 0,
      data.wrong || 0,
      data.total || 0,
      data.startedAt ? jakartaIso_(data.startedAt) : '',
      jakartaIso_(data.submittedAt),
      data.durationSeconds || 0,
      data.autoSubmitted || false,
      (data.proctoring && data.proctoring.tabHidden) || data.lostFocus || 0,
      JSON.stringify(data.proctoring || {}),
      JSON.stringify(data.details || [])
    ]);

    const completed = Array.from(new Set([...(participant.completedExams || []), String(data.examKey || '')].filter(Boolean)));
    writeParticipant_(participantSheet, {
      noUjian: no,
      username: data.username || no,
      name: data.name || participant.name || '',
      package: finalPackage,
      completedExams: completed,
      status: 'SUBMITTED',
      lockedAt: participant.lockedAt || jakartaIso_(),
      lastSubmittedAt: jakartaIso_(data.submittedAt),
      resetExamKey: '',
      notes: ''
    });

    return output_({ok:true, type:'result'});
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const data = JSON.parse(raw);
    if (data.type === 'activity') return handleActivity_(data);
    return handleResult_(data);
  } catch (err) {
    return output_({ok:false, error:String(err && err.message ? err.message : err)});
  }
}

function handleLockPackage_(params) {
  const no = normalizeNo_(params.noUjian || params.username || '');
  const packageKey = normalizePackage_(params.package || '');
  if (!no) return output_({ok:false, type:'lockPackage', error:'No Ujian kosong.'});
  if (!packageKey) return output_({ok:false, type:'lockPackage', error:'Paket tidak valid.'});

  const lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try {
    const sheet = getOrCreateSheet_('Peserta PMB', PARTICIPANT_HEADERS);
    const current = getParticipant_(no, params.name || '');
    if (current.package && current.package !== packageKey) {
      return output_({
        ok:false,
        type:'lockPackage',
        error:'Nomor ujian ini sudah terkunci pada paket lain. Hubungi admin untuk reset.',
        participant:current
      });
    }
    const now = jakartaIso_();
    const updated = writeParticipant_(sheet, {
      noUjian:no,
      username:params.username || no,
      name:params.name || current.name || '',
      package:packageKey,
      completedExams:current.completedExams || [],
      status:'LOCKED',
      lockedAt:current.lockedAt || now,
      lastStartedAt:now,
      resetAt:current.resetAt || '',
      resetExamKey:current.resetExamKey || '',
      notes:'Package locked by participant'
    });
    return output_({ok:true, type:'lockPackage', participant:updated});
  } finally {
    lock.releaseLock();
  }
}

function handleReset_(params) {
  const adminPassword = String(params.adminPassword || '');
  if (adminPassword !== getAdminPassword_()) {
    return output_({ok:false, type:'reset', error:'Password admin untuk reset tidak valid.'});
  }
  const no = normalizeNo_(params.noUjian || '');
  if (!no) return output_({ok:false, type:'reset', error:'No Ujian kosong.'});

  const lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try {
    const deleted = deleteResultsForParticipant_(no);
    const sheet = getOrCreateSheet_('Peserta PMB', PARTICIPANT_HEADERS);
    const current = getParticipant_(no, '');
    const now = jakartaIso_();
    const updated = writeParticipant_(sheet, {
      noUjian:no,
      username:current.username || no,
      name:current.name || '',
      package:'',
      completedExams:[],
      status:'RESET_BY_ADMIN',
      lockedAt:'',
      lastStartedAt:'',
      lastSubmittedAt:'',
      resetAt:now,
      resetExamKey:'',
      notes:`Full reset by admin. Deleted results: ${deleted}`
    });
    return output_({ok:true, type:'reset', deletedResults:deleted, participant:updated});
  } finally {
    lock.releaseLock();
  }
}

function handleResetExam_(params) {
  const adminPassword = String(params.adminPassword || '');
  if (adminPassword !== getAdminPassword_()) {
    return output_({ok:false, type:'resetExam', error:'Password admin untuk reset tidak valid.'});
  }
  const no = normalizeNo_(params.noUjian || '');
  const examKey = String(params.examKey || '').trim();
  if (!no) return output_({ok:false, type:'resetExam', error:'No Ujian kosong.'});
  if (!examKey || ['arabic','english','math'].indexOf(examKey) === -1) {
    return output_({ok:false, type:'resetExam', error:'Mata pelajaran tidak valid.'});
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(12000);
  try {
    const sheet = getOrCreateSheet_('Peserta PMB', PARTICIPANT_HEADERS);
    const current = getParticipant_(no, '');
    if (!current.package) {
      return output_({ok:false, type:'resetExam', error:'Peserta belum memiliki paket yang terkunci.'});
    }
    if (!packageAllowsExam_(current.package, examKey)) {
      return output_({ok:false, type:'resetExam', error:'Mata pelajaran tidak termasuk dalam paket peserta.'});
    }
    const deleted = deleteResultsForParticipantExam_(no, examKey);
    const now = jakartaIso_();
    const completed = (current.completedExams || []).filter(key => key !== examKey);
    const updated = writeParticipant_(sheet, {
      noUjian:no,
      username:current.username || no,
      name:current.name || '',
      package:current.package,
      completedExams:completed,
      status:'RESET_EXAM_BY_ADMIN',
      lastStartedAt:'',
      resetAt:now,
      resetExamKey:examKey,
      notes:`Reset ${examKey} by admin. Deleted results: ${deleted}`
    });
    return output_({ok:true, type:'resetExam', deletedResults:deleted, participant:updated});
  } finally {
    lock.releaseLock();
  }
}

function handleParticipants_(params) {
  const adminPassword = String(params.adminPassword || '');
  if (adminPassword !== getAdminPassword_()) {
    return output_({ok:false, type:'participants', error:'Password admin tidak valid.'});
  }
  const sheet = getOrCreateSheet_('Peserta PMB', PARTICIPANT_HEADERS);
  const participants = [];
  for (let row = 2; row <= sheet.getLastRow(); row++) {
    const p = readParticipantAtRow_(sheet, row);
    if (p && p.noUjian) participants.push(getParticipant_(p.noUjian, p.name || ''));
  }
  participants.sort((a,b) => compareNatural_(a.noUjian || a.username || '', b.noUjian || b.username || ''));
  return output_({ok:true, type:'participants', participants});
}

function handleStatus_(params) {
  const no = normalizeNo_(params.noUjian || params.username || '');
  if (!no) return output_({ok:false, type:'status', error:'No Ujian kosong.'});
  return output_({ok:true, type:'status', participant:getParticipant_(no, params.name || '')});
}

function handleActivityList_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Aktivitas PMB');
  const rows = sheetToObjects_(sheet).map(r => ({
    timestamp: r['Timestamp'] || '',
    noUjian: r['No Ujian'] || '',
    username: r['Username'] || '',
    name: r['Nama'] || '',
    examTitle: r['Ujian'] || '',
    eventType: r['Event'] || '',
    detail: r['Detail'] || '',
    proctoring: safeJson_(r['Proctoring JSON'], {})
  }));
  return output_({ok:true, type:'activity', activity:rows});
}

function handleResults_() {
  return output_({ok:true, type:'results', results:resultRows_()});
}

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = params.action || 'results';

    if (action === 'ping') return output_({ok:true, type:'ping', time:jakartaIso_()});
    if (action === 'status') return handleStatus_(params);
    if (action === 'lockPackage') return handleLockPackage_(params);
    if (action === 'reset') return handleReset_(params);
    if (action === 'resetExam') return handleResetExam_(params);
    if (action === 'participants') return handleParticipants_(params);
    if (action === 'activity') return handleActivityList_();

    return handleResults_();
  } catch (err) {
    return output_({ok:false, error:String(err && err.message ? err.message : err)});
  }
}
