// Firebase 초기화
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

let studentData = null;
let periodStart = null;
let periodEnd = null;
let periodLoaded = false;

// 페이지 로드 시 학생 정보 확인
window.addEventListener('load', () => {
    const stored = localStorage.getItem('studentUser');
    if (!stored) {
        location.href = 'login.html';
        return;
    }
    studentData = JSON.parse(stored);
    const nameBox = document.getElementById('studentName');
    if (nameBox) {
        nameBox.textContent = `${studentData.grade}학년 ${studentData.class}반 ${studentData.name}`;
    }
    loadPeriodForStudent();
});

// 로그아웃
function logout() {
    localStorage.removeItem('studentUser');
    location.href = 'login.html';
}

// 수강신청 기간 불러오기
function loadPeriodForStudent() {
    db.ref('settings/applyPeriod').once('value').then(snap => {
        const val = snap.val();
        if (val && val.start && val.end) {
            periodStart = new Date(val.start);
            periodEnd = new Date(val.end);
            periodLoaded = true;
            checkApplyPeriod();
        } else {
            const msg = document.getElementById('applyStatusMsg');
            if (msg) msg.textContent = '수강신청 기간이 설정되지 않았습니다.';
        }
    });
}

// 기간 체크 및 안내
function checkApplyPeriod() {
    if (!periodLoaded) return;
    const now = new Date();
    const msg = document.getElementById('applyStatusMsg');
    if (!msg) return;

    if (now < periodStart) {
        msg.textContent = `⏳ 수강신청은 ${periodStart.toLocaleString()}부터 가능합니다.`;
        disableApplyButtons(true);
    } else if (now > periodEnd) {
        msg.textContent = `🚫 수강신청이 ${periodEnd.toLocaleString()}에 마감되었습니다.`;
        disableApplyButtons(true);
    } else {
        msg.textContent = `🟢 수강신청이 가능합니다. (마감: ${periodEnd.toLocaleString()})`;
        disableApplyButtons(false);
    }
}

function disableApplyButtons(disabled) {
    document.querySelectorAll('.apply-btn').forEach(btn => {
        btn.disabled = disabled;
    });
}

// 강좌 목록 표시
function showCourseList() {
    document.getElementById('courseContainer').style.display = 'block';
    document.getElementById('myPage').style.display = 'none';

    db.ref('courses').once('value').then(snap => {
        const list = [];
        snap.forEach(child => {
            list.push({ id: child.key, ...child.val() });
        });
        renderCourseTable(list);
    });
}

function getMyWaitNumber(course) {
    if (!course.waitlist) return null;
    const arr = Object.entries(course.waitlist).map(([uid, data]) => ({
        uid,
        order: data.order,
        name: data.name
    }));
    arr.sort((a,b)=>(a.order||9999)-(b.order||9999));
    const my = arr.find(v => v.uid === studentData.uid);
    return my ? my.order : null;
}

function renderCourseTable(list) {
    const tbody = document.getElementById('courseTableBody');
    tbody.innerHTML = '';
    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">개설된 강좌가 없습니다.</td></tr>';
        return;
    }
    let num = list.length;
    list.forEach(c => {
        const appliedCount = c.applied ? Object.keys(c.applied).length : 0;
        const waitCount = c.waitlist ? Object.keys(c.waitlist).length : 0;
        const isApplied = c.applied && c.applied[studentData.uid];

        let statusHtml = '';
        if (isApplied) {
            statusHtml = `<button class="cancel-btn" onclick="cancelCourse('${c.id}')">취소</button>`;
        } else {
            statusHtml = `<button class="course-status-btn apply-btn" onclick="apply('${c.id}')">신청</button>`;
        }
        const myWait = getMyWaitNumber(c);
        if (myWait) {
            statusHtml += `<div style="margin-top:3px;font-size:11px;color:#8e24aa;">대기번호: ${myWait}번</div>`;
        }

        const timeText = (c.startTime && c.endTime) ? `${c.startTime}~${c.endTime}` : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${num--}</td>
            <td>${c.name || ''}</td>
            <td>${c.day || ''}</td>
            <td>${timeText}</td>
            <td>${c.limit || 0}</td>
            <td>${appliedCount}/${waitCount}</td>
            <td>${statusHtml}</td>
        `;
        tbody.appendChild(tr);
    });
    checkApplyPeriod();
}

// 수강신청 (중복 시간 방지 + 기간 + 정원 + 대기번호)
function apply(courseId) {
    if (!periodLoaded) {
        alert('수강신청 기간 정보를 불러오지 못했습니다.');
        return;
    }
    db.ref('courses/' + courseId).once('value').then(snap => {
        const course = snap.val();
        if (!course) {
            alert('강좌 정보를 찾을 수 없습니다.');
            return;
        }

        // 시간 중복 검사
        db.ref('courses').once('value').then(listSnap => {
            const all = listSnap.val() || {};
            for (let cid in all) {
                const c = all[cid];
                if (!c.applied || !c.applied[studentData.uid]) continue;
                if (c.day === course.day && c.startTime === course.startTime) {
                    alert(`이미 같은 시간(${course.day} ${course.startTime})에 '${c.name}'을(를) 신청했습니다.\n같은 시간대 수업은 중복 신청할 수 없습니다.`);
                    return;
                }
            }

            const appliedCount = course.applied ? Object.keys(course.applied).length : 0;
            const limit = course.limit || 0;
            const now = new Date();

            const getNextWaitOrder = () => {
                if (!course.waitlist) return 1;
                return Object.keys(course.waitlist).length + 1;
            };

            // 기간이 아니면 대기자
            if (now < periodStart || now > periodEnd) {
                const order = getNextWaitOrder();
                db.ref(`courses/${courseId}/waitlist/${studentData.uid}`).set({
                    name: studentData.name,
                    grade: studentData.grade,
                    class: studentData.class,
                    order: order
                }).then(() => {
                    alert(`현재는 신청기간이 아닙니다.\n자동으로 대기자 ${order}번으로 등록되었습니다.`);
                    showCourseList();
                });
                return;
            }

            // 정원 초과 → 대기자
            if (appliedCount >= limit) {
                const order = getNextWaitOrder();
                db.ref(`courses/${courseId}/waitlist/${studentData.uid}`).set({
                    name: studentData.name,
                    grade: studentData.grade,
                    class: studentData.class,
                    order: order
                }).then(() => {
                    alert(`정원이 가득 찼습니다.\n대기자 ${order}번으로 등록되었습니다.`);
                    showCourseList();
                });
                return;
            }

            // 정상 신청
            db.ref(`courses/${courseId}/applied/${studentData.uid}`).set({
                name: studentData.name,
                grade: studentData.grade,
                class: studentData.class
            }).then(() => {
                alert('수강신청이 완료되었습니다.');
                showCourseList();
            });
        });
    });
}

// 신청 취소
function cancelCourse(courseId) {
    db.ref(`courses/${courseId}/applied/${studentData.uid}`).remove().then(() => {
        alert('수강신청이 취소되었습니다.');
        showCourseList();
        loadMyInfo();
    });
}

// 마이페이지
function openMyPage() {
    document.getElementById('courseContainer').style.display = 'none';
    document.getElementById('myPage').style.display = 'block';
    loadMyInfo();
}
function closeMyPage() {
    document.getElementById('myPage').style.display = 'none';
}

// 내 정보 로딩
function loadMyInfo() {
    const appliedList = document.getElementById('myAppliedList');
    const waitList = document.getElementById('myWaitList');
    const totalHoursBox = document.getElementById('totalHours');

    appliedList.innerHTML = '불러오는 중...';
    waitList.innerHTML = '불러오는 중...';
    totalHoursBox.textContent = '';

    db.ref('courses').once('value').then(snap => {
        const courses = snap.val() || {};
        let totalHours = 0;
        let appliedFound = false;
        let waitFound = false;
        appliedList.innerHTML = '';
        waitList.innerHTML = '';

        for (let id in courses) {
            const c = courses[id];
            if (c.applied && c.applied[studentData.uid]) {
                appliedFound = true;
                const h = Number(c.hours || 1);
                totalHours += h;
                appliedList.innerHTML += `<li>${c.name} (${h}시간)</li>`;
            }
            if (c.waitlist && c.waitlist[studentData.uid]) {
                waitFound = true;
                const order = c.waitlist[studentData.uid].order || '-';
                waitList.innerHTML += `<li>${c.name} (대기번호: ${order}번)</li>`;
            }
        }

        if (!appliedFound) appliedList.innerHTML = '<li>신청한 과목이 없습니다.</li>';
        if (!waitFound) waitList.innerHTML = '<li>대기 중인 과목이 없습니다.</li>';

        totalHoursBox.textContent = `📌 총 수강시간: ${totalHours}시간`;

        loadMonthlySchedule();
        loadWeeklySchedule();
        loadCalendarView();
    });
}

// 월별 시간표
function loadMonthlySchedule() {
    const sel = document.getElementById('calendarMonth');
    const month = Number(sel.value);
    const list = document.getElementById('monthlySchedule');
    if (!month) {
        list.innerHTML = '';
        return;
    }
    list.innerHTML = '불러오는 중...';

    db.ref('courses').once('value').then(snap => {
        const courses = snap.val() || {};
        let found = false;
        list.innerHTML = '';
        for (let id in courses) {
            const c = courses[id];
            if (!c.startDate || !c.endDate) continue;
            if (!c.applied || !c.applied[studentData.uid]) continue;
            const m = Number((c.startDate || '').split('-')[1]);
            if (m === month) {
                found = true;
                list.innerHTML += `<li>${c.name} (${c.startDate} ~ ${c.endDate})</li>`;
            }
        }
        if (!found) list.innerHTML = '<li>해당 월의 수업이 없습니다.</li>';
    });
}

// 주간 시간표 (중복 표시 없이)
function loadWeeklySchedule() {
    const box = document.getElementById('weeklyTable');
    box.innerHTML = '불러오는 중...';
    db.ref('courses').once('value').then(snap => {
        const courses = snap.val() || {};
        const dayMap = { '월':1,'화':2,'수':3,'목':4,'금':5 };
        let times = new Set();
        let schedule = {};

        for (let id in courses) {
            const c = courses[id];
            if (!c.applied || !c.applied[studentData.uid]) continue;
            if (!c.day || !c.startTime) continue;
            const d = dayMap[c.day];
            if (!d) continue;
            const t = c.startTime;
            times.add(t);
            if (!schedule[t]) schedule[t] = {};
            if (!schedule[t][d]) schedule[t][d] = [];
            schedule[t][d].push(c.name);
        }
        times = [...times].sort();
        let html = '<table style="width:100%;border-collapse:collapse;font-size:13px;text-align:center;">';
        html += '<thead><tr style="background:#f3f6fb;"><th style="border:1px solid #ddd;padding:6px;">시간</th><th style="border:1px solid #ddd;padding:6px;">월</th><th style="border:1px solid #ddd;padding:6px;">화</th><th style="border:1px solid #ddd;padding:6px;">수</th><th style="border:1px solid #ddd;padding:6px;">목</th><th style="border:1px solid #ddd;padding:6px;">금</th></tr></thead><tbody>';
        times.forEach(t => {
            html += `<tr><td style="border:1px solid #ddd;padding:6px;">${t}</td>`;
            for (let d=1; d<=5; d++) {
                const names = schedule[t] && schedule[t][d] ? schedule[t][d].join('<br>') : '';
                html += `<td style="border:1px solid #ddd;padding:6px;">${names}</td>`;
            }
            html += '</tr>';
        });
        html += '</tbody></table>';
        box.innerHTML = html;
    });
}

// 간단 캘린더 뷰
function loadCalendarView() {
    const box = document.getElementById('calendarView');
    box.innerHTML = '불러오는 중...';
    db.ref('courses').once('value').then(snap => {
        const courses = snap.val() || {};
        let html = '';
        for (let id in courses) {
            const c = courses[id];
            if (!c.applied || !c.applied[studentData.uid]) continue;
            if (!c.startDate || !c.endDate) continue;
            html += `<div style="margin-bottom:6px;"><b>${c.name}</b> (${c.startDate} ~ ${c.endDate})</div>`;
        }
        box.innerHTML = html || '등록된 수업이 없습니다.';
    });
}
