// ---------- Helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(iso, delta) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return isoDate(dt);
}
function fmtDateLabel(iso) {
  const [, m, d] = iso.split('-').map(Number);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][new Date(iso + 'T00:00:00').getDay()];
  return `${m}/${d}(${wd})`;
}
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function starsStr(n) {
  n = Number(n) || 0;
  return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
}
function attendanceBadgeClass(v) {
  return { 출석: 'badge-present', 지각: 'badge-late', 조퇴: 'badge-early', 결석: 'badge-absent' }[v] || '';
}
function studentName(id) {
  const s = STATE.students.find(s => s.id === id);
  return s ? s.name : '(삭제된 학생)';
}
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('is-visible');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('is-visible'), 1800);
}

// ---------- In-memory cache (synced with Supabase) ----------
const STATE = { students: [], reports: [] };

async function loadState() {
  const [students, reports] = await Promise.all([DB.getStudents(), DB.getReports()]);
  STATE.students = students;
  STATE.reports = reports;
}

// ---------- Tabs ----------
const TAB_TITLES = {
  dashboard: '대시보드',
  'report-form': '리포트 작성',
  'report-list': '리포트 조회',
  students: '학생 관리',
};

function switchTab(tab) {
  $$('.nav-item').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
  $$('.panel').forEach(p => p.classList.toggle('is-active', p.id === `panel-${tab}`));
  $('#page-title').textContent = TAB_TITLES[tab] || '';
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'report-list') renderReportList();
  if (tab === 'students') renderStudents();
  if (tab === 'report-form') populateStudentSelects();
}

function initTabs() {
  $$('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

// ---------- Shared selects ----------
function populateStudentSelects() {
  const students = STATE.students.slice().sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const fSel = $('#f-student');
  const filterSel = $('#filter-student');
  const keepF = fSel.value, keepFilter = filterSel.value;

  fSel.innerHTML = students.length
    ? students.map(s => `<option value="${s.id}">${escapeHtml(s.name)}${s.class ? ' · ' + escapeHtml(s.class) : ''}</option>`).join('')
    : '<option value="">등록된 학생이 없습니다</option>';

  filterSel.innerHTML = '<option value="">전체 학생</option>' +
    students.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');

  if (students.some(s => s.id === keepF)) fSel.value = keepF;
  if (students.some(s => s.id === keepFilter)) filterSel.value = keepFilter;
}

// ---------- Dashboard ----------
function renderDashboard() {
  const students = STATE.students;
  const reports = STATE.reports;
  const today = todayISO();

  const todayReports = reports.filter(r => r.date === today);
  const todayStudentIds = new Set(todayReports.map(r => r.studentId));
  const missing = students.filter(s => !todayStudentIds.has(s.id));

  const weekStart = addDays(today, -6);
  const weekReports = reports.filter(r => r.date >= weekStart && r.date <= today);
  const avgUnderstanding = weekReports.length
    ? (weekReports.reduce((sum, r) => sum + (Number(r.understanding) || 0), 0) / weekReports.length)
    : null;

  const statGrid = $('#stat-grid');
  statGrid.innerHTML = `
    <div class="stat-tile">
      <div class="stat-label">전체 학생 수</div>
      <div class="stat-value">${students.length}</div>
      <div class="stat-sub">명 등록됨</div>
    </div>
    <div class="stat-tile">
      <div class="stat-label">오늘 작성된 리포트</div>
      <div class="stat-value">${todayStudentIds.size} <span style="font-size:15px;color:var(--text-muted);font-weight:500;">/ ${students.length}</span></div>
      <div class="stat-sub ${students.length && todayStudentIds.size === students.length ? 'good' : ''}">${students.length ? Math.round((todayStudentIds.size / students.length) * 100) : 0}% 완료</div>
    </div>
    <div class="stat-tile">
      <div class="stat-label">오늘 미작성 학생</div>
      <div class="stat-value">${missing.length}</div>
      <div class="stat-sub ${missing.length ? 'warn' : 'good'}">${missing.length ? '작성이 필요해요' : '모두 작성 완료'}</div>
    </div>
    <div class="stat-tile">
      <div class="stat-label">이번 주 평균 이해도</div>
      <div class="stat-value">${avgUnderstanding === null ? '-' : avgUnderstanding.toFixed(1)}</div>
      <div class="stat-sub">최근 7일 기준 · 5점 만점</div>
    </div>
  `;

  renderTrendChart(reports, today);
  renderMissingList(missing, today);
  renderRecentTable(reports, students);
}

function renderTrendChart(reports, today) {
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(addDays(today, -i));
  const counts = days.map(d => reports.filter(r => r.date === d).length);
  const max = Math.max(1, ...counts);

  const W = 600, H = 190, padL = 8, padR = 8, padT = 24, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const slot = plotW / days.length;
  const barW = Math.min(24, slot * 0.5);

  const bars = days.map((d, i) => {
    const cx = padL + slot * i + slot / 2;
    const h = (counts[i] / max) * plotH;
    const x = cx - barW / 2;
    const y = padT + (plotH - h);
    const isToday = d === today;
    const path = roundedTopRectPath(x, y, barW, Math.max(h, 1), 4);
    return `
      <path class="bar" d="${path}" opacity="${isToday ? 1 : 0.78}">
        <title>${fmtDateLabel(d)}: ${counts[i]}건</title>
      </path>
      ${counts[i] > 0 ? `<text class="value-label" x="${cx}" y="${y - 6}" text-anchor="middle">${counts[i]}</text>` : ''}
      <text class="tick-label" x="${cx}" y="${H - 8}" text-anchor="middle">${fmtDateLabel(d)}</text>
    `;
  }).join('');

  $('#trend-chart').innerHTML = `
    <svg class="bar-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 7일 리포트 작성 건수">
      <line class="baseline" x1="${padL}" y1="${padT + plotH}" x2="${W - padR}" y2="${padT + plotH}" />
      ${bars}
    </svg>
  `;
}

function roundedTopRectPath(x, y, w, h, r) {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

function renderMissingList(missing, today) {
  $('#missing-count').textContent = `${missing.length}명`;
  const list = $('#missing-list');
  if (!missing.length) {
    list.innerHTML = `<div class="all-done">오늘 리포트를 모두 작성했어요 ✓</div>`;
    return;
  }
  list.innerHTML = missing.map(s => `
    <div class="missing-item">
      <div>
        <div class="name">${escapeHtml(s.name)}</div>
        <div class="sub">${escapeHtml(s.class || '반 미지정')}</div>
      </div>
      <button data-quick-report="${s.id}">리포트 작성</button>
    </div>
  `).join('');

  $$('[data-quick-report]', list).forEach(btn => {
    btn.addEventListener('click', () => {
      resetReportForm();
      $('#f-student').value = btn.dataset.quickReport;
      $('#f-date').value = today;
      switchTab('report-form');
    });
  });
}

function renderRecentTable(reports, students) {
  const rows = reports.slice().sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)).slice(0, 8);
  const tbody = $('#recent-table tbody');
  $('#recent-empty').hidden = rows.length > 0;
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.date}</td>
      <td>${escapeHtml(studentName(r.studentId))}</td>
      <td><span class="badge ${attendanceBadgeClass(r.attendance)}">${r.attendance}</span></td>
      <td>${escapeHtml(r.attitude || '-')}</td>
      <td class="stars">${starsStr(r.understanding)}</td>
      <td>${r.homework || '-'}</td>
      <td class="wrap">${escapeHtml(r.comment || '-')}</td>
    </tr>
  `).join('');
}

// ---------- Report form ----------
function initStarInput() {
  const wrap = $('#f-understanding');
  wrap.addEventListener('click', e => {
    const btn = e.target.closest('button[data-star]');
    if (!btn) return;
    setStars(Number(btn.dataset.star));
  });
}
function setStars(n) {
  const wrap = $('#f-understanding');
  wrap.dataset.value = n;
  $$('button', wrap).forEach(b => b.classList.toggle('is-on', Number(b.dataset.star) <= n));
}

function resetReportForm() {
  $('#report-form').reset();
  $('#report-id').value = '';
  $('#report-form-title').textContent = '일일 리포트 작성';
  $('#f-date').value = todayISO();
  setStars(3);
}

function fillReportForm(report) {
  $('#report-id').value = report.id;
  populateStudentSelects();
  $('#f-student').value = report.studentId;
  $('#f-date').value = report.date;
  $('#f-attendance').value = report.attendance;
  $('#f-homework').value = report.homework;
  $('#f-attitude').value = report.attitude;
  setStars(Number(report.understanding) || 0);
  $('#f-progress').value = report.progress || '';
  $('#f-comment').value = report.comment || '';
  $('#report-form-title').textContent = '리포트 수정';
}

function initReportForm() {
  $('#report-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!$('#f-student').value) {
      toast('학생을 먼저 등록/선택해주세요');
      return;
    }
    const report = {
      id: $('#report-id').value || null,
      studentId: $('#f-student').value,
      date: $('#f-date').value,
      attendance: $('#f-attendance').value,
      homework: $('#f-homework').value,
      attitude: $('#f-attitude').value,
      understanding: Number($('#f-understanding').dataset.value) || 0,
      progress: $('#f-progress').value.trim(),
      comment: $('#f-comment').value.trim(),
    };
    try {
      await DB.saveReport(report);
      await loadState();
      toast('리포트를 저장했습니다');
      resetReportForm();
      renderDashboard();
    } catch (err) {
      toast('저장에 실패했습니다: ' + err.message);
    }
  });
  $('#report-form-reset').addEventListener('click', resetReportForm);
}

// ---------- Report list ----------
function renderReportList() {
  populateStudentSelects();
  const studentId = $('#filter-student').value;
  const from = $('#filter-from').value;
  const to = $('#filter-to').value;

  let rows = STATE.reports;
  if (studentId) rows = rows.filter(r => r.studentId === studentId);
  if (from) rows = rows.filter(r => r.date >= from);
  if (to) rows = rows.filter(r => r.date <= to);
  rows = rows.slice().sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));

  const tbody = $('#report-table tbody');
  $('#report-list-empty').hidden = rows.length > 0;
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${r.date}</td>
      <td>${escapeHtml(studentName(r.studentId))}</td>
      <td><span class="badge ${attendanceBadgeClass(r.attendance)}">${r.attendance}</span></td>
      <td>${escapeHtml(r.attitude || '-')}</td>
      <td class="stars">${starsStr(r.understanding)}</td>
      <td>${r.homework || '-'}</td>
      <td class="wrap">${escapeHtml(r.progress || '-')}</td>
      <td class="wrap">${escapeHtml(r.comment || '-')}</td>
      <td>
        <button class="icon-btn" data-edit="${r.id}">수정</button>
        <button class="icon-btn danger" data-del="${r.id}">삭제</button>
      </td>
    </tr>
  `).join('');

  $$('[data-edit]', tbody).forEach(btn => btn.addEventListener('click', () => {
    const r = STATE.reports.find(x => x.id === btn.dataset.edit);
    if (!r) return;
    fillReportForm(r);
    switchTab('report-form');
  }));
  $$('[data-del]', tbody).forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('이 리포트를 삭제할까요?')) return;
    try {
      await DB.deleteReport(btn.dataset.del);
      await loadState();
      toast('리포트를 삭제했습니다');
      renderReportList();
    } catch (err) {
      toast('삭제에 실패했습니다: ' + err.message);
    }
  }));
}

function initReportListFilters() {
  ['#filter-student', '#filter-from', '#filter-to'].forEach(sel => {
    $(sel).addEventListener('change', renderReportList);
  });
  $('#filter-clear').addEventListener('click', () => {
    $('#filter-student').value = '';
    $('#filter-from').value = '';
    $('#filter-to').value = '';
    renderReportList();
  });
}

// ---------- Students ----------
function resetStudentForm() {
  $('#student-form').reset();
  $('#s-id').value = '';
  $('#student-form-title').textContent = '학생 등록';
}

function renderStudents() {
  const students = STATE.students.slice().sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  $('#student-count').textContent = `${students.length}명`;
  const tbody = $('#student-table tbody');
  $('#student-empty').hidden = students.length > 0;
  tbody.innerHTML = students.map(s => `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.class || '-')}</td>
      <td>${escapeHtml(s.phone || '-')}</td>
      <td>${escapeHtml(s.parentPhone || '-')}</td>
      <td>
        <button class="icon-btn" data-edit="${s.id}">수정</button>
        <button class="icon-btn danger" data-del="${s.id}">삭제</button>
      </td>
    </tr>
  `).join('');

  $$('[data-edit]', tbody).forEach(btn => btn.addEventListener('click', () => {
    const s = STATE.students.find(x => x.id === btn.dataset.edit);
    if (!s) return;
    $('#s-id').value = s.id;
    $('#s-name').value = s.name;
    $('#s-class').value = s.class || '';
    $('#s-phone').value = s.phone || '';
    $('#s-parent-phone').value = s.parentPhone || '';
    $('#s-memo').value = s.memo || '';
    $('#student-form-title').textContent = '학생 정보 수정';
  }));
  $$('[data-del]', tbody).forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('이 학생과 관련된 모든 리포트가 함께 삭제됩니다. 계속할까요?')) return;
    try {
      await DB.deleteStudent(btn.dataset.del);
      await loadState();
      toast('학생을 삭제했습니다');
      renderStudents();
      populateStudentSelects();
    } catch (err) {
      toast('삭제에 실패했습니다: ' + err.message);
    }
  }));

  populateStudentSelects();
}

function initStudentForm() {
  $('#student-form').addEventListener('submit', async e => {
    e.preventDefault();
    const student = {
      id: $('#s-id').value || null,
      name: $('#s-name').value.trim(),
      class: $('#s-class').value.trim(),
      phone: $('#s-phone').value.trim(),
      parentPhone: $('#s-parent-phone').value.trim(),
      memo: $('#s-memo').value.trim(),
    };
    if (!student.name) { toast('이름을 입력해주세요'); return; }
    try {
      await DB.saveStudent(student);
      await loadState();
      toast('학생 정보를 저장했습니다');
      resetStudentForm();
      renderStudents();
    } catch (err) {
      toast('저장에 실패했습니다: ' + err.message);
    }
  });
  $('#student-form-reset').addEventListener('click', resetStudentForm);
}

// ---------- Export / Import ----------
function initExportImport() {
  $('#export-btn').addEventListener('click', () => {
    const blob = new Blob([DB.exportAll(STATE.students, STATE.reports)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-report-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await DB.importAll(reader.result);
        await loadState();
        toast('데이터를 가져왔습니다');
        renderDashboard();
        renderStudents();
        renderReportList();
      } catch (err) {
        toast('가져오기에 실패했습니다: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

// ---------- Init ----------
function initTodayLabel() {
  const d = new Date();
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  $('#today-label').textContent = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${wd})`;
}

let appInitialized = false;

window.initApp = async function initApp() {
  if (!appInitialized) {
    appInitialized = true;
    initTabs();
    initTodayLabel();
    initStarInput();
    initReportForm();
    initReportListFilters();
    initStudentForm();
    initExportImport();
    resetReportForm();
  }
  try {
    await loadState();
  } catch (err) {
    $('.main').innerHTML = `
      <div class="card" style="max-width:520px;margin-top:40px;">
        <div class="card-head"><h2>데이터를 불러오지 못했습니다</h2></div>
        <p class="muted">Supabase 연결 또는 테이블 설정을 확인해주세요.</p>
        <p class="muted" style="word-break:break-all;">${escapeHtml(err.message || String(err))}</p>
      </div>`;
    return;
  }
  populateStudentSelects();
  const activeTab = $('.nav-item.is-active')?.dataset.tab || 'dashboard';
  switchTab(activeTab);
};
