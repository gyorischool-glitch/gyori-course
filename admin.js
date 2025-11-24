if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const adb = firebase.database();

// 로그인 여부 확인
function adminLogin() {
    const pw = document.getElementById('adminPassword').value;
    adb.ref('settings/adminPassword').once('value').then(snap => {
        let real = snap.val();
        if (!real) real = '1234'; // 기본 비밀번호
        if (pw === real) {
            localStorage.setItem('adminLoggedIn','true');
            location.href = 'admin.html';
        } else {
            alert('비밀번호가 올바르지 않습니다.');
        }
    });
}

function checkAdminAuth() {
    if (location.pathname.indexOf('admin.html') !== -1 ||
        location.pathname.indexOf('admin-change-pw.html') !== -1) {
        const ok = localStorage.getItem('adminLoggedIn') === 'true';
        if (!ok) location.href = 'admin-login.html';
    }
}
window.addEventListener('load', checkAdminAuth);

// 기간 저장/불러오기
function saveApplyPeriod() {
    const start = document.getElementById('applyStart').value;
    const end = document.getElementById('applyEnd').value;
    if (!start || !end) {
        alert('시작과 마감 날짜/시간을 모두 입력해주세요.');
        return;
    }
    adb.ref('settings/applyPeriod').set({ start, end }).then(() => {
        alert('수강신청 기간이 저장되었습니다.');
        document.getElementById('applyPeriodMsg').textContent = `현재 설정: ${start} ~ ${end}`;
    });
}

function loadApplyPeriod() {
    const s = document.getElementById('applyStart');
    const e = document.getElementById('applyEnd');
    const msg = document.getElementById('applyPeriodMsg');
    if (!s || !e) return;
    adb.ref('settings/applyPeriod').once('value').then(snap => {
        const val = snap.val();
        if (val) {
            s.value = val.start || '';
            e.value = val.end || '';
            if (msg) msg.textContent = `현재 설정: ${val.start} ~ ${val.end}`;
        }
    });
}

// 강좌 저장/수정
function saveCourse() {
    const id = document.getElementById('courseId').value;
    const name = document.getElementById('courseName').value;
    const day = document.getElementById('courseDay').value;
    const st = document.getElementById('courseStartTime').value;
    const et = document.getElementById('courseEndTime').value;
    const limit = Number(document.getElementById('courseLimit').value || 0);
    const hours = Number(document.getElementById('courseHours').value || 1);

    if (!name || !day || !st || !et || !limit) {
        alert('강좌명, 요일, 시간, 정원을 모두 입력해주세요.');
        return;
    }

    const data = { name, day, startTime: st, endTime: et, limit, hours };

    if (id) {
        adb.ref('courses/' + id).update(data).then(() => {
            alert('강좌가 수정되었습니다.');
            autoUpgrade(id);
            loadCourseList();
            clearCourseForm();
        });
    } else {
        const ref = adb.ref('courses').push();
        ref.set(data).then(() => {
            alert('강좌가 등록되었습니다.');
            loadCourseList();
            clearCourseForm();
        });
    }
}

function clearCourseForm() {
    document.getElementById('courseId').value = '';
    document.getElementById('courseName').value = '';
    document.getElementById('courseDay').value = '';
    document.getElementById('courseStartTime').value = '';
    document.getElementById('courseEndTime').value = '';
    document.getElementById('courseLimit').value = '';
    document.getElementById('courseHours').value = '';
}

function loadCourseList() {
    const tbody = document.getElementById('courseListBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6">불러오는 중...</td></tr>';
    adb.ref('courses').once('value').then(snap => {
        const courses = snap.val() || {};
        tbody.innerHTML = '';
        Object.keys(courses).forEach(id => {
            const c = courses[id];
            const appliedCount = c.applied ? Object.keys(c.applied).length : 0;
            const waitCount = c.waitlist ? Object.keys(c.waitlist).length : 0;
            const timeText = (c.startTime && c.endTime) ? `${c.startTime}~${c.endTime}` : '';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${c.name || ''}</td>
                <td>${c.day || ''}</td>
                <td>${timeText}</td>
                <td>${c.limit || 0}</td>
                <td>${appliedCount}/${waitCount}</td>
                <td>
                    <button class="btn-small btn-edit" onclick="editCourse('${id}')">수정</button>
                    <button class="btn-small btn-del" onclick="deleteCourse('${id}')">삭제</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}

function editCourse(id) {
    adb.ref('courses/' + id).once('value').then(snap => {
        const c = snap.val();
        document.getElementById('courseId').value = id;
        document.getElementById('courseName').value = c.name || '';
        document.getElementById('courseDay').value = c.day || '';
        document.getElementById('courseStartTime').value = c.startTime || '';
        document.getElementById('courseEndTime').value = c.endTime || '';
        document.getElementById('courseLimit').value = c.limit || '';
        document.getElementById('courseHours').value = c.hours || '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function deleteCourse(id) {
    if (!confirm('이 강좌를 삭제할까요?')) return;
    adb.ref('courses/' + id).remove().then(() => {
        alert('삭제되었습니다.');
        loadCourseList();
    });
}

// 정원 변경 시 대기자 자동 승급
function autoUpgrade(courseId) {
    adb.ref('courses/' + courseId).once('value').then(snap => {
        const c = snap.val();
        if (!c) return;
        const limit = c.limit || 0;
        const applied = c.applied ? { ...c.applied } : {};
        let appliedCount = Object.keys(applied).length;
        const wait = c.waitlist ? c.waitlist : {};

        // 대기자 배열 (order 순)
        const arr = Object.entries(wait).map(([uid, data]) => ({
            uid,
            name: data.name,
            grade: data.grade,
            class: data.class,
            order: data.order || 9999
        })).sort((a,b)=>a.order-b.order);

        const updates = {};
        for (const w of arr) {
            if (appliedCount >= limit) break;
            updates['applied/' + w.uid] = {
                name: w.name,
                grade: w.grade,
                class: w.class
            };
            updates['waitlist/' + w.uid] = null;
            appliedCount++;
        }

        if (Object.keys(updates).length > 0) {
            adb.ref('courses/' + courseId).update(updates);
        }
    });
}

// 관리자 비밀번호 변경
function changeAdminPassword() {
    const oldPw = document.getElementById('oldPw').value;
    const newPw = document.getElementById('newPw').value;
    if (!oldPw || !newPw) {
        alert('현재 비밀번호와 새 비밀번호를 모두 입력해주세요.');
        return;
    }
    adb.ref('settings/adminPassword').once('value').then(snap => {
        let real = snap.val();
        if (!real) real = '1234';
        if (oldPw !== real) {
            alert('현재 비밀번호가 올바르지 않습니다.');
            return;
        }
        adb.ref('settings/adminPassword').set(newPw).then(()=>{
            alert('비밀번호가 변경되었습니다.');
            location.href = 'admin.html';
        });
    });
}

// 기타 이동/로그아웃
function goStudent() {
    location.href = 'index.html';
}
function goChangePw() {
    location.href = 'admin-change-pw.html';
}
function adminLogout() {
    localStorage.removeItem('adminLoggedIn');
    location.href = 'admin-login.html';
}

window.addEventListener('load', () => {
    if (document.getElementById('courseListBody')) {
        loadApplyPeriod();
        loadCourseList();
    }
});
