from types import SimpleNamespace

from routers.students import _normalize_name, _subject_key


def test_hidden_subject_key_matches_frontend_canonical_rule():
    grade = SimpleNamespace(
        ten_mon='Tiếng Anh 2_ HV',
        ma_mon='ENG201',
        loai_du_lieu='MonHoc',
    )

    assert _normalize_name(grade.ten_mon) == 'tiếng anh 2'
    assert _subject_key(grade) == 'N_tiếng anh 2'


def test_hidden_subject_key_falls_back_to_subject_code():
    grade = SimpleNamespace(
        ten_mon='',
        ma_mon='ENG201',
        loai_du_lieu='MonHoc',
    )

    assert _subject_key(grade) == 'ENG201'


def test_hidden_subject_key_skips_cdr_rows():
    grade = SimpleNamespace(
        ten_mon='Chuẩn đầu ra tiếng anh',
        ma_mon='CDR001',
        loai_du_lieu='ChuanDauRa',
    )

    assert _subject_key(grade) is None