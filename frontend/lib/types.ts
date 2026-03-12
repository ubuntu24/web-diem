export interface Grade {
    ma_mon: string;
    ten_mon: string;
    hoc_ky: string;
    so_tin_chi: string;
    diem_thi: string;
    tong_ket_10: string;
    tong_ket_4: string;
    diem_chu: string;
    ket_qua: string;

    // Detailed components
    chuyen_can?: string;
    he_so_1_l1?: string;
    he_so_1_l2?: string;
    he_so_1_l3?: string;
    he_so_1_l4?: string;
    he_so_1_l5?: string;
    he_so_1_l6?: string;
    he_so_1_l7?: string;
    he_so_1_l8?: string;
    he_so_1_l9?: string;
    he_so_2_l1?: string;
    he_so_2_l2?: string;
    he_so_2_l3?: string;
    he_so_2_l4?: string;
    he_so_2_l5?: string;
    he_so_2_l6?: string;
    he_so_2_l7?: string;
    he_so_2_l8?: string;
    he_so_2_l9?: string;
    thuc_hanh_1?: string;
    thuc_hanh_2?: string;
    thuong_ky_1?: string;
    thuong_ky_2?: string;
    thuong_ky_3?: string;
    tb_thuong_ky?: string;
    dieu_kien_thi?: string;
    vang_thi?: string;
    tong_ket_1?: string;
    diem_thi_kn_1?: string;
    diem_thi_kn_2?: string;
    diem_thi_kn_3?: string;
    diem_thi_kn_4?: string;
    da_thi_lai_trong_ky?: boolean;

    // Semester summary
    tb_hoc_ky_10?: string;
    tb_hoc_ky_4?: string;
    tb_tich_luy_10?: string;
    tb_tich_luy_4?: string;
    xeploai_hoc_ky?: string;
    xeploai_tich_luy?: string;
    tin_chi_no?: string;
    tin_chi_dang_ky?: string;
    tin_chi_tich_luy?: string;
    xu_ly_hoc_vu?: string;
    xep_loai?: string;
    loai_du_lieu?: string;
    exclude_from_gpa?: boolean;
    cai_thien?: boolean;
}

export interface Student {
    msv: string;
    ho_ten: string;
    ngay_sinh: string;
    ma_lop: string;
    noi_sinh: string;
    diem?: Grade[] | null;
    gpa?: number; // Scale 4
    gpa10?: number; // Scale 10
    total_credits?: number;
}

export interface ClassListResponse {
    classes: string[];
}

export interface StudentListResponse {
    students: Student[];
}

export interface SearchResponse {
    results: Student[];
}
