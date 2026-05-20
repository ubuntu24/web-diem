import logging
import re
import time
from typing import Optional

import cache as _cache
import database
import models
import security
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload

logger = logging.getLogger(__name__)

# Cache TTLs (seconds)
_TTL_STUDENT   = 3600   # 1 hour  — student detail + grades
_TTL_CLASS     = 1800   # 30 min  — class student list
_TTL_CLASSES   = 3600   # 1 hour  — full class name list
_TTL_COUNT     = 3600   # 1 hour  — student count
_TTL_SEARCH    = 300    # 5 min   — search results


router = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Mã môn cứng không bao giờ tính GPA (TOEIC placement test v.v.)
_EXCLUDED_MA_MON = {'0101000515', '0101000509', '0101000518'}

# Từ khoá trong tên môn → loại khỏi GPA
_EXCLUDED_NAME_KEYWORDS = [
    'giáo dục thể chất', 'gdtc',
    'giáo dục quốc phòng', 'gdqp',
    'thể dục',
    'toeic',
    'tiếng anh đầu vào', 'tieng anh dau vao',
    'english placement',
    'xếp lớp tiếng anh', 'xep lop tieng anh',
    'kiểm tra đầu vào tiếng anh', 'kiem tra dau vao tieng anh',
    'điểm test tiếng anh đầu vào', 'diem test tieng anh dau vao',
]


def _to_float(value):
    """Parse any value to float safely, returns None on failure."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip().replace(',', '.')
    if not text:
        return None
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def _is_excluded_grade(grade):
    """Determine if a grade row must be excluded from GPA calculations.
    
    Uses 3 layers:
      1. Hard-coded ma_mon blacklist
      2. Name keyword matching
      3. Score sanity (tong_ket_10 > 10 with no diem_chu → non-academic)
    """
    ma_mon = (getattr(grade, 'ma_mon', '') or '').strip().upper()
    if ma_mon in _EXCLUDED_MA_MON or ma_mon.startswith('CDR'):
        return True

    name = (getattr(grade, 'ten_mon', '') or '').strip().lower()
    if name and any(kw in name for kw in _EXCLUDED_NAME_KEYWORDS):
        return True

    if (name.startswith('chuẩn đầu ra') and ma_mon != '1') or getattr(grade, 'loai_du_lieu', '') == 'ChuanDauRa':
        return True

    # Safety net: score > 10 without letter grade is non-academic
    s10 = _to_float(getattr(grade, 'tong_ket_10', None))
    if s10 is not None and s10 > 10:
        return True

    return False


def _clean_score(raw10, raw4):
    """Parse & clamp scores to valid academic ranges. Returns (s10, s4) or (None, None)."""
    s10 = _to_float(raw10)
    s4 = _to_float(raw4)

    if s10 is not None and (s10 < 0 or s10 > 10):
        s10 = None
    if s4 is not None and (s4 < 0 or s4 > 4):
        s4 = None

    if s10 is None and s4 is None:
        return None, None

    # Fill the missing scale
    if s4 is None:
        s4 = (s10 * 4) / 10
    if s10 is None:
        s10 = (s4 * 10) / 4

    return s10, s4


def _detect_thi_lai(grade):
    """Detect if a grade row is a retake (thi lại).
    
    Thi lại = tổng kết lần 1 < 4 (trượt lần đầu, thi lại trong kỳ).
    CHỈ dựa vào tong_ket_1, không dùng da_thi_lai_trong_ky từ DB.
    """
    tk1 = _to_float(getattr(grade, 'tong_ket_1', None))
    if tk1 is not None and tk1 < 4:
        return True

    return False


_SEARCH_BLOCK_PATTERN = re.compile(r"(;|--|/\*|\*/|\x00|'|\")", re.IGNORECASE)


def _sanitize_search_query(query: str) -> str:
    q = (query or '').strip()
    if len(q) < 2 or len(q) > 80:
        raise HTTPException(status_code=400, detail="Invalid search query length")
    if _SEARCH_BLOCK_PATTERN.search(q):
        raise HTTPException(status_code=400, detail="Invalid search query")
    # Block common SQL keyword payloads while still allowing normal Vietnamese names.
    if re.search(r"\b(union|select|drop|insert|update|delete|sleep|benchmark)\b", q, re.IGNORECASE):
        raise HTTPException(status_code=400, detail="Invalid search query")

    # Prevent uncontrolled wildcards from causing full-scan behavior.
    q = q.replace('%', '').replace('_', '')
    if not q:
        raise HTTPException(status_code=400, detail="Invalid search query")
    return q


def _allow_search(identity: str, limit: int = 90, window_seconds: int = 60) -> bool:
    now = time.time()
    key = f"rl:search:{identity}"
    hits = _cache.get(key) or []
    hits = [t for t in hits if now - t < window_seconds]
    if len(hits) >= limit:
        _cache.set(key, hits, ttl=window_seconds)
        return False
    hits.append(now)
    _cache.set(key, hits, ttl=window_seconds)
    return True

def _normalize_name(name):
    n = (name or '').strip().lower()
    for sfx in ['_ hv', '_hv', '(hoc vuot)', '(hv)']:
        if n.endswith(sfx):
            n = n[:-len(sfx)].strip()
    return n


def _subject_key(grade):
    ma_mon = (getattr(grade, 'ma_mon', '') or '').strip().upper()
    ten_mon = (getattr(grade, 'ten_mon', '') or '').strip().lower()
    ldl = (getattr(grade, 'loai_du_lieu', '') or '').strip()
    if ldl in ('ChuanDauRa', 'TongKet') or (ma_mon.startswith('CDR') and ma_mon != '1') or (ten_mon.startswith('chuẩn đầu ra') and ma_mon != '1'):
        return None
    norm = _normalize_name(getattr(grade, 'ten_mon', ''))
    return (f"N_{norm}" if norm else '') or getattr(grade, 'ma_mon', '').strip()


# ---------------------------------------------------------------------------
# Student formatter
# ---------------------------------------------------------------------------

def format_student(sv: models.SinhVien, hide_details=False, role: int = 1, hidden_keys: set = None):
    """Format a student record for the frontend.
    
    Fast path: When hide_details=True, we avoid building the large 'd' array.
    hidden_keys: set of subject_key strings to exclude from 'd' for role-0 users.
    """
    _hidden = hidden_keys or set()

    # Sort grades by id (oldest → newest) for consistent retake handling
    # If grades are not loaded (to avoid N+1), we skip this.
    diem_loaded = getattr(sv, 'diem', None)
    diem_sorted = sorted(
        [r for r in (diem_loaded or []) if (getattr(r, 'ma_mon', '') or '').strip().upper() != '1'],
        key=lambda r: (getattr(r, 'id', 0) or 0)
    ) if diem_loaded else []


    # --- Backend semester normalization logic ---
    def _get_semester(d):
        """Backend version of getNormalizedSemester to match frontend exactly."""
        hk = (getattr(d, 'hoc_ky', '') or '').strip()
        ldl = (getattr(d, 'loai_du_lieu', '') or '').strip()
        ten = (getattr(d, 'ten_mon', '') or '').strip().lower()

        hk_up = hk.upper()
        if hk and hk_up != 'HV' and 'hoc vuot' not in hk.lower():
            return hk

        is_hv = (
            hk_up == 'HV' or
            'hoc vuot' in hk.lower() or
            ldl.upper() == 'HV' or
            'hoc vuot' in ldl.lower() or
            '_ hv' in ten or
            '(hoc vuot)' in ten or
            '(hv)' in ten
        )
        if is_hv: return 'Học vượt'
        if not hk and ldl: return ldl
        return hk or 'Khác'

    # --- Compute GPA from scratch (never trust summary fields) ---
    subject_map = {}  # key → {score4, score10, credit}
    sem_subject_map = {} # (sem, key) → {score4, score10, credit}

    if diem_sorted:
        for d in diem_sorted:
            if _is_excluded_grade(d):
                continue
            try:
                s10, s4 = _clean_score(d.tong_ket_10, d.tong_ket_4)
                credit = int(float(str(d.so_tin_chi).replace(',', '.'))) if d.so_tin_chi else 0
                if credit <= 0 or s10 is None:
                    continue

                key = _subject_key(d)
                sem = _get_semester(d)
                
                # HIGHEST attempt wins for Cumulative GPA
                if key not in subject_map or s10 > subject_map[key]['s10']:
                    subject_map[key] = {'s4': s4, 's10': s10, 'credit': credit}
                
                # HIGHEST attempt wins for Semester GPA (in case of double entries in same sem)
                group_key = (sem, key)
                if group_key not in sem_subject_map or s10 > sem_subject_map[group_key]['s10']:
                    sem_subject_map[group_key] = {'s4': s4, 's10': s10, 'credit': credit}

            except (ValueError, TypeError):
                pass

    tp4 = sum(v['s4'] * v['credit'] for v in subject_map.values() if v['s10'] >= 4.0)
    tp10 = sum(v['s10'] * v['credit'] for v in subject_map.values() if v['s10'] >= 4.0)
    tc = sum(v['credit'] for v in subject_map.values() if v['s10'] >= 4.0)

    # Force GPA calculation from scratch (never use school's summary fields)
    gpa_4 = round(tp4 / tc, 2) if tc > 0 else 0.0
    gpa_10 = round(tp10 / tc, 2) if tc > 0 else 0.0

    # Calculate History GPA (hg) map
    hg = {}
    if sem_subject_map:
        sem_totals = {} # {sem: {tp4, tp10, tc}}
        for (sem, _), v in sem_subject_map.items():
            if sem not in sem_totals:
                sem_totals[sem] = {'tp4': 0, 'tp10': 0, 'tc': 0}
            # Note: For semester GPA, we usually include all attempted credits in that semester,
            # but frontend and common practice might only care about successful ones for some stats.
            # However, looking at Dashboard.tsx, it calculates locally.
            # We match the frontend logic: including all non-excluded grades in that semester.
            sem_totals[sem]['tp4'] += v['s4'] * v['credit']
            sem_totals[sem]['tp10'] += v['s10'] * v['credit']
            sem_totals[sem]['tc'] += v['credit']
        
        for sem, totals in sem_totals.items():
            if totals['tc'] > 0:
                hg[sem] = {
                    "g4": round(totals['tp4'] / totals['tc'], 2),
                    "g10": round(totals['tp10'] / totals['tc'], 2)
                }

    # --- Build response with Masked Fields (Privacy) ---
    display_msv = security.obfuscate_id(sv.msv) if role == 0 else sv.msv
    display_name = sv.ho_ten or ''
    # Masked MSV: e.g. 221••••049 for role 0, full MSV for role 1
    masked_msv = (sv.msv[:3] + "••••" + sv.msv[-3:]) if (len(sv.msv) > 6 and role == 0) else sv.msv

    result = {
        "i": display_msv,    # msv token
        "n": display_name,   # ho_ten
        "m": masked_msv,     # masked_msv for display
        "b": str(sv.ngay_sinh) if (sv.ngay_sinh and role != 0) else None, # ngay_sinh
        "c": sv.ma_lop if role != 0 else None,      # ma_lop
        "p": sv.noi_sinh if role != 0 else None,    # noi_sinh
        "g": gpa_4,          # gpa
        "g10": gpa_10,       # gpa10
        "tc": tc,            # total_credits
        "hg": hg,            # history_gpa map for ranking/sorting
    }

    if not hide_details and diem_sorted:
        # --- Deduplicate grades per semester: keep best score ---
        sem_subject = {}  # (semester, subject_key) → best grade row
        for d in diem_sorted:
            sem = _get_semester(d)
            subj_key = _subject_key(d)
            if not subj_key: continue
            
            group_key = (sem, subj_key)
            s10 = _to_float(getattr(d, 'tong_ket_10', None))
            existing = sem_subject.get(group_key)
            if existing is None:
                sem_subject[group_key] = d
            else:
                exist_s10 = _to_float(getattr(existing, 'tong_ket_10', None))
                if s10 is not None and (exist_s10 is None or s10 > exist_s10):
                    sem_subject[group_key] = d

        best_ids = set()
        for group_key, best_row in sem_subject.items():
            row_id = getattr(best_row, 'id', None)
            if row_id is not None: best_ids.add(row_id)

        seen_keys = set()
        result["d"] = []
        for d in diem_sorted:
            row_id = getattr(d, 'id', None)
            sem = _get_semester(d)
            subj_key = _subject_key(d)
            group_key = (sem, subj_key)

            if subj_key:
                # Admin (role 1) always sees all subjects
                if role == 0 and subj_key in _hidden:
                    continue
                if row_id is not None and row_id in best_ids:
                    if group_key in seen_keys: continue
                    seen_keys.add(group_key)
                elif row_id is not None: continue
                else:
                    if group_key in seen_keys: continue
                    seen_keys.add(group_key)

            result["d"].append({
                "m": d.ma_mon, "t": d.ten_mon, "h": d.hoc_ky, "s": d.so_tin_chi,
                "c": d.chuyen_can, "tk1": d.thuong_ky_1, "dt": d.diem_thi,
                "s10": d.tong_ket_10, "s4": d.tong_ket_4, "chu": d.diem_chu,
                "tl_flag": _detect_thi_lai(d), "e": _is_excluded_grade(d),
                "nh": sem, # Normalized semester for grouping/display
                "cn": _normalize_name(d.ten_mon), # Clean subject name
                # Restore full fields for details
                "h1_1": d.he_so_1_l1, "h1_2": d.he_so_1_l2, "h1_3": d.he_so_1_l3, "h1_4": d.he_so_1_l4,
                "h1_5": d.he_so_1_l5, "h1_6": d.he_so_1_l6, "h1_7": d.he_so_1_l7, "h1_8": d.he_so_1_l8, "h1_9": d.he_so_1_l9,
                "h2_1": d.he_so_2_l1, "h2_2": d.he_so_2_l2, "h2_3": d.he_so_2_l3, "h2_4": d.he_so_2_l4,
                "h2_5": d.he_so_2_l5, "h2_6": d.he_so_2_l6, "h2_7": d.he_so_2_l7, "h2_8": d.he_so_2_l8, "h2_9": d.he_so_2_l9,
                "th1": d.thuc_hanh_1, "th2": d.thuc_hanh_2, "tk2": d.thuong_ky_2, "tk3": d.thuong_ky_3,
                "tb_tk": d.tb_thuong_ky, "dk": d.dieu_kien_thi, "vt": d.vang_thi, "s10_1": d.tong_ket_1,
                "xl": d.xep_loai, "kq": d.ket_qua, "kn1": d.diem_thi_kn_1, "kn2": d.diem_thi_kn_2,
                "kn3": d.diem_thi_kn_3, "kn4": d.diem_thi_kn_4, "hk10": d.tb_hoc_ky_10, "hk4": d.tb_hoc_ky_4,
                "tl10": d.tb_tich_luy_10, "tl4": d.tb_tich_luy_4, "tc_dk": d.tin_chi_dang_ky,
                "tc_tl": d.tin_chi_tich_luy, "xlhv": d.xu_ly_hoc_vu, "ldl": d.loai_du_lieu,
            })
    else:
        # Path for Summary/List views: No detailed grade array
        result["d"] = None
        # Use full logic and include 'hs' (history semesters) for filtering/display
        if diem_loaded:
             all_semesters = set()
             for d in diem_sorted:
                 sem = _get_semester(d)
                 if sem: all_semesters.add(sem)
             result['hs'] = sorted(list(all_semesters))

    return result

@router.get("/stats/student-count")
def get_student_count(
    class_name: Optional[str] = None,
    current_user: models.Nick = Depends(security.get_current_user),
    db: Session = Depends(database.get_db)
):
    cache_key = f"student_count:{class_name or '__all__'}"
    cached = _cache.get(cache_key)
    if cached is not None:
        logger.debug(f"[CACHE HIT] {cache_key}")
        return cached

    from sqlalchemy import func
    query = db.query(func.count(models.SinhVien.msv))
    if class_name:
        query = query.filter(models.SinhVien.ma_lop == class_name)
    data = {"count": query.scalar()}
    result = security.obfuscate_payload(data)
    _cache.set(cache_key, result, ttl=_TTL_COUNT)
    return result


@router.get("/classes")
def get_classes(
    current_user: models.Nick = Depends(security.get_current_user),
    db: Session = Depends(database.get_db)
):
    cache_key = "classes:list"
    cached = _cache.get(cache_key)
    if cached is not None:
        logger.debug("[CACHE HIT] classes:list")
        return cached

    classes = db.query(models.SinhVien.ma_lop).distinct().order_by(models.SinhVien.ma_lop).all()
    data = {"classes": [c[0] for c in classes if c[0]]}
    result = security.obfuscate_payload(data)
    _cache.set(cache_key, result, ttl=_TTL_CLASSES)
    return result

@router.get("/class/{ma_lop}/students")
def get_students_by_class(
    ma_lop: str, 
    current_user: models.Nick = Depends(security.get_current_user),
    db: Session = Depends(database.get_db)
):
    # Support multiple classes separated by commas
    class_list = sorted([c.strip() for c in ma_lop.split(",") if c.strip()])
    if not class_list:
        raise HTTPException(status_code=400, detail="Invalid class list")

    logger.info(f"Searching students for classes: {class_list} (user: {current_user.username if current_user else 'anon'})")

    role = current_user.role if current_user else 0
    cache_key = f"class:v6:{','.join(class_list)}:role{role}"
    cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    # Optimization: Use selectinload instead of joinedload to avoid massive join duplication (N+1 fix)
    from sqlalchemy.orm import selectinload
    students = db.query(models.SinhVien).options(
        selectinload(models.SinhVien.diem)
    ).filter(models.SinhVien.ma_lop.in_(class_list)).all()

    logger.info(f"Found {len(students)} students for {class_list}")

    if not students:
        # Return empty result instead of 404 to be more robust
        data = {"students": []}
        result = security.obfuscate_payload(data)
        return result

    # For class lists, ALWAYS hide details (perf win) — hidden_keys not needed (d=None)
    data = {"students": [format_student(sv, hide_details=True, role=role) for sv in students]}
    result = security.obfuscate_payload(data)
    _cache.set(cache_key, result, ttl=_TTL_CLASS)
    return result

@router.get("/student/{msv}")
def get_student_detail(
    msv: str,
    current_user: models.Nick = Depends(security.get_current_user),
    db: Session = Depends(database.get_db)
):
    role = current_user.role if current_user else 0
    try:
        real_msv = security.deobfuscate_id(msv, force_obfuscated=(role == 0))
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

    cache_key = f"student:{real_msv}:role{role}"
    cached = _cache.get(cache_key)
    if cached is not None:
        logger.debug(f"[CACHE HIT] {cache_key}")
        return cached

    student = db.query(models.SinhVien).options(
        joinedload(models.SinhVien.diem)
    ).filter(models.SinhVien.msv == real_msv).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Load hidden subject rules for this student (only relevant for role 0)
    hidden_keys: set = set()
    if role == 0:
        rules = db.query(models.HiddenSubjectRule.subject_key).filter(
            models.HiddenSubjectRule.msv == real_msv
        ).all()
        hidden_keys = {r.subject_key for r in rules}

    data = format_student(student, role=role, hidden_keys=hidden_keys)
    result = security.obfuscate_payload(data)
    _cache.set(cache_key, result, ttl=_TTL_STUDENT)
    return result


@router.get("/search")
def search_students(
    request: Request,
    query: str = Query(..., min_length=2, max_length=64),
    current_user: models.Nick = Depends(security.get_current_user),
    db: Session = Depends(database.get_db)
):
    identity = (current_user.username if current_user else (request.client.host if request.client else "anon"))
    if not _allow_search(identity):
        raise HTTPException(status_code=429, detail="Too many search requests")

    clean_query = _sanitize_search_query(query)
    role = current_user.role if current_user else 0
    cache_key = f"search:v4:{clean_query.lower().strip()}:role{role}"
    cached = _cache.get(cache_key)
    if cached is not None:
        logger.debug(f"[CACHE HIT] {cache_key}")
        return cached

    # Optimization: Use selectinload for search results + hide_details=True
    from sqlalchemy.orm import selectinload
    escaped_query = clean_query.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
    search_pattern = f"%{escaped_query}%"
    students = db.query(models.SinhVien).options(
        selectinload(models.SinhVien.diem)
    ).filter(
        (models.SinhVien.ho_ten.ilike(search_pattern, escape='\\')) |
        (models.SinhVien.msv.ilike(search_pattern, escape='\\'))
    ).limit(50).all()

    data = {"results": [format_student(sv, hide_details=True, role=role) for sv in students]}
    result = security.obfuscate_payload(data)
    _cache.set(cache_key, result, ttl=_TTL_SEARCH)
    return result
