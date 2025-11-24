const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let studentData = JSON.parse(localStorage.getItem("studentUser"));
let calendar;

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
    if (location.pathname.includes("index") && !studentData) location.href="login.html";
    if (studentData) {
        document.getElementById("studentName").innerText =
            `${studentData.grade}학년 ${studentData.class}반 ${studentData.name}`;
    }
};

// 강좌 목록
function showCourseList() {
    document.getElementById("courseContainer").classList.remove("hidden");
    document.getElementById("mypageContainer").classList.add("hidden");

    const list = document.getElementById("courseList");
    list.innerHTML = "";

    db.ref("courses").once("value").then(snapshot => {
        snapshot.forEach(c => {
            const data = c.val();
            if (!data.grade.includes(Number(studentData.grade))) return;

            const total = data.applied ? Object.keys(data.applied).length : 0;

            const div = document.createElement("div");
            div.className = "course-item";
            div.innerHTML = `
                <strong>${data.name}</strong> (${data.time || 0}시간)
                <br>정원: ${data.limit} / 신청: ${total}
                <br>${data.day}요일 ${data.startTime}~${data.endTime}
                <br><button onclick="apply('${c.key}')">신청</button>
                <button onclick="alert('${data.detail || "상세 내용 없음"}')">상세보기</button>
            `;
            list.appendChild(div);
        });
    });
}

// 신청 + 정원 초과 시 자동 대기자
function apply(courseId) {
    const ref = db.ref(`courses/${courseId}`);

    ref.once("value").then(snap => {
        const c = snap.val();
        const appliedCount = c.applied ? Object.keys(c.applied).length : 0;

        if (appliedCount >= c.limit) {
            db.ref(`courses/${courseId}/waitlist/${studentData.uid}`).set(studentData);
            showToast("⚠️ 정원이 찼습니다. 대기자로 등록되었습니다.");
            return;
        }

        db.ref(`courses/${courseId}/applied/${studentData.uid}`).set(studentData);
        showToast("🎉 신청 완료되었습니다!");
    });
}

// 취소
function cancelCourse(courseId) {
    if (!confirm("정말 취소하시겠습니까?")) return;

    db.ref(`courses/${courseId}/applied/${studentData.uid}`).remove().then(() => {
        checkAutoPromote(courseId);
        showToast("⚠ 취소되었습니다.");
        showMyPage();
    });
}

// 자동 승급 호출 (admin.js에서 동작)
function checkAutoPromote() {}

// 마이페이지
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
                        ${data.name} (${data.time}시간)
                        <button onclick="cancelCourse('${c.key}')">취소</button>
                    </li>
                `;

                if (data.startTime && data.endTime)
                    events.push({
                        title: data.name,
                        start: data.startTime,
                        end: data.endTime
                    });
            }
        });

        // 달력
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

function logout() {
    localStorage.removeItem("studentUser");
    location.href="login.html";
}

// 토스트 메시지
function showToast(msg) {
    const t = document.createElement("div");
    t.className = "toast-message";
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(()=> t.classList.add("show"),100);
    setTimeout(()=>{
        t.classList.remove("show");
        setTimeout(()=> t.remove(),300);
    },3000);
}
