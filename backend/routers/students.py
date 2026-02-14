from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import models, database, security

router = APIRouter(prefix="/api")

def format_student(sv, hide_details=False):
    """Format a student record matching the frontend Student interface"""
    # Calculate GPA from diem (BangDiem records)
    gpa_10 = 0.0
    gpa_4 = 0.0
    valid_scores = []
    
    if sv.diem:
        for d in sv.diem:
            try:
                score_10 = float(d.tong_ket_10) if d.tong_ket_10 else None
                score_4 = float(d.tong_ket_4) if d.tong_ket_4 else None
                if score_10 is not None and score_4 is not None:
                    valid_scores.append((score_10, score_4))
            except (ValueError, TypeError):
                pass
    
    if valid_scores:
        gpa_10 = round(sum(s[0] for s in valid_scores) / len(valid_scores), 2)
        gpa_4 = round(sum(s[1] for s in valid_scores) / len(valid_scores), 2)
    
    result = {
        "msv": sv.msv,
        "ho_ten": sv.ho_ten,
        "ngay_sinh": str(sv.ngay_sinh) if sv.ngay_sinh else None,
        "ma_lop": sv.ma_lop,
        "noi_sinh": sv.noi_sinh,
        "gpa10": gpa_10,
        "gpa": gpa_4,
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
            } for d in sv.diem
        ]
    else:
        result["diem"] = []
    
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
    students = db.query(models.SinhVien).options(
        joinedload(models.SinhVien.diem)
    ).filter(models.SinhVien.ma_lop == ma_lop).all()
    if not students:
        raise HTTPException(status_code=404, detail="Class not found")
        
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
