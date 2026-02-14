from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Text, BigInteger
from sqlalchemy.orm import relationship
from database import Base
from sqlalchemy.sql import func

class SinhVien(Base):
    __tablename__ = "sinh_vien"

    msv = Column(Text, primary_key=True, index=True)
    ho_ten = Column(Text)
    ngay_sinh = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    ma_lop = Column(Text)
    noi_sinh = Column(Text)

    # Relationship to BangDiem
    diem = relationship("BangDiem", back_populates="sinh_vien", cascade="all, delete")

class BangDiem(Base):
    __tablename__ = "bang_diem"

    id = Column(BigInteger, primary_key=True, index=True) # Identity column in DB, but represented as BigInt here
    msv = Column(Text, ForeignKey("sinh_vien.msv"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    ma_mon = Column(Text)
    ten_mon = Column(Text)
    hoc_ky = Column(Text)
    so_tin_chi = Column(Text)
    chuyen_can = Column(Text)
    he_so_1_l1 = Column(Text)
    he_so_1_l2 = Column(Text)
    he_so_1_l3 = Column(Text)
    he_so_1_l4 = Column(Text)
    he_so_2_l1 = Column(Text)
    he_so_2_l2 = Column(Text)
    he_so_2_l3 = Column(Text)
    he_so_2_l4 = Column(Text)
    thuc_hanh_1 = Column(Text)
    thuc_hanh_2 = Column(Text)
    tb_thuong_ky = Column(Text)
    dieu_kien_thi = Column(Text)
    diem_thi = Column(Text)
    tong_ket_10 = Column(Text)
    tong_ket_4 = Column(Text)
    diem_chu = Column(Text)
    xep_loai = Column(Text)
    ket_qua = Column(Text)
    tb_hoc_ky_10 = Column(Text)
    tb_hoc_ky_4 = Column(Text)
    tb_tich_luy_10 = Column(Text)
    tb_tich_luy_4 = Column(Text)
    xeploai_hoc_ky = Column(Text)
    xeploai_tich_luy = Column(Text)
    tin_chi_no = Column(Text)
    loai_du_lieu = Column(Text)

    # Relationship to SinhVien
    sinh_vien = relationship("SinhVien", back_populates="diem")

class Nick(Base):
    __tablename__ = "nick"

    id = Column(BigInteger, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), primary_key=True, server_default=func.now())
    username = Column("user", Text, primary_key=True, nullable=False)
    password = Column("pass", Text, primary_key=True, nullable=False)
    role = Column(Integer, primary_key=True, nullable=False)
    
    # Store permissions as comma-separated string (e.g. "DHMT16A1HN,DHMT16A2HN")
    user_permission = Column(Text, nullable=True)
    last_active = Column(DateTime, nullable=True)

class UserAccess(Base):
    __tablename__ = "user_access"

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, nullable=False) # No hard ForeignKey to avoid composite key error
    access_date = Column(Date, server_default=func.current_date(), nullable=False)
    last_update = Column(DateTime, server_default=func.now(), onupdate=func.now())
    count = Column(Integer, default=1)
