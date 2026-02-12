// State management
let currentView = 'classes'; // classes, students, grades

document.addEventListener('DOMContentLoaded', () => {
    loadClasses();
});

function showLoading(show) {
    document.getElementById('loading').classList.toggle('hidden', !show);
}

function updateBreadcrumb(items) {
    const breadcrumb = document.getElementById('breadcrumb');
    if (!items || items.length === 0) {
        breadcrumb.classList.add('hidden');
        return;
    }

    breadcrumb.classList.remove('hidden');
    breadcrumb.innerHTML = items.map((item, index) => {
        if (index === items.length - 1) {
            return `<span>${item.text}</span>`;
        }
        return `<span class="breadcrumb-link" onclick="${item.action}">${item.text}</span> <span class="separator">/</span>`;
    }).join('');
}

async function loadClasses() {
    currentView = 'classes';
    showLoading(true);

    // Hide other areas
    document.getElementById('classListArea').classList.remove('hidden');
    document.getElementById('studentListArea').classList.add('hidden');
    document.getElementById('gradeArea').classList.add('hidden');
    updateBreadcrumb([]);

    try {
        const response = await fetch('/api/classes');
        const data = await response.json();

        const classListArea = document.getElementById('classListArea');
        classListArea.innerHTML = '';

        if (data.classes.length === 0) {
            classListArea.innerHTML = '<p>Không tìm thấy lớp học nào.</p>';
        } else {
            data.classes.forEach(cls => {
                const div = document.createElement('div');
                div.className = 'grid-item';
                div.textContent = cls;
                div.onclick = () => loadStudents(cls);
                classListArea.appendChild(div);
            });
        }
    } catch (error) {
        console.error(error);
        alert('Lỗi tải danh sách lớp');
    } finally {
        showLoading(false);
    }
}

async function loadStudents(maLop) {
    currentView = 'students';
    showLoading(true);

    document.getElementById('classListArea').classList.add('hidden');
    document.getElementById('studentListArea').classList.remove('hidden');
    document.getElementById('gradeArea').classList.add('hidden');

    updateBreadcrumb([
        { text: 'Danh Sách Lớp', action: 'loadClasses()' },
        { text: `Lớp ${maLop}`, action: '' }
    ]);

    try {
        const response = await fetch(`/api/class/${encodeURIComponent(maLop)}/students`);
        const data = await response.json();

        const studentListArea = document.getElementById('studentListArea');
        studentListArea.innerHTML = '';

        if (data.students.length === 0) {
            studentListArea.innerHTML = '<p>Lớp này chưa có sinh viên.</p>';
        } else {
            data.students.forEach(sv => {
                const div = document.createElement('div');
                div.className = 'grid-item student-item';
                div.innerHTML = `
                    <div class="sv-name">${sv.ho_ten}</div>
                    <div class="sv-msv">${sv.msv}</div>
                `;
                div.onclick = () => loadGrade(sv.msv, maLop);
                studentListArea.appendChild(div);
            });
        }
    } catch (error) {
        console.error(error);
        alert('Lỗi tải danh sách sinh viên');
    } finally {
        showLoading(false);
    }
}

async function loadGrade(msv, maLopFrom = null) {
    currentView = 'grades';
    showLoading(true);

    document.getElementById('classListArea').classList.add('hidden');
    document.getElementById('studentListArea').classList.add('hidden');
    document.getElementById('gradeArea').classList.remove('hidden');

    const breadcrumbs = [];
    if (maLopFrom) {
        breadcrumbs.push({ text: 'Danh Sách Lớp', action: 'loadClasses()' });
        breadcrumbs.push({ text: `Lớp ${maLopFrom}`, action: `loadStudents('${maLopFrom}')` });
    } else {
        breadcrumbs.push({ text: 'Trang Chủ', action: 'loadClasses()' });
    }

    try {
        const response = await fetch(`/api/student/${msv}`);
        if (!response.ok) throw new Error('Student not found');

        const student = await response.json();

        breadcrumbs.push({ text: student.ho_ten, action: '' });
        updateBreadcrumb(breadcrumbs);

        const gradeArea = document.getElementById('gradeArea');

        // Group grades by semester (hoc_ky)
        const gradesBySemester = {};
        student.diem.forEach(d => {
            const hk = d.hoc_ky || 'Khác';
            if (!gradesBySemester[hk]) {
                gradesBySemester[hk] = [];
            }
            gradesBySemester[hk].push(d);
        });

        // Sort semesters
        const semesterKeys = Object.keys(gradesBySemester).sort();

        // Calculate Overall GPA (Take the latest non-null value found or implement custom logic)
        // Since database might have it, we look for 'tb_tich_luy_4' in the last semester
        let overallGPA = 'N/A';
        let totalCredits = 0; // If you want to calculate manually, but let's try to find it first.

        // Find latest GPA
        for (let i = semesterKeys.length - 1; i >= 0; i--) {
            const hk = semesterKeys[i];
            const records = gradesBySemester[hk];
            const lastRecord = records.find(r => r.tb_tich_luy_4);
            if (lastRecord) {
                overallGPA = lastRecord.tb_tich_luy_4;
                break;
            }
        }

        let accordionHtml = '<div class="semester-accordion">';

        semesterKeys.forEach(hk => {
            const grades = gradesBySemester[hk];

            // Try to find semester GPA in this semester's records
            const semesterRecord = grades.find(r => r.tb_hoc_ky_4);
            const semesterGPA = semesterRecord ? semesterRecord.tb_hoc_ky_4 : '';
            const semesterGPA10 = semesterRecord ? semesterRecord.tb_hoc_ky_10 : '';

            const gradesRows = grades
                .filter(d => d.ten_mon && d.ten_mon.trim() !== '') // Filter out empty subjects (summary rows)
                .map((d, index) => {
                    const passClass = d.ket_qua === 'Đạt' || (d.diem_chu && d.diem_chu !== 'F') ? 'pass' : 'fail';
                    // Highlight high grades
                    const scoreClass = parseFloat(d.tong_ket_10) >= 8.5 ? 'high-score' : '';

                    // Construct detailed view
                    let details = [];
                    if (d.chuyen_can) details.push({ label: 'Chuyên Cần', value: d.chuyen_can });
                    if (d.he_so_1_l1) details.push({ label: 'HS1 (L1)', value: d.he_so_1_l1 });
                    if (d.he_so_1_l2) details.push({ label: 'HS1 (L2)', value: d.he_so_1_l2 });
                    if (d.he_so_1_l3) details.push({ label: 'HS1 (L3)', value: d.he_so_1_l3 });
                    if (d.he_so_1_l4) details.push({ label: 'HS1 (L4)', value: d.he_so_1_l4 });
                    if (d.he_so_2_l1) details.push({ label: 'HS2 (L1)', value: d.he_so_2_l1 });
                    if (d.he_so_2_l2) details.push({ label: 'HS2 (L2)', value: d.he_so_2_l2 });
                    if (d.he_so_2_l3) details.push({ label: 'HS2 (L3)', value: d.he_so_2_l3 });
                    if (d.he_so_2_l4) details.push({ label: 'HS2 (L4)', value: d.he_so_2_l4 });
                    if (d.thuc_hanh_1) details.push({ label: 'Thực Hành 1', value: d.thuc_hanh_1 });
                    if (d.thuc_hanh_2) details.push({ label: 'Thực Hành 2', value: d.thuc_hanh_2 });
                    if (d.tb_thuong_ky) details.push({ label: 'TB Thường Kỳ', value: d.tb_thuong_ky });
                    if (d.dieu_kien_thi) details.push({ label: 'Điều Kiện Thi', value: d.dieu_kien_thi });

                    const detailRowId = `detail-${hk}-${index}`;
                    const hasDetails = details.length > 0;

                    const detailHtml = hasDetails ? `
                    <tr id="${detailRowId}" class="detail-row hidden">
                        <td colspan="5">
                            <div class="detail-grid">
                                ${details.map(item => `
                                    <div class="detail-item">
                                        <span class="detail-label">${item.label}</span>
                                        <span class="detail-value">${item.value}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </td>
                    </tr>
                ` : '';

                    return `
                    <tr class="${scoreClass} main-row ${hasDetails ? 'clickable' : ''}" onclick="${hasDetails ? `toggleDetail('${detailRowId}')` : ''}">
                        <td class="col-mon">
                            ${d.ten_mon || ''}
                            ${hasDetails ? '<i class="fa-solid fa-chevron-down row-toggle-icon"></i>' : ''}
                        </td>
                        <td class="col-tc text-center">${d.so_tin_chi || ''}</td>
                        <td class="col-diem text-center">${d.diem_thi || '-'}</td>
                        <td class="col-tk text-center font-bold">${d.tong_ket_10 || '-'}</td>
                        <td class="col-chu text-center"><span class="grade-badge ${passClass}">${d.diem_chu || '-'}</span></td>
                    </tr>
                    ${detailHtml}
                `;
                }).join('');

            accordionHtml += `
                <details class="semester-card">
                    <summary class="semester-header">
                        <span class="semester-title">Học Kỳ ${hk}</span>
                        ${semesterGPA ? `<span class="semester-gpa">GPA: <strong>${semesterGPA}</strong> / 4.0</span>` : ''}
                    </summary>
                    <div class="grades-table-wrapper">
                        <table class="modern-table">
                            <thead>
                                <tr>
                                    <th>Môn Học</th>
                                    <th class="text-center">Số TC</th>
                                    <th class="text-center">Điểm Thi</th>
                                    <th class="text-center">TK (10)</th>
                                    <th class="text-center">Điểm Chữ</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${gradesRows}
                            </tbody>
                        </table>
                    </div>
                </details>
            `;
        });

        accordionHtml += '</div>';

        gradeArea.innerHTML = `
            <div class="student-profile-header">
                <div class="profile-avatar">
                    <i class="fa-solid fa-user-graduate"></i>
                </div>
                <div class="profile-info">
                    <h2 class="profile-name">${student.ho_ten}</h2>
                    <div class="profile-meta">
                        <span><i class="fa-solid fa-id-card"></i> ${student.msv}</span>
                        <span><i class="fa-solid fa-users"></i> ${student.ma_lop || 'N/A'}</span>
                        <span><i class="fa-solid fa-calendar"></i> ${student.ngay_sinh || 'N/A'}</span>
                    </div>
                </div>
                <div class="profile-stats">
                    <div class="stat-box">
                        <span class="stat-label">CPA Tích Lũy</span>
                        <span class="stat-value">${overallGPA}</span>
                    </div>
                </div>
            </div>
            
            <div class="timeline-container">
                ${accordionHtml}
            </div>
        `;

    } catch (error) {
        console.error(error);
        alert('Lỗi tải điểm sinh viên');
    } finally {
        showLoading(false);
    }
}

async function searchStudent() {
    const query = document.getElementById('searchInput').value;
    if (!query) return;

    // Treat search as a special view
    currentView = 'search';
    showLoading(true);

    document.getElementById('classListArea').classList.add('hidden');
    document.getElementById('studentListArea').classList.add('hidden');
    document.getElementById('gradeArea').classList.remove('hidden');
    updateBreadcrumb([{ text: 'Trang Chủ', action: 'loadClasses()' }, { text: `Tìm kiếm: "${query}"`, action: '' }]);

    const gradeArea = document.getElementById('gradeArea');
    gradeArea.innerHTML = '';

    try {
        const response = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.results.length === 0) {
            gradeArea.innerHTML = '<p style="text-align:center">Không tìm thấy sinh viên nào.</p>';
            return;
        }

        // Reuse the logic for displaying multiple students if search returns multiple
        // Use a simpler list view for search results
        const resultDiv = document.createElement('div');
        resultDiv.className = 'grid-container';

        data.results.forEach(student => {
            const div = document.createElement('div');
            div.className = 'grid-item student-item';
            div.innerHTML = `
                <div class="sv-name">${student.ho_ten}</div>
                <div class="sv-msv">${student.msv}</div>
                <div class="sv-class">${student.ma_lop || ''}</div>
            `;
            // Upon distinct search result click, show grade details
            // We can reload the grade view for that single student
            div.onclick = () => loadGrade(student.msv);
            resultDiv.appendChild(div);
        });

        gradeArea.appendChild(resultDiv);

    } catch (error) {
        console.error(error);
        gradeArea.innerHTML = '<p style="text-align:center; color: red;">Có lỗi xảy ra.</p>';
    } finally {
        showLoading(false);
    }
}

function toggleDetail(rowId) {
    const detailRow = document.getElementById(rowId);
    if (detailRow) {
        detailRow.classList.toggle('hidden');
        // Find the icon in the previous sibling (main row) and rotate it
        const mainRow = detailRow.previousElementSibling;
        const icon = mainRow.querySelector('.row-toggle-icon');
        if (icon) {
            icon.classList.toggle('rotated');
        }
    }
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        searchStudent();
    }
}
