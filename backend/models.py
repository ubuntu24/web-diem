from datetime import date, datetime
from typing import Optional

from database import Base
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    Float,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
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

    id = Column(BigInteger, primary_key=True, index=True) 
    msv = Column(Text, ForeignKey("sinh_vien.msv"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    ma_mon = Column(Text)
    ten_mon = Column(Text)
    hoc_ky = Column(Text)
    so_tin_chi = Column(Text)
    chuyen_can = Column(Float)
    he_so_1_l1 = Column(Float)
    he_so_1_l2 = Column(Float)
    he_so_1_l3 = Column(Float)
    he_so_1_l4 = Column(Float)
    he_so_2_l1 = Column(Float)
    he_so_2_l2 = Column(Float)
    he_so_2_l3 = Column(Float)
    he_so_2_l4 = Column(Float)
    thuc_hanh_1 = Column(Float)
    thuc_hanh_2 = Column(Float)
    tb_thuong_ky = Column(Float)
    dieu_kien_thi = Column(Text)
    diem_thi = Column(Float)
    tong_ket_10 = Column(Float)
    tong_ket_4 = Column(Float)
    diem_chu = Column(Text)
    xep_loai = Column(Text)
    ket_qua = Column(Text)
    tb_hoc_ky_10 = Column(Float)
    tb_hoc_ky_4 = Column(Float)
    tb_tich_luy_10 = Column(Float)
    tb_tich_luy_4 = Column(Float)
    xeploai_hoc_ky = Column(Text)
    xeploai_tich_luy = Column(Text)
    tin_chi_no = Column(Text)
    loai_du_lieu = Column(Text)

    # New columns
    thuong_ky_1 = Column(Float)
    thuong_ky_2 = Column(Float)
    thuong_ky_3 = Column(Float)
    tong_ket_1 = Column(Float)
    vang_thi = Column(Text)
    he_so_1_l5 = Column(Float)
    he_so_1_l6 = Column(Float)
    he_so_1_l7 = Column(Float)
    he_so_1_l8 = Column(Float)
    he_so_1_l9 = Column(Float)
    he_so_2_l5 = Column(Float)
    he_so_2_l6 = Column(Float)
    he_so_2_l7 = Column(Float)
    he_so_2_l8 = Column(Float)
    he_so_2_l9 = Column(Float)
    diem_thi_kn_1 = Column(Float)
    diem_thi_kn_2 = Column(Float)
    diem_thi_kn_3 = Column(Float)
    diem_thi_kn_4 = Column(Float)
    da_thi_lai_trong_ky = Column(Boolean, default=False)
    tin_chi_dang_ky = Column(Float)
    tin_chi_tich_luy = Column(Float)
    xu_ly_hoc_vu = Column(Text)

    # Relationship to SinhVien
    sinh_vien = relationship("SinhVien", back_populates="diem")

class Nick(Base):
    __tablename__ = "nick"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    username: Mapped[str] = mapped_column(Text, unique=True, nullable=False, index=True)
    password: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    
    # Nick table for user authentication and roles
    # Role 1: Admin, Role 0: Regular User
    full_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_active: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    reset_limit_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    class_change_limit: Mapped[Optional[int]] = mapped_column(Integer, default=5, nullable=True)

class UserAccess(Base):
    __tablename__ = "user_access"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("nick.id", ondelete="CASCADE"), nullable=False)
    access_date: Mapped[date] = mapped_column(Date, server_default=func.current_date(), nullable=False)
    last_update: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
    count: Mapped[int] = mapped_column(Integer, default=1)

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("nick.id", ondelete="CASCADE"), nullable=False)
    message = Column(Text, nullable=False)
    ip_address = Column(Text, nullable=True)
    device_fingerprint = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class BanRecord(Base):
    __tablename__ = "ban_records"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("nick.id", ondelete="CASCADE"), nullable=True)
    ip_address = Column(Text, nullable=True)
    device_fingerprint = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())



class UserIpLog(Base):
    """Lưu lịch sử địa chỉ IP của từng user khi vào web (mỗi IP duy nhất = 1 bản ghi)."""
    __tablename__ = "user_ip_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("nick.id", ondelete="CASCADE"), nullable=False, index=True)
    ip_address: Mapped[str] = mapped_column(Text, nullable=False)
    first_seen: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    last_seen: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    hit_count: Mapped[int] = mapped_column(Integer, default=1)

