// localStorage 기반 데이터 저장소
const DB = {
  STUDENTS_KEY: 'ea_students',
  REPORTS_KEY: 'ea_reports',

  _read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('데이터 읽기 실패:', key, e);
      return [];
    }
  },
  _write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  // Students
  getStudents() {
    return this._read(this.STUDENTS_KEY);
  },
  saveStudent(student) {
    const list = this.getStudents();
    if (student.id) {
      const idx = list.findIndex(s => s.id === student.id);
      if (idx >= 0) list[idx] = student;
      else list.push(student);
    } else {
      student.id = this.uid();
      list.push(student);
    }
    this._write(this.STUDENTS_KEY, list);
    return student;
  },
  deleteStudent(id) {
    const list = this.getStudents().filter(s => s.id !== id);
    this._write(this.STUDENTS_KEY, list);
    const reports = this.getReports().filter(r => r.studentId !== id);
    this._write(this.REPORTS_KEY, reports);
  },

  // Reports
  getReports() {
    return this._read(this.REPORTS_KEY);
  },
  saveReport(report) {
    const list = this.getReports();
    if (report.id) {
      const idx = list.findIndex(r => r.id === report.id);
      if (idx >= 0) list[idx] = report;
      else list.push(report);
    } else {
      report.id = this.uid();
      report.createdAt = new Date().toISOString();
      list.push(report);
    }
    this._write(this.REPORTS_KEY, list);
    return report;
  },
  deleteReport(id) {
    const list = this.getReports().filter(r => r.id !== id);
    this._write(this.REPORTS_KEY, list);
  },

  exportAll() {
    return JSON.stringify({
      students: this.getStudents(),
      reports: this.getReports(),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  },
  importAll(json) {
    const data = JSON.parse(json);
    if (Array.isArray(data.students)) this._write(this.STUDENTS_KEY, data.students);
    if (Array.isArray(data.reports)) this._write(this.REPORTS_KEY, data.reports);
  },
};
