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
    he_so_2_l1?: string;
    he_so_2_l2?: string;
    he_so_2_l3?: string;
    he_so_2_l4?: string;
    thuc_hanh_1?: string;
    thuc_hanh_2?: string;
    tb_thuong_ky?: string;
    dieu_kien_thi?: string;

    // Semester summary
    tb_hoc_ky_10?: string;
    tb_hoc_ky_4?: string;
    tb_tich_luy_10?: string;
    tb_tich_luy_4?: string;
}

export interface Student {
    msv: string;
    ho_ten: string;
    ngay_sinh: string;
    ma_lop: string;
    noi_sinh: string;
    diem: Grade[];
    gpa?: number; // Scale 4
    gpa10?: number; // Scale 10
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
