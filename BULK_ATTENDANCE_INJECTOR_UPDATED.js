/**
 * ============================================================
 *  BULK ATTENDANCE INJECTOR — UPDATED VERSION
 *  With proper date/time string handling
 *  Paste into browser DevTools console on the attendance page.
 * ============================================================
 */
(async function () {
  "use strict";

  const API_BASE = "https://thilinadhananjayalk-825437021775.us-central1.run.app/api";
  const ENDPOINT = `${API_BASE}/public/attendance/import/bulk/by-institute-id`;

  // ── Auto-detect from page ─────────────────────────────────
  function detectFromPage() {
    const d = {};
    const urlMatch = location.href.match(/show_cls_(?:attendance|dashboard|attendance_details)\/(\d+)(?:\/(\d+))?/);
    if (urlMatch) { d.classId = urlMatch[1]; if (urlMatch[2]) d.sessionId = urlMatch[2]; }

    [...document.scripts].forEach(sc => {
      const t = sc.textContent || '';
      const m = t.match(/var\s+session_id\s*=\s*(\d+)/);   if (m && !d.sessionId) d.sessionId = m[1];
      const c = t.match(/var\s+class_id\s*=\s*(\d+)/);     if (c && !d.classId)   d.classId   = c[1];
    });

    [...document.querySelectorAll('h2')].forEach(h => {
      const dm = h.textContent.match(/(\d{4}-\d{2}-\d{2})/);        if (dm && !d.date) d.date = dm[1];
      const tm = h.textContent.match(/(\d{2}:\d{2})\s*-\s*\d{2}:/); if (tm && !d.time) d.time = tm[1];
    });

    return d;
  }

  // ── Read students from DataTable ──────────────────────────
  function readStudents() {
    const tableIds = ['#dt_cls_ses_sessions', '#dt_cls_students'];
    for (const tid of tableIds) {
      try {
        const table = $(tid).DataTable();
        const rows = table.rows().data().toArray();
        if (rows.length > 0) return { rows, source: tid };
      } catch (_) {}
    }
    // DOM fallback
    try {
      const rows = [];
      document.querySelectorAll('#dt_cls_ses_sessions tbody tr').forEach(tr => {
        const cells = tr.querySelectorAll('td');
        if (cells.length >= 7) rows.push({
          student_id:   cells[0]?.textContent.trim(),
          cls_index_no: cells[1]?.textContent.trim(),
          name:         cells[2]?.textContent.trim(),
          check_in_at:  cells[4]?.textContent.trim(),
          check_out_at: cells[5]?.textContent.trim(),
          is_present:   cells[6]?.textContent.trim(),
        });
      });
      if (rows.length > 0) return { rows, source: 'dom' };
    } catch (_) {}
    return { rows: [], source: 'none' };
  }

  // ── Map status text ───────────────────────────────────────
  function mapStatus(raw) {
    if (!raw) return 'NOTMARKED';
    const r = raw.toString().toLowerCase().replace(/<[^>]*>/g, '').trim();
    if (r.includes('present') && !r.includes('not') && !r.includes('absent')) return 'PRESENT';
    if (r.includes('absent'))  return 'ABSENT';
    if (r.includes('late'))    return 'LATE';
    if (r.includes('excused')) return 'EXCUSED';
    return 'NOTMARKED';
  }

  // ── Ensure date is YYYY-MM-DD string ────────────────────────
  function ensureDateString(raw) {
    if (!raw) return null;
    const t = raw.toString().trim();
    // ISO datetime like 2026-04-20T10:15:00Z
    const iso = t.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    return null;
  }

  // ── Parse HH:mm from a cell value ────────────────────────
  // Handles "10:15", "10:15:30", ISO strings like "2026-04-20T10:15:00.000Z"
  function parseTimeFromCell(raw) {
    if (!raw) return null;
    const t = raw.toString().replace(/<[^>]*>/g, '').trim();
    if (!t || t === '-' || t === '—' || t === 'N/A') return null;
    // ISO datetime
    const iso = t.match(/T(\d{2}:\d{2})(?::\d{2})?/);
    if (iso) return iso[1];
    // plain HH:mm or HH:mm:ss
    const plain = t.match(/^(\d{2}:\d{2})(?::\d{2})?$/);
    if (plain) return plain[1];
    return null;
  }

  // ── Build ISO datetime string from date + HH:mm ───────────
  function buildISO(date, time) {
    if (!date || !time) return null;
    return `${date}T${time}:00.000Z`;
  }

  const auto = detectFromPage();
  const { rows: initialRows, source: initialSource } = readStudents();

  // ── CSS ───────────────────────────────────────────────────
  const CSS = `
    #_bai_overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:'Segoe UI',sans-serif}
    #_bai_box{background:#13161e;color:#e2e8f0;border-radius:14px;width:500px;max-width:96vw;padding:28px 30px;box-shadow:0 24px 80px rgba(0,0,0,.7);border:1px solid #252a38}
    #_bai_box h2{margin:0 0 4px;font-size:17px;font-weight:700;color:#60a5fa}
    #_bai_box .sub{margin:0 0 18px;font-size:12px;color:#4b5563}
    ._f{margin-bottom:13px}
    ._f label{display:block;font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.7px;margin-bottom:5px}
    ._f input,._f select{width:100%;box-sizing:border-box;background:#0d0f16;border:1px solid #252a38;border-radius:7px;color:#e2e8f0;font-size:13px;padding:8px 11px;outline:none;transition:border-color .2s}
    ._f input:focus,._f select:focus{border-color:#60a5fa}
    ._f small{display:block;font-size:11px;color:#374151;margin-top:3px}
    ._row{display:flex;gap:10px}._row ._f{flex:1}
    #_bai_info{background:#0d0f16;border:1px solid #252a38;border-radius:8px;padding:10px 13px;font-size:12px;color:#34d399;margin-bottom:16px;line-height:1.9}
    #_bai_info .lbl{color:#6b7280;font-size:10px;text-transform:uppercase}
    #_bai_actions{display:flex;gap:10px;margin-top:18px}
    #_bai_run{flex:1;background:#2563eb;color:#fff;border:none;border-radius:8px;padding:11px;font-size:14px;font-weight:700;cursor:pointer;transition:background .2s}
    #_bai_run:hover{background:#1d4ed8}
    #_bai_run:disabled{background:#1e3a5f;cursor:not-allowed}
    #_bai_cancel{background:#1a1e2a;color:#9ca3af;border:1px solid #252a38;border-radius:8px;padding:11px 16px;font-size:13px;cursor:pointer}
    #_bai_prog{margin-top:14px;display:none}
    #_bai_prog_wrap{background:#0d0f16;border-radius:999px;height:7px;overflow:hidden;border:1px solid #252a38}
    #_bai_prog_bar{height:100%;width:0%;background:#2563eb;border-radius:999px;transition:width .4s}
    #_bai_prog_lbl{font-size:11px;color:#4b5563;text-align:right;margin-top:4px}
    #_bai_log{margin-top:14px;background:#080a0f;border-radius:8px;padding:11px;max-height:200px;overflow-y:auto;font-size:11px;font-family:monospace;display:none;border:1px solid #1a1e2a;line-height:1.7}
    #_bai_log .ok{color:#34d399}#_bai_log .err{color:#f87171}#_bai_log .inf{color:#60a5fa}#_bai_log .warn{color:#fbbf24}
  `;
  if (!document.getElementById('_bai_css')) {
    const s = document.createElement('style'); s.id = '_bai_css'; s.textContent = CSS;
    document.head.appendChild(s);
  }

  if (document.getElementById('_bai_overlay')) document.getElementById('_bai_overlay').remove();

  const overlay = document.createElement('div');
  overlay.id = '_bai_overlay';
  overlay.innerHTML = `
    <div id="_bai_box">
      <h2>⚡ Bulk Attendance Injector (Updated)</h2>
      <p class="sub">Proper date/time string handling</p>

      <div id="_bai_info">
        <div class="lbl">Auto-detected from page</div>
        📚 Class ID: <b>${auto.classId || '—'}</b> &nbsp;
        🔑 Session ID: <b>${auto.sessionId || '—'}</b> &nbsp;
        📅 Date: <b>${auto.date || '—'}</b> &nbsp;
        🕐 Time: <b>${auto.time || '—'}</b>
        <br>👥 Students in table: <b style="color:#fbbf24">${initialRows.length}</b>
        <span style="color:#4b5563">(${initialSource})</span>
        ${initialRows.length === 0 ? '<br><span style="color:#f87171">⚠ No rows — set page length to "All" first!</span>' : ''}
      </div>

      <div class="_row">
        <div class="_f">
          <label>Session ID *</label>
          <input id="_bai_sid" type="text" placeholder="session uuid or SES-..." value="${auto.sessionId || ''}">
        </div>
        <div class="_f">
          <label>Class ID *</label>
          <input id="_bai_cid" type="text" placeholder="class uuid" value="${auto.classId || ''}">
        </div>
      </div>

      <div class="_row">
        <div class="_f">
          <label>Date (YYYY-MM-DD)</label>
          <input id="_bai_date" type="date" value="${auto.date || new Date().toISOString().slice(0,10)}">
          <small>Always sent as string YYYY-MM-DD</small>
        </div>
        <div class="_f">
          <label>Session Time (HH:mm) *</label>
          <input id="_bai_session_time" type="time" value="${auto.time || '10:00'}" required>
          <small>ALWAYS sent for each student</small>
        </div>
      </div>

      <div class="_f">
        <label>Check-in time source</label>
        <select id="_bai_time_src">
          <option value="page" selected>Use check_in_at from page per student</option>
          <option value="fixed">Use fixed session time for ALL students</option>
          <option value="none">Don't send check-in time</option>
        </select>
      </div>

      <div class="_f">
        <label>Status to apply</label>
        <select id="_bai_status">
          <option value="__page__" selected>Use status from page per student</option>
          <option value="PRESENT">PRESENT — mark all present</option>
          <option value="ABSENT">ABSENT — mark all absent</option>
          <option value="LATE">LATE — mark all late</option>
          <option value="NOTMARKED">NOTMARKED — mark all not marked</option>
        </select>
      </div>

      <div id="_bai_prog">
        <div id="_bai_prog_wrap"><div id="_bai_prog_bar"></div></div>
        <div id="_bai_prog_lbl"></div>
      </div>
      <div id="_bai_log"></div>

      <div id="_bai_actions">
        <button id="_bai_cancel">✕ Cancel</button>
        <button id="_bai_run">🚀 Send Bulk Attendance</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const logEl  = document.getElementById('_bai_log');
  const progEl = document.getElementById('_bai_prog');
  const barEl  = document.getElementById('_bai_prog_bar');
  const lblEl  = document.getElementById('_bai_prog_lbl');

  function addLog(msg, type = 'inf') {
    logEl.style.display = 'block';
    const d = document.createElement('div');
    d.className = type;
    d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logEl.appendChild(d);
    logEl.scrollTop = logEl.scrollHeight;
  }

  document.getElementById('_bai_cancel').onclick = () => overlay.remove();

  document.getElementById('_bai_run').onclick = async () => {
    const sessionId    = document.getElementById('_bai_sid').value.trim();
    const classId      = document.getElementById('_bai_cid').value.trim();
    const dateStr      = document.getElementById('_bai_date').value.trim();
    const sessionTime  = document.getElementById('_bai_session_time').value.trim();
    const timeSrc      = document.getElementById('_bai_time_src').value;
    const statusOpt    = document.getElementById('_bai_status').value;

    if (!sessionId || !classId || !dateStr || !sessionTime) { 
      addLog('❌ Session ID, Class ID, Date, and Session Time are required!', 'err'); 
      return; 
    }

    const fresh = readStudents();
    if (fresh.rows.length === 0) {
      addLog('❌ No rows in DataTable. Set page length to "All" first.', 'err');
      return;
    }

    addLog(`📋 ${fresh.rows.length} rows from ${fresh.source}`, 'inf');

    const records = [];
    const skipped = [];

    fresh.rows.forEach(row => {
      // ── Institute ID ──────────────────────────────────────
      const instituteId = String(row['cls_index_no'] || row['student_id'] || '')
        .replace(/<[^>]*>/g, '').trim();
      if (!instituteId || instituteId === '0') { skipped.push(row); return; }

      const rec = { studentInstituteId: instituteId };

      // ── Date as STRING ────────────────────────────────────
      rec.date = dateStr;  // Always send as YYYY-MM-DD string

      // ── Session Time as STRING ────────────────────────────
      rec.checkInTime = sessionTime;  // Always send session time HH:mm

      // ── Check-in / Check-out time from page ───────────────
      if (timeSrc === 'page') {
        const rawIn  = row['check_in_at']  || row['checkInAt']  || '';
        const rawOut = row['check_out_at'] || row['checkOutAt'] || '';

        const pageTimeIn  = parseTimeFromCell(rawIn);
        const pageTimeOut = parseTimeFromCell(rawOut);

        // Override with page check-in time if exists
        if (pageTimeIn) {
          rec.checkInTime = pageTimeIn;
          rec.checkInAt = buildISO(dateStr, pageTimeIn);
        } else {
          rec.checkInAt = buildISO(dateStr, sessionTime);
        }

        if (pageTimeOut && dateStr) {
          rec.checkOutAt = buildISO(dateStr, pageTimeOut);
        }

      } else if (timeSrc === 'fixed') {
        rec.checkInTime = sessionTime;
        rec.checkInAt = buildISO(dateStr, sessionTime);
      }
      // timeSrc === 'none' → no time fields added

      // ── Status ────────────────────────────────────────────
      rec.status = statusOpt === '__page__'
        ? mapStatus(row['is_present'] || row['status'] || '')
        : statusOpt;

      records.push(rec);
    });

    if (skipped.length > 0) addLog(`⚠️ Skipped ${skipped.length} rows (empty institute ID)`, 'warn');
    if (records.length === 0) { addLog('❌ No valid records to send!', 'err'); return; }

    addLog(`📦 sessionId=${sessionId}  classId=${classId}  date=${dateStr}  sessionTime=${sessionTime}`, 'inf');
    addLog(`   Sample: ${JSON.stringify(records[0])}`, 'inf');
    addLog(`📤 Sending ${records.length} records...`, 'inf');

    progEl.style.display = 'block';
    barEl.style.width = '20%';
    lblEl.textContent = `Sending ${records.length} records...`;
    document.getElementById('_bai_run').disabled = true;
    document.getElementById('_bai_run').textContent = '⏳ Sending...';

    const payload = { sessionId, classId, records };

    try {
      barEl.style.width = '50%';
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      barEl.style.width = '80%';

      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch(_) { data = { raw: text }; }
      barEl.style.width = '100%';

      if (res.ok) {
        addLog(`✅ API ${res.status} OK`, 'ok');
        if (data.summary) {
          addLog(`   ✔ Success: ${data.summary.successCount}  ✘ Failed: ${data.summary.failedCount}  Total: ${data.summary.totalRecords}`, 'ok');
          lblEl.textContent = `✔ ${data.summary.successCount} sent  /  ✘ ${data.summary.failedCount} failed`;
        }
        if (data.failed?.length > 0) {
          data.failed.forEach(f => addLog(`   FAILED [${f.studentInstituteId}]: ${f.reason}`, 'err'));
        }
        if (data.message) addLog(`   ${data.message}`, 'ok');
      } else {
        addLog(`❌ API error ${res.status}: ${JSON.stringify(data)}`, 'err');
        lblEl.textContent = `Error ${res.status}`;
        barEl.style.background = '#f87171';
      }

      console.group('🎯 Bulk Attendance API Response');
      console.log('Payload sent:', payload);
      console.log('Response:', data);
      console.groupEnd();

    } catch(err) {
      addLog(`❌ Network error: ${err.message}`, 'err');
      barEl.style.background = '#f87171';
      console.error('Bulk Attendance Error:', err);
    }

    document.getElementById('_bai_run').disabled = false;
    document.getElementById('_bai_run').textContent = '🚀 Send Again';
  };

  console.log('%c⚡ Bulk Attendance Injector (Updated) loaded!', 'color:#3b82f6;font-size:14px;font-weight:bold');
})();
