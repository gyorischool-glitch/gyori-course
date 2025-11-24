const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let studentData = JSON.parse(localStorage.getItem("studentUser"));
let calendar;
let allCourses = [];   // 강좌 전체 목록 (검색/상세/체크박스용)

// 로그인
function studentLogin() {
    const grade = document.getElementById("grade").value;
    const cls = document.getElementById("class").value;
    const name = document.getElementById("name").value;
    const phone = document.getElementById("phone").value;

    if (!grade || !cls || !name) {
        alert("학년, 반, 이름은 필수입니다.");
        return;
    }

    const data = {
        grade,
        class: cls,
        name,
        phone,
        uid: Date.now()
    };

    localStorage.setItem("studentUser", JSON.stringify(data));
    location.href = "index.html";
}

window.onload = () => {
    if (location.pathname.includes("index") && !studentData) location.href = "login.html";
    if (studentData && document.getElementById("studentName")) {
        document.getElementById("studentName").innerText =
            `${studentData.grade}학년 ${studentData.class}반 ${studentData.name}`;
    }
};

/* =========================
   강좌 목록 (테이블 UI)
========================= */
function showCourseList() {
    document.getElementById("courseContainer").classList.remove("hidden");
    document.getElementById("mypageContainer").classList.add("hidden");

    const countSpan = document.getElementById("courseCount");
    allCourses = [];

    db.ref("courses").once("value").then(snapshot => {
        snapshot.forEach(c => {
            const id = c.key;
            const data = c.val();

            // 내 학년이 포함된 강좌만
            if (!data.grade || !data.grade.includes(Number(studentData.grade))) return;

            allCourses.push({ id, ...data });
        });

        countSpan.textContent = allCourses.length;
        renderCourseTable(allCourses);
    });
}

function renderCourseTable(list) {
    const tbody = document.getElementById("courseTableBody");
    tbody.innerHTML = "";

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10">조건에 맞는 강좌가 없습니다.</td></tr>`;
        return;
    }

    let num = list.length;

    list.forEach(c => {
        const appliedCount = c.applied ? Object.keys(c.applied).length : 0;
        const waitCount = c.waitlist ? Object.keys(c.waitlist).length : 0;
        const isFull = appliedCount >= c.limit;
        const isApplied = c.applied && c.applied[studentData.uid];

        const periodText = (c.startDate && c.endDate)
            ? `${c.startDate} ~ ${c.endDate}`
            : (c.period || "-");

        const feeText = c.fee ? c.fee.toLocaleString() : "-";

        let statusHtml = "";

        if (isApplied) {
            statusHtml = `
                <div class="status-double">
                    <span class="course-status-done">신청완료</span>
                    <button class="cancel-btn" onclick="cancelCourse('${c.id}')">취소</button>
                </div>
            `;
        } else if (isFull) {
            statusHtml = `<span class="course-status-full">정원마감</span>`;
        } else {
            statusHtml = `<button class="course-status-btn" onclick="apply('${c.id}')">신청</button>`;
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <input type="checkbox" class="course-check" data-id="${c.id}">
            </td>
            <td>${num--}</td>
            <td class="clickable" onclick="openDetailById('${c.id}')">${c.periodName || "-"}</td>
            <td class="clickable" onclick="openDetailById('${c.id}')">${c.name}</td>
            <td>${c.teacher || "-"}</td>
            <td>${periodText}</td>
            <td>${feeText}</td>
            <td>${appliedCount}/${c.limit}</td>
            <td>${waitCount}/${c.limit}</td>
            <td>${statusHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

/* 전체 선택 체크박스 */
function toggleAllCourses(master) {
    document.querySelectorAll(".course-check").forEach(chk => {
        chk.checked = master.checked;
    });
}

/* 상세 보기 */
function openDetailById(courseId) {
    const course = allCourses.find(c => c.id === courseId);
    if (!course) return;
    openDetail(course);
}

function openDetail(course) {
    const popup = document.createElement("div");
    popup.className = "popup-bg";
    popup.innerHTML = `
        <div class="popup-box">
            <h3>${course.name}</h3>
            <p><b>기간명:</b> ${course.periodName || "-"}</p>
            <p><b>강사:</b> ${course.teacher || "-"}</p>
            <p><b>요일:</b> ${course.day || "-"}</p>
            <p><b>시간:</b> ${course.startTime || ""} ~ ${course.endTime || ""}</p>
            <p><b>장소:</b> ${course.room || "-"}</p>
            <p><b>설명:</b> ${course.detail || "등록된 설명이 없습니다."}</p>
            <button class="popup-close" onclick="this.parentNode.parentNode.remove()">닫기</button>
        </div>
    `;
    document.body.appendChild(popup);
}

/* 검색 */
function searchCourses() {
    const field = document.getElementById("searchField").value;
    const keyword = document.getElementById("searchKeyword").value.trim();

    if (!keyword) {
        renderCourseTable(allCourses);
        return;
    }

    const filtered = allCourses.filter(c => {
        const value = (c[field] || "").toString();
        return value.includes(keyword);
    });

    renderCourseTable(filtered);
}

/* =========================
   신청 / 취소
========================= */

// 신청 + 정원 초과 시 자동 대기자
function apply(courseId) {
    const ref = db.ref(`courses/${courseId}`);

    ref.once("value").then(snap => {
        const c = snap.val();
        const appliedCount = c.applied ? Object.keys(c.applied).length : 0;

        if (appliedCount >= c.limit) {
            db.ref(`courses/${courseId}/waitlist/${studentData.uid}`).set(studentData);
            showToast("⚠️ 정원이 찼습니다. 대기자로 등록되었습니다.");
            showCourseList();
            return;
        }

        db.ref(`courses/${courseId}/applied/${studentData.uid}`).set(studentData);
        showToast("🎉 신청 완료되었습니다!");
        showCourseList();
    });
}

// 취소
function cancelCourse(courseId) {
    if (!confirm("정말 취소하시겠습니까?")) return;

    db.ref(`courses/${courseId}/applied/${studentData.uid}`).remove().then(() => {
        // 자동 승급 (admin 쪽에서 별도 관리하는 경우 빈 함수일 수 있음)
        try {
            checkAutoPromote(courseId);
        } catch(e) {}

        showToast("⚠ 신청이 취소되었습니다.");
        showCourseList();
    });
}

// 자동 승급 호출 (index.html에서는 구현 X, admin.html에서 구현용 자리)
function checkAutoPromote() {}

/* =========================
   마이페이지 (기존 유지)
========================= */
function showMyPage() {
    document.getElementById("mypageContainer").classList.remove("hidden");
    document.getElementById("courseContainer").classList.add("hidden");

    const ul = document.getElementById("myCourseList");
    ul.innerHTML = "";

    let events = [];

    db.ref("courses").once("value").then(snapshot => {
        snapshot.forEach(c => {
            const data = c.val();
            if (data.applied && data.applied[studentData.uid]) {
                ul.innerHTML += `
                    <li>
                        ${data.name} (${data.time || 0}시간)
                        <button onclick="cancelCourse('${c.key}')">취소</button>
                    </li>
                `;

                if (data.startTime && data.endTime) {
                    events.push({
                        title: data.name,
                        start: data.startTime,
                        end: data.endTime
                    });
                }
            }
        });

        if (!calendar) {
            calendar = new FullCalendar.Calendar(document.getElementById("calendar"), {
                initialView: "timeGridWeek",
                slotMinTime: "08:00",
                slotMaxTime: "20:00",
                events
            });
            calendar.render();
        } else {
            calendar.removeAllEvents();
            calendar.addEventSource(events);
        }
    });
}

/* =========================
   기타
========================= */
function logout() {
    localStorage.removeItem("studentUser");
    location.href = "login.html";
}

// 토스트 메시지
function showToast(msg) {
    const t = document.createElement("div");
    t.className = "toast-message";
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add("show"), 100);
    setTimeout(() => {
        t.classList.remove("show");
        setTimeout(() => t.remove(), 300);
    }, 3000);
}
