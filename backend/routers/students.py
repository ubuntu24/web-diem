from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import models, database, security

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
    ma_mon = (getattr(grade, 'ma_mon', '') or '').strip()
    if ma_mon in _EXCLUDED_MA_MON:
        return True

    name = (getattr(grade, 'ten_mon', '') or '').strip().lower()
    if name and any(kw in name for kw in _EXCLUDED_NAME_KEYWORDS):
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


# ---------------------------------------------------------------------------
# Student formatter
# ---------------------------------------------------------------------------

def format_student(sv, hide_details=False):
    """Format a student record for the frontend."""

    # Sort grades by id (oldest → newest) for consistent retake handling
    diem_sorted = sorted(
        sv.diem or [],
        key=lambda r: (getattr(r, 'id', 0) or 0)
    )

    # --- Compute GPA from scratch (never trust summary fields) ---
    subject_map = {}  # key → {score4, score10, credit}

    for d in diem_sorted:
        if _is_excluded_grade(d):
            continue
        try:
            s10, s4 = _clean_score(d.tong_ket_10, d.tong_ket_4)
            credit = int(float(str(d.so_tin_chi).replace(',', '.'))) if d.so_tin_chi else 0
            if credit <= 0 or s10 is None:
                continue

            key = (d.ma_mon or '').strip() or f"NAME_{(d.ten_mon or '').strip().lower()}"
            # Latest attempt wins (list is sorted oldest → newest)
            subject_map[key] = {'s4': s4, 's10': s10, 'credit': credit}
        except (ValueError, TypeError):
            pass

    tp4 = sum(v['s4'] * v['credit'] for v in subject_map.values())
    tp10 = sum(v['s10'] * v['credit'] for v in subject_map.values())
    tc = sum(v['credit'] for v in subject_map.values())

    gpa_4 = round(tp4 / tc, 2) if tc > 0 else 0.0
    gpa_10 = round(tp10 / tc, 2) if tc > 0 else 0.0

    # --- Build response ---
    result = {
        "msv": sv.msv,
        "ho_ten": sv.ho_ten,
        "ngay_sinh": str(sv.ngay_sinh) if sv.ngay_sinh else None,
        "ma_lop": sv.ma_lop,
        "noi_sinh": sv.noi_sinh,
        "gpa": gpa_4,
        "gpa10": gpa_10,
    }

    if not hide_details:
        result["diem"] = [
            {
                "ma_mon": d.ma_mon,
                "ten_mon": d.ten_mon,
                "hoc_ky": d.hoc_ky,
                "so_tin_chi": d.so_tin_chi,
                "chuyen_can": d.chuyen_can,
                "he_so_1_l1": d.he_so_1_l1,
                "he_so_1_l2": d.he_so_1_l2,
                "he_so_1_l3": d.he_so_1_l3,
                "he_so_1_l4": d.he_so_1_l4,
                "he_so_2_l1": d.he_so_2_l1,
                "he_so_2_l2": d.he_so_2_l2,
                "he_so_2_l3": d.he_so_2_l3,
                "he_so_2_l4": d.he_so_2_l4,
                "thuc_hanh_1": d.thuc_hanh_1,
                "thuc_hanh_2": d.thuc_hanh_2,
                "tb_thuong_ky": d.tb_thuong_ky,
                "dieu_kien_thi": d.dieu_kien_thi,
                "diem_thi": d.diem_thi,
                "tong_ket_10": d.tong_ket_10,
                "tong_ket_4": d.tong_ket_4,
                "diem_chu": d.diem_chu,
                "xep_loai": d.xep_loai,
                "ket_qua": d.ket_qua,
                "tb_hoc_ky_10": d.tb_hoc_ky_10,
                "tb_hoc_ky_4": d.tb_hoc_ky_4,
                "tb_tich_luy_10": d.tb_tich_luy_10,
                "tb_tich_luy_4": d.tb_tich_luy_4,
                "loai_du_lieu": d.loai_du_lieu,
                "exclude_from_gpa": _is_excluded_grade(d),
            } for d in diem_sorted
        ]
    else:
        result["diem"] = [
            {
                "ma_mon": d.ma_mon,
                "ten_mon": d.ten_mon,
                "hoc_ky": d.hoc_ky,
                "so_tin_chi": d.so_tin_chi,
                "tong_ket_10": d.tong_ket_10,
                "tong_ket_4": d.tong_ket_4,
                "loai_du_lieu": d.loai_du_lieu,
                "exclude_from_gpa": _is_excluded_grade(d),
            } for d in diem_sorted
        ]

    return result

@router.get("/stats/student-count")
def get_student_count(
    class_name: Optional[str] = None,
    current_user: models.Nick = Depends(security.get_current_user),
    db: Session = Depends(database.get_db)
):
    from sqlalchemy import func
    query = db.query(func.count(models.SinhVien.msv))
    if class_name:
        query = query.filter(models.SinhVien.ma_lop == class_name)
    return {"count": query.scalar()}

@router.get("/classes")
def get_classes(
    current_user: models.Nick = Depends(security.get_current_user),
    db: Session = Depends(database.get_db)
):
    classes = db.query(models.SinhVien.ma_lop).distinct().order_by(models.SinhVien.ma_lop).all()
    return {"classes": [c[0] for c in classes if c[0]]}

@router.get("/class/{ma_lop}/students")
def get_students_by_class(
    ma_lop: str, 
    current_user: models.Nick = Depends(security.get_current_user),
    db: Session = Depends(database.get_db)
):
    # Support multiple classes separated by commas (split and clean)
    class_list = [c.strip() for c in ma_lop.split(",") if c.strip()]
    
    if not class_list:
        raise HTTPException(status_code=400, detail="Invalid class list")

    students = db.query(models.SinhVien).options(
        joinedload(models.SinhVien.diem)
    ).filter(models.SinhVien.ma_lop.in_(class_list)).all()
    
    if not students:
        raise HTTPException(status_code=404, detail=f"No students found for class(es): {ma_lop}")
        
    return {"students": [format_student(sv, hide_details=True) for sv in students]}

@router.get("/student/{msv}")
def get_student_detail(
    msv: str,
    current_user: models.Nick = Depends(security.get_current_user),
    db: Session = Depends(database.get_db)
):
    student = db.query(models.SinhVien).options(
        joinedload(models.SinhVien.diem)
    ).filter(models.SinhVien.msv == msv).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    return format_student(student)

@router.get("/search")
def search_students(
    query: str = Query(..., min_length=1),
    current_user: models.Nick = Depends(security.get_current_user),
    db: Session = Depends(database.get_db)
):
    students = db.query(models.SinhVien).options(
        joinedload(models.SinhVien.diem)
    ).filter(
        (models.SinhVien.ho_ten.ilike(f"%{query}%")) |
        (models.SinhVien.msv.ilike(f"%{query}%"))
    ).limit(50).all()
    
    return {"results": [format_student(sv, hide_details=True) for sv in students]}
