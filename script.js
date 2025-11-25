firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

/* =====================
   학생용 기능
===================== */
function studentLogin(grade, classNum, name){
    localStorage.setItem("studentInfo", JSON.stringify({grade, classNum, name}));
    window.location.href = "courses.html";
}

function showCourses(){
    const studentInfo = JSON.parse(localStorage.getItem("studentInfo"));
    if(!studentInfo){ alert("로그인 정보 없음"); window.location.href="index.html"; return; }
    
    const listDiv = document.getElementById("courseList");
    listDiv.innerHTML = "";

    db.ref("courses").once("value").then(snapshot=>{
        const courses = snapshot.val();
        for(const courseId in courses){
            const course = courses[courseId];
            if(course.grade.includes(Number(studentInfo.grade))){
                const btn = document.createElement("button");
                btn.textContent = `${course.name} (${course.currentStudents}/${course.maxStudents})`;
                btn.onclick = () => applyCourse(courseId);
                listDiv.appendChild(btn);
                listDiv.appendChild(document.createElement("br"));
            }
        }
    });
}

function applyCourse(courseId){
    const studentInfo = JSON.parse(localStorage.getItem("studentInfo"));
    const courseRef = db.ref("courses/" + courseId);
    courseRef.once("value").then(snap=>{
        const course = snap.val();
        if(course.currentStudents >= course.maxStudents){
            alert("정원 초과. 대기자로 등록됩니다.");
        }
        const newAppRef = db.ref("applications").push();
        newAppRef.set({
            grade: studentInfo.grade,
            class: studentInfo.classNum,
            name: studentInfo.name,
            courseId: courseId,
            timestamp: Date.now()
        });
        courseRef.update({currentStudents: course.currentStudents + 1});
        alert("수강신청 완료!");
    });
}

/* =====================
   관리자 로그인
===================== */
function adminLogin(email, pw){
    auth.signInWithEmailAndPassword(email, pw)
        .then(()=>window.location.href="admin.html")
        .catch(err=>alert(err.message));
}

function logout(){
    auth.signOut().then(()=>window.location.href='admin-login.html');
}

/* =====================
   관리자 과목 관리
===================== */
function addCourse(name, max, gradeArr, hours){
    if(!name || !max || gradeArr.length==0 || !hours){ alert("모두 입력해주세요"); return; }
    db.ref("courses").push({
        name,
        maxStudents: Number(max),
        grade: gradeArr.map(Number),
        currentStudents:0,
        hours: Number(hours)
    });
    alert("과목 추가 완료");
    renderCourseListAdmin();
}

function renderCourseListAdmin(){
    const listDiv = document.getElementById("courseListAdmin");
    listDiv.innerHTML = "";
    db.ref("courses").once("value").then(snapshot=>{
        const courses = snapshot.val();
        for(const id in courses){
            const course = courses[id];
            const div = document.createElement("div");
            div.innerHTML = `
                <strong>${course.name}</strong> 
                <button onclick="viewCourse('${id}')">상세보기</button>
                <button onclick="editCourse('${id}')">수정</button>
            `;
            listDiv.appendChild(div);
        }
        populateCourseSelect(courses);
    });
}

function viewCourse(courseId){
    db.ref("courses/"+courseId).once("value").then(snapshot=>{
        const course = snapshot.val();
        alert(`과목명: ${course.name}\n정원: ${course.maxStudents}\n학년: ${course.grade.join(", ")}\n수업시간: ${course.hours}h`);
    });
}

function editCourse(courseId){
    db.ref("courses/"+courseId).once("value").then(snapshot=>{
        const course = snapshot.val();
        const newName = prompt("과목명 수정:", course.name);
        if(newName===null) return;
        const newMax = prompt("정원 수정:", course.maxStudents);
        if(newMax===null) return;
        const newGrade = prompt("학년 수정(쉼표로 구분):", course.grade.join(","));
        if(newGrade===null) return;
        const newHours = prompt("수업시간 수정(시간):", course.hours);
        if(newHours===null) return;

        db.ref("courses/"+courseId).update({
            name: newName,
            maxStudents: Number(newMax),
            grade: newGrade.split(",").map(Number),
            hours: Number(newHours)
        }).then(()=>{
            alert("과목 정보 수정 완료");
            renderCourseListAdmin();
        });
    });
}

// 월별 출석부 과목 선택 옵션
function populateCourseSelect(courses){
    const select = document.getElementById("courseSelect");
    select.innerHTML = "";
    for(const id in courses){
        const option = document.createElement("option");
        option.value = id;
        option.text = courses[id].name;
        select.appendChild(option);
    }
}

// 과목별 월별 출석부 생성 + 엑셀 다운로드
function generateCourseReport(month, courseId){
    db.ref("applications").once("value").then(snapshot=>{
        const apps = snapshot.val();
        let data = [["학년","반","이름","과목","비고"]];
        const filteredApps = Object.values(apps).filter(app=>{
            const date = new Date(app.timestamp);
            return date.getMonth()+1 == month && app.courseId === courseId;
        });
        if(filteredApps.length===0){ alert("해당 월에 신청자가 없습니다."); return; }

        filteredApps.forEach(app=>{
            db.ref("courses/"+app.courseId).once("value").then(csnap=>{
                const course = csnap.val();
                data.push([app.grade, app.class, app.name, course.name, ""]);
                if(data.length-1 === filteredApps.length){
                    const ws = XLSX.utils.aoa_to_sheet(data);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "출석부");
                    XLSX.writeFile(wb, `${course.name}_${month}월_출석부.xlsx`);
                }
            });
        });
    });
}

// 관리자 비밀번호 변경
function changeAdminPw(newPw){
    const user = auth.currentUser;
    if(user){
        user.updatePassword(newPw).then(()=>alert("비밀번호 변경 완료")).catch(err=>alert(err.message));
    } else alert("로그인 후 이용해주세요.");
}
