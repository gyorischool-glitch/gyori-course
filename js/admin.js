/* ------------------------------------------
   Firebase 초기화
------------------------------------------- */
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

/* ------------------------------------------
   페이지 초기 로딩
------------------------------------------- */
window.onload = () => {
    showTab("programTab");
    loadProgramList();
    loadApplyProgramList();
    loadWaitList();
    loadStats();

    // 자동승급 설정 불러오기
    const auto = localStorage.getItem("autoPromote") === "1";
    document.getElementById("autoPromote").checked = auto;
};

/* ------------------------------------------
   탭 이동
------------------------------------------- */
function showTab(tab) {
    document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));
    document.getElementById(tab).classList.remove("hidden");
}

/* ------------------------------------------
   로그아웃
------------------------------------------- */
function logout() {
    auth.signOut().then(() => {
        alert("로그아웃 되었습니다.");
        location.href = "admin-login.html";
    });
}

/* ------------------------------------------
   1. 프로그램 등록 기능
------------------------------------------- */
function addProgram() {
    const name = p_name.value.trim();
    const cap = Number(p_capacity.value);
    const grades = Array.from(p_grade.selectedOptions).map(o => Number(o.value));
    const day = p_day.value;
    const start = p_startTime.value;
    const end = p_endTime.value;
    const teacher = p_teacher.value.trim();
    const room = p_room.value.trim();
    const desc = p_desc.value.trim();

    if (!name || !cap || !start || !end) {
        alert("프로그램명, 정원, 시간은 반드시 입력해야 합니다.");
        return;
    }

    const ref = db.ref("courses").push();
    ref.set({
        name,
        limit: cap,
        grade: grades,
        day,
        startTime: start,
        endTime: end,
        teacher,
        room,
        detail: desc
    }).then(() => {
        alert("프로그램이 등록되었습니다.");
        resetProgramForm();
        loadProgramList();
        loadApplyProgramList();
        loadWaitList();
        loadStats();
    });
}

function resetProgramForm() {
    programForm.reset();
    Array.from(p_grade.options).forEach(o => o.selected = false);
}

/* ------------------------------------------
   1-2. 등록된 프로그램 목록
------------------------------------------- */
function loadProgramList() {
    const box = document.getElementById("programList");
    box.innerHTML = "";

    db.ref("courses").once("value").then(snap => {
        if (!snap.exists()) {
            box.innerHTML = "<p>등록된 프로그램이 없습니다.</p>";
            return;
        }

        snap.forEach(c => {
            const d = c.val();
            const div = document.createElement("div");
            div.className = "prog-item";

            div.innerHTML = `
                <strong>${d.name}</strong>  
                <br>대상 학년: ${d.grade.join(", ")}  
                <br>정원: ${d.limit}명  
                <br>${d.day}요일 ${d.startTime}~${d.endTime}
                <br>강사: ${d.teacher}, 장소: ${d.room}
                <br>
                <button onclick="editProgram('${c.key}')">수정</button>
                <button onclick="deleteProgram('${c.key}')">삭제</button>
                <button onclick="downloadCourseExcel('${c.key}')">엑셀다운로드</button>
            `;

            box.appendChild(div);
        });
    });
}

/* ------------------------------------------
   1-3. 프로그램 수정
------------------------------------------- */
function editProgram(id) {
    db.ref("courses/" + id).once("value").then(snap => {
        const c = snap.val();
        const name = prompt("프로그램명", c.name);
        if (name === null) return;

        const cap = prompt("정원", c.limit);
        if (cap === null) return;

        const teacher = prompt("강사명", c.teacher || "");
        if (teacher === null) return;

        const room = prompt("장소", c.room || "");
        if (room === null) return;

        db.ref("courses/" + id).update({
            name,
            limit: Number(cap),
            teacher,
            room
        }).then(() => {
            alert("수정되었습니다.");
            loadProgramList();
            loadApplyProgramList();
            loadWaitList();
            loadStats();
        });
    });
}

function deleteProgram(id) {
    if (!confirm("삭제하면 신청자 정보도 모두 삭제됩니다.")) return;

    db.ref("courses/" + id).remove().then(() => {
        alert("삭제되었습니다.");
        loadProgramList();
        loadApplyProgramList();
        loadWaitList();
        loadStats();
    });
}

/* ------------------------------------------
   2. 신청자 관리
------------------------------------------- */
let currentCourseId = null;
let currentApplyData = [];

function loadApplyProgramList() {
    const box = applyProgramList;
    box.innerHTML = "";

    db.ref("courses").once("value").then(snap => {
        snap.forEach(c => {
            const id = c.key;
            const d = c.val();
            const applied = d.applied ? Object.keys(d.applied).length : 0;

            const div = document.createElement("div");
            div.className = "prog-item";

            div.innerHTML = `
                <strong>${d.name}</strong>
                (${applied}명 신청)
                <button onclick="showApplicants('${id}')">보기</button>
            `;

            box.appendChild(div);
        });
    });
}

function showApplicants(id) {
    currentCourseId = id;

    db.ref("courses/" + id).once("value").then(snap => {
        const c = snap.val();
        const applied = c.applied || {};
        currentApplyData = Object.values(applied);

        renderApplicants(currentApplyData);
    });
}

function renderApplicants(list) {
    if (list.length === 0) {
        applyDetail.innerHTML = "<p>신청자가 없습니다.</p>";
        return;
    }

    let html = `
        <table>
        <tr><th>학년</th><th>반</th><th>이름</th><th>연락처</th><th>삭제</th></tr>
    `;

    list.forEach(s => {
        html += `
            <tr>
                <td>${s.grade}</td>
                <td>${s.class}</td>
                <td>${s.name}</td>
                <td>${s.phone || ""}</td>
                <td><button onclick="removeStudent('${s.uid}')">삭제</button></td>
            </tr>
        `;
    });

    html += "</table>";
    applyDetail.innerHTML = html;
}

/* 필터 */
function applyFilter() {
    let g = filterGrade.value;
    let c = filterClass.value;
    let n = filterName.value;

    let arr = currentApplyData.filter(s => {
        return (!g || s.grade == g) &&
               (!c || s.class.includes(c)) &&
               (!n || s.name.includes(n));
    });

    renderApplicants(arr);
}

function clearFilter() {
    filterGrade.value = "";
    filterClass.value = "";
    filterName.value = "";
    renderApplicants(currentApplyData);
}

function removeStudent(uid) {
    if (!confirm("삭제하시겠습니까?")) return;

    db.ref(`courses/${currentCourseId}/applied/${uid}`).remove().then(() => {
        alert("삭제되었습니다.");
        showApplicants(currentCourseId);
        loadWaitList();
        loadStats();
    });
}

/* ------------------------------------------
   3. 대기자 관리 + 자동 승급
------------------------------------------- */
function saveAutoPromote() {
    const val = autoPromote.checked ? "1" : "0";
    localStorage.setItem("autoPromote", val);
}

function loadWaitList() {
    const box = waitList;
    box.innerHTML = "";

    db.ref("courses").once("value").then(snap => {
        snap.forEach(c => {
            const id = c.key;
            const d = c.val();
            const wait = d.waitlist || {};
            const count = Object.keys(wait).length;
            if (!count) return;

            const div = document.createElement("div");
            div.className = "prog-item";

            div.innerHTML = `
                <strong>${d.name}</strong> (대기자 ${count}명)
                <button onclick="showWaitDetail('${id}')">보기</button>
            `;

            box.appendChild(div);
        });
    });
}

function showWaitDetail(id) {
    db.ref(`courses/${id}/waitlist`).once("value").then(snap => {
        if (!snap.exists()) {
            alert("대기자 없음");
            return;
        }

        let txt = "[대기자]\n";
        snap.forEach(s => {
            const d = s.val();
            txt += `${d.grade}학년 ${d.class}반 ${d.name}\n`;
        });
        alert(txt);
    });
}

/* 자동 승급 */
function checkAutoPromote(courseId) {
    const enabled = localStorage.getItem("autoPromote") === "1";
    if (!enabled) return;

    const ref = db.ref("courses/" + courseId);

    ref.once("value").then(snap => {
        const c = snap.val();
        const limit = c.limit;
        const applied = c.applied || {};
        const wait = c.waitlist || {};

        const appliedCount = Object.keys(applied).length;
        const waitKeys = Object.keys(wait);

        if (appliedCount < limit && waitKeys.length > 0) {
            const uid = waitKeys[0];
            const student = wait[uid];

            const updates = {};
            updates[`courses/${courseId}/applied/${uid}`] = student;
            updates[`courses/${courseId}/waitlist/${uid}`] = null;

            db.ref().update(updates).then(() => {
                loadWaitList();
                loadApplyProgramList();
                loadStats();
            });
        }
    });
}

/* ------------------------------------------
   4. 엑셀 다운로드
------------------------------------------- */
function downloadCourseExcel(id) {
    db.ref("courses/" + id).once("value").then(snap => {
        const c = snap.val();

        let rows = [
            ["학년","반","이름","연락처","요일","시간","강사","장소"]
        ];

        const applied = c.applied || {};
        for (let uid in applied) {
            const s = applied[uid];
            rows.push([
                s.grade, s.class, s.name, s.phone || "",
                c.day, `${c.startTime}~${c.endTime}`,
                c.teacher, c.room
            ]);
        }

        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, c.name);
        XLSX.writeFile(wb, `${c.name}_신청자.xlsx`);
    });
}

function downloadExcelAll() {
    db.ref("courses").once("value").then(snap => {
        let rows = [["프로그램명","학년","반","이름","연락처"]];

        snap.forEach(c => {
            const d = c.val();
            const applied = d.applied || {};
            for (let uid in applied) {
                const s = applied[uid];
                rows.push([d.name, s.grade, s.class, s.name, s.phone || ""]);
            }
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "전체신청자");
        XLSX.writeFile(wb, "전체_신청자.xlsx");
    });
}

/* ------------------------------------------
   5. 통계
------------------------------------------- */
function loadStats() {
    const box = stats;
    box.innerHTML = "불러오는 중...";

    db.ref("courses").once("value").then(snap => {
        let gradeCount = {};
        let courseCount = {};
        let ratioList = [];

        snap.forEach(c => {
            const d = c.val();
            const applied = d.applied || {};
            const appliedLen = Object.keys(applied).length;

            // 학년별 계산
            for (let uid in applied) {
                let s = applied[uid];
                gradeCount[s.grade] = (gradeCount[s.grade] || 0) + 1;
            }

            // 인기 과목
            courseCount[d.name] = appliedLen;

            // 정원 대비 비율
            const ratio = d.limit ? ((appliedLen / d.limit) * 100).toFixed(1) : "0";
            ratioList.push(`${d.name}: ${appliedLen}/${d.limit} (${ratio}%)`);
        });

        let html = "<h4>학년별 참여자수</h4><ul>";
        Object.keys(gradeCount).forEach(g => html += `<li>${g}학년: ${gradeCount[g]}명</li>`);
        html += "</ul>";

        html += "<h4>인기 프로그램</h4><ul>";
        Object.keys(courseCount)
            .sort((a,b)=>courseCount[b]-courseCount[a])
            .forEach(name => html += `<li>${name}: ${courseCount[name]}명</li>`);
        html += "</ul>";

        html += "<h4>정원 대비 비율</h4><ul>";
        ratioList.forEach(r => html += `<li>${r}</li>`);
        html += "</ul>";

        box.innerHTML = html;
    });
}
