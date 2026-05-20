import { Student, Grade } from './types';

const EXCLUDED_MA_MON = new Set(['0101000515', '0101000509', '0101000518']);
const EXCLUDED_KEYWORDS = [
    'giáo dục thể chất', 'gdtc',
    'giáo dục quốc phòng', 'gdqp',
    'thể dục',
    'toeic',
    'tiếng anh đầu vào', 'tieng anh dau vao',
    'english placement',
    'xếp lớp tiếng anh', 'xep lop tieng anh',
    'kiểm tra đầu vào tiếng anh', 'kiem tra dau vao tiếng anh',
    'điểm test tiếng anh đầu vào', 'diem test tieng anh dau vao',
];

export function toNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const text = String(value).trim().replace(',', '.');
    if (!text) return null;
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
}

function cleanScore(raw10: unknown, raw4: unknown): { s10: number | null; s4: number | null } {
    let s10 = toNumber(raw10);
    let s4 = toNumber(raw4);

    if (s10 !== null && (s10 < 0 || s10 > 10)) s10 = null;
    if (s4 !== null && (s4 < 0 || s4 > 4)) s4 = null;

    if (s10 === null && s4 === null) return { s10: null, s4: null };

    if (s4 === null && s10 !== null) s4 = (s10 * 4) / 10;
    if (s10 === null && s4 !== null) s10 = (s4 * 10) / 4;

    return { s10, s4 };
}

function isExcludedFromGPA(grade: Grade): boolean {
    if (grade.exclude_from_gpa === true) return true;
    if (EXCLUDED_MA_MON.has((grade.ma_mon || '').trim())) return true;
    const name = (grade.ten_mon || '').trim().toLowerCase();
    if (name && EXCLUDED_KEYWORDS.some(kw => name.includes(kw))) return true;
    const raw10 = toNumber(grade.tong_ket_10);
    if (raw10 !== null && raw10 > 10) return true;
    return false;
}

export function getNormalizedSemester(grade: Grade): string {
    const hk = (grade.hoc_ky || '').trim();
    const ldl = (grade.loai_du_lieu || '').trim();
    const tenMon = (grade.ten_mon || '').trim().toLowerCase();

    const hkUpper = hk.toUpperCase();
    const hasRealSemester = hk && hkUpper !== 'HV' && !hk.toLowerCase().includes('hoc vuot');
    if (hasRealSemester) return hk;

    const isHocVuot =
        hkUpper === 'HV' ||
        hk.toLowerCase().includes('hoc vuot') ||
        ldl.toUpperCase() === 'HV' ||
        ldl.toLowerCase().includes('hoc vuot') ||
        tenMon.includes('_ hv') ||
        tenMon.includes('(hoc vuot)') ||
        tenMon.includes('(hv)');

    if (isHocVuot) return 'Học vượt';
    if (!hk && ldl) return ldl;
    return hk || 'Khác';
}

export function normalizeSubjectName(name: string): string {
    let rawName = (name || '').trim().toLowerCase();
    const suffixes = ['_ hv', '_hv', '(hoc vuot)', '(hv)'];
    for (const suffix of suffixes) {
        if (rawName.endsWith(suffix)) {
            rawName = rawName.slice(0, -suffix.length).trim();
        }
    }
    return rawName;
}

export function getSubjectKey(g: Grade): string {
    const rawName = normalizeSubjectName(g.ten_mon || '');
    return (rawName ? `N_${rawName}` : '') || (g.ma_mon || '').trim();
}

export function calculateSemesterGPA(student: Student, semester: string) {
    if (!student.diem) return { gpa4: 0, gpa10: 0, credits: 0, points: 0 };
    const target = semester.trim().toLowerCase();
    const rows = student.diem.filter(
        d => !isExcludedFromGPA(d) && getNormalizedSemester(d).toLowerCase() === target
    );
    if (!rows.length) return { gpa4: 0, gpa10: 0, credits: 0, points: 0 };

    const map = new Map<string, { s4: number; s10: number; cr: number }>();
    rows.forEach(g => {
        const { s10, s4 } = cleanScore(g.tong_ket_10, g.tong_ket_4);
        const cr = toNumber(g.so_tin_chi);
        if (!cr || cr <= 0 || s10 === null || s4 === null) return;

        const key = getSubjectKey(g);
        const existing = map.get(key);
        if (!existing || s10 > existing.s10) {
            map.set(key, { s4, s10, cr });
        }
    });

    let p4 = 0;
    let p10 = 0;
    let tc = 0;
    map.forEach(v => {
        p4 += v.s4 * v.cr;
        p10 += v.s10 * v.cr;
        tc += v.cr;
    });

    return {
        gpa4: tc > 0 ? parseFloat((p4 / tc).toFixed(2)) : 0,
        gpa10: tc > 0 ? parseFloat((p10 / tc).toFixed(2)) : 0,
        credits: tc,
        points: p4,
    };
}

export function calculateCumulativeGPA(student: Student) {
    if (!student.diem) {
        const credits = student.total_credits || 0;
        const gpa4 = student.gpa || 0;
        const gpa10 = student.gpa10 || 0;
        return { gpa4, gpa10, credits, points: gpa4 * credits };
    }

    const map = new Map<string, { s4: number; s10: number; cr: number }>();
    student.diem.forEach(g => {
        if (isExcludedFromGPA(g)) return;
        const { s10, s4 } = cleanScore(g.tong_ket_10, g.tong_ket_4);
        const cr = toNumber(g.so_tin_chi);
        if (!cr || cr <= 0 || s10 === null || s4 === null) return;

        const key = getSubjectKey(g);
        const existing = map.get(key);
        if (!existing || s10 > existing.s10) {
            map.set(key, { s4, s10, cr });
        }
    });

    let p4 = 0;
    let p10 = 0;
    let tc = 0;
    map.forEach(v => {
        if (v.s10 >= 4.0) {
            p4 += v.s4 * v.cr;
            p10 += v.s10 * v.cr;
            tc += v.cr;
        }
    });

    return {
        gpa4: tc > 0 ? parseFloat((p4 / tc).toFixed(2)) : 0,
        gpa10: tc > 0 ? parseFloat((p10 / tc).toFixed(2)) : 0,
        credits: tc,
        points: p4,
    };
}

export function parseSemesterKey(input: string) {
    const s = (input || '').trim();
    const lower = s.toLowerCase();

    const yearRange = s.match(/(\d{4})\s*-\s*(\d{4})/);
    let year = yearRange ? parseInt(yearRange[1], 10) : 0;
    if (!year) {
        const singleYear = s.match(/20\d{2}/);
        if (singleYear) year = parseInt(singleYear[0], 10);
    }

    let sem = 0;
    const explicitSem = s.match(/(?:hk|học\s*kỳ|hoc\s*ky)\s*([123])/i);
    if (explicitSem) {
        sem = parseInt(explicitSem[1], 10);
    } else {
        const looseSem = s.match(/(?:^|[^0-9])([123])(?:$|[^0-9])/);
        sem = looseSem ? parseInt(looseSem[1], 10) : 0;
    }

    let semOrder = sem;
    if (lower.includes('phu') || lower.includes('phụ') || lower.includes('he') || lower.includes('hè')) {
        semOrder = 0.5;
    }
    if (lower.includes('hoc vuot') || lower.includes('học vượt') || lower.includes('hv')) {
        semOrder = 0.25;
    }

    const isOther = year === 0 && semOrder === 0;
    return { year, semOrder, isOther, raw: s };
}

export function compareSemesterKeys(a: string, b: string) {
    const pa = parseSemesterKey(a);
    const pb = parseSemesterKey(b);
    if (pa.isOther && !pb.isOther) return 1;
    if (!pa.isOther && pb.isOther) return -1;
    if (pa.isOther && pb.isOther) return pa.raw.localeCompare(pb.raw);
    if (pa.year !== pb.year) return pb.year - pa.year;
    if (pa.semOrder !== pb.semOrder) return pb.semOrder - pa.semOrder;
    return pa.raw.localeCompare(pb.raw);
}
