// Supabase 기반 데이터 저장소
// 로그인한 모든 사용자가 같은 students / reports 테이블을 공유합니다.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function fromStudentRow(r) {
  return {
    id: r.id,
    name: r.name,
    class: r.class || '',
    phone: r.phone || '',
    parentPhone: r.parent_phone || '',
    memo: r.memo || '',
  };
}
function toStudentPayload(s) {
  return {
    name: s.name,
    class: s.class || null,
    phone: s.phone || null,
    parent_phone: s.parentPhone || null,
    memo: s.memo || null,
  };
}
function fromReportRow(r) {
  return {
    id: r.id,
    studentId: r.student_id,
    date: r.date,
    attendance: r.attendance,
    homework: r.homework || '',
    attitude: r.attitude || '',
    understanding: r.understanding || 0,
    progress: r.progress || '',
    comment: r.comment || '',
    createdAt: r.created_at,
  };
}
function toReportPayload(r) {
  return {
    student_id: r.studentId,
    date: r.date,
    attendance: r.attendance,
    homework: r.homework || null,
    attitude: r.attitude || null,
    understanding: r.understanding || null,
    progress: r.progress || null,
    comment: r.comment || null,
  };
}

const DB = {
  auth: sb.auth,

  // Students
  async getStudents() {
    const { data, error } = await sb.from('students').select('*');
    if (error) throw error;
    return data.map(fromStudentRow);
  },
  async saveStudent(student) {
    const payload = toStudentPayload(student);
    if (student.id) {
      const { data, error } = await sb.from('students').update(payload).eq('id', student.id).select().single();
      if (error) throw error;
      return fromStudentRow(data);
    }
    const { data, error } = await sb.from('students').insert(payload).select().single();
    if (error) throw error;
    return fromStudentRow(data);
  },
  async deleteStudent(id) {
    const { error } = await sb.from('students').delete().eq('id', id);
    if (error) throw error;
  },

  // Reports
  async getReports() {
    const { data, error } = await sb.from('reports').select('*');
    if (error) throw error;
    return data.map(fromReportRow);
  },
  async saveReport(report) {
    const payload = toReportPayload(report);
    if (report.id) {
      const { data, error } = await sb.from('reports').update(payload).eq('id', report.id).select().single();
      if (error) throw error;
      return fromReportRow(data);
    }
    const { data, error } = await sb.from('reports').insert(payload).select().single();
    if (error) throw error;
    return fromReportRow(data);
  },
  async deleteReport(id) {
    const { error } = await sb.from('reports').delete().eq('id', id);
    if (error) throw error;
  },

  exportAll(students, reports) {
    return JSON.stringify({ students, reports, exportedAt: new Date().toISOString() }, null, 2);
  },
  async importAll(json) {
    const data = JSON.parse(json);
    const idMap = {};
    for (const s of data.students || []) {
      const created = await this.saveStudent({ name: s.name, class: s.class, phone: s.phone, parentPhone: s.parentPhone, memo: s.memo });
      idMap[s.id] = created.id;
    }
    for (const r of data.reports || []) {
      const studentId = idMap[r.studentId];
      if (!studentId) continue;
      await this.saveReport({
        studentId,
        date: r.date,
        attendance: r.attendance,
        homework: r.homework,
        attitude: r.attitude,
        understanding: r.understanding,
        progress: r.progress,
        comment: r.comment,
      });
    }
  },
};
