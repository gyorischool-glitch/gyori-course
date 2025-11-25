// 학생용 스크립트
var db = firebase.database();

var studentData = null;
var periodStart = null;
var periodEnd = null;
var periodLoaded = false;

window.addEventListener('load', function(){
  if (location.pathname.indexOf('index.html') === -1) return;
  var stored = localStorage.getItem('studentUser');
  if (!stored) {
    location.href = 'login.html';
    return;
  }
  studentData = JSON.parse(stored);
  var label = document.getElementById('studentLabel');
  if (label) {
    label.textContent = studentData.grade + '학년 ' + studentData.class + '반 ' + studentData.name;
  }
  loadApplyPeriod();
  loadCourses();
});

function logout(){
  localStorage.removeItem('studentUser');
  location.href = 'login.html';
}

function loadApplyPeriod(){
  db.ref('settings/applyPeriod').once('value').then(function(snap){
    var v = snap.val();
    var msg = document.getElementById('applyStatusMsg');
    if (v && v.start && v.end) {
      periodStart = new Date(v.start);
      periodEnd = new Date(v.end);
      periodLoaded = true;
      var now = new Date();
      if (now < periodStart) {
        msg.textContent = '⏳ 수강신청은 ' + v.start + ' 부터 가능합니다.';
      } else if (now > periodEnd) {
        msg.textContent = '🚫 수강신청이 ' + v.end + ' 에 마감되었습니다.';
      } else {
        msg.textContent = '🟢 수강신청이 가능합니다. (마감: ' + v.end + ')';
      }
    } else {
      msg.textContent = '수강신청 기간이 아직 설정되지 않았습니다.';
    }
  });
}

function loadCourses(){
  db.ref('courses').once('value').then(function(snap){
    var list = [];
    snap.forEach(function(child){
      list.push(Object.assign({id: child.key}, child.val()));
    });
    renderCourseTable(list);
  });
}

function getMyWaitNumber(course){
  if (!course.waitlist) return null;
  var arr = Object.entries(course.waitlist).map(function(e){
    return { uid: e[0], order: e[1].order || 9999 };
  });
  arr.sort(function(a,b){ return a.order - b.order; });
  var mine = arr.find(function(x){ return x.uid === studentData.uid; });
  return mine ? mine.order : null;
}

function renderCourseTable(list){
  var tbody = document.getElementById('courseTableBody');
  tbody.innerHTML = '';
  if (!list || !list.length) {
    tbody.innerHTML = '<tr><td colspan="8">개설된 강좌가 없습니다.</td></tr>';
    return;
  }
  var num = list.length;
  list.sort(function(a,b){ return (a.day||'').localeCompare(b.day||''); });
  list.forEach(function(c){
    var appliedCount = c.applied ? Object.keys(c.applied).length : 0;
    var waitCount = c.waitlist ? Object.keys(c.waitlist).length : 0;
    var isApplied = c.applied && c.applied[studentData.uid];
    var gradeRange = c.gradeRange || '1-6';
    var timeText = (c.startTime && c.endTime) ? (c.startTime + '~' + c.endTime) : '';

    var statusHtml = '';
    if (isApplied) {
      statusHtml = '<button class="btn small outline" onclick="cancelCourse(\'' + c.id + '\')">취소</button>';
    } else {
      statusHtml = '<button class="btn small primary" onclick="apply(\'' + c.id + '\')">신청</button>';
    }

    var myWait = getMyWaitNumber(c);
    if (myWait) {
      statusHtml += '<div style="font-size:11px;color:#8e24aa;margin-top:2px;">대기번호: ' + myWait + '번</div>';
    }

    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + (num--) + '</td>' +
      '<td>' + (c.name || '') + '</td>' +
      '<td>' + gradeRange + '</td>' +
      '<td>' + (c.day || '') + '</td>' +
      '<td>' + timeText + '</td>' +
      '<td>' + (c.limit || 0) + '</td>' +
      '<td>' + appliedCount + '/' + waitCount + '</td>' +
      '<td>' + statusHtml + '</td>';
    tbody.appendChild(tr);
  });
}

// 수강신청 (시간 중복 방지 + 정원 + 대기자)
function apply(courseId){
  if (!periodLoaded) {
    alert('수강신청 기간 정보가 아직 로딩되지 않았습니다.');
    return;
  }
  db.ref('courses/' + courseId).once('value').then(function(snap){
    var course = snap.val();
    if (!course) {
      alert('강좌를 찾을 수 없습니다.');
      return;
    }
    // 학년 범위 확인
    if (course.gradeRange) {
      var parts = String(course.gradeRange).split('-');
      var g = parseInt(studentData.grade,10);
      var g1 = parseInt(parts[0],10);
      var g2 = parseInt(parts[1],10);
      if (g1 && g2 && (g < g1 || g > g2)) {
        alert('이 강좌는 ' + course.gradeRange + '학년만 신청할 수 있습니다.');
        return;
      }
    }
    // 시간 중복 검사
    db.ref('courses').once('value').then(function(allSnap){
      var all = allSnap.val() || {};
      for (var cid in all){
        var c = all[cid];
        if (!c.applied || !c.applied[studentData.uid]) continue;
        if (c.day === course.day && c.startTime === course.startTime) {
          alert('이미 같은 시간(' + course.day + ' ' + course.startTime + ')에 "' + c.name + '" 을(를) 신청했습니다. 같은 시간대에는 중복 신청할 수 없습니다.');
          return;
        }
      }

      var appliedCount = course.applied ? Object.keys(course.applied).length : 0;
      var limit = course.limit || 0;
      var now = new Date();

      var getNextWaitOrder = function(){
        if (!course.waitlist) return 1;
        return Object.keys(course.waitlist).length + 1;
      };

      if (now < periodStart || now > periodEnd) {
        var order1 = getNextWaitOrder();
        db.ref('courses/' + courseId + '/waitlist/' + studentData.uid).set({
          name: studentData.name,
          grade: studentData.grade,
          class: studentData.class,
          order: order1
        }).then(function(){
          alert('현재는 신청기간이 아니어서 대기자 ' + order1 + '번으로 등록되었습니다.');
          loadCourses();
        });
        return;
      }

      if (appliedCount >= limit) {
        var order2 = getNextWaitOrder();
        db.ref('courses/' + courseId + '/waitlist/' + studentData.uid).set({
          name: studentData.name,
          grade: studentData.grade,
          class: studentData.class,
          order: order2
        }).then(function(){
          alert('정원이 가득 찼습니다. 대기자 ' + order2 + '번으로 등록되었습니다.');
          loadCourses();
        });
        return;
      }

      db.ref('courses/' + courseId + '/applied/' + studentData.uid).set({
        name: studentData.name,
        grade: studentData.grade,
        class: studentData.class
      }).then(function(){
        alert('수강신청이 완료되었습니다.');
        loadCourses();
        loadMyInfo();
      });
    });
  });
}

function cancelCourse(courseId){
  db.ref('courses/' + courseId + '/applied/' + studentData.uid).remove().then(function(){
    alert('수강신청이 취소되었습니다.');
    loadCourses();
    loadMyInfo();
  });
}

// 마이페이지
function openMyPage(){
  document.getElementById('myPage').style.display = 'block';
  loadMyInfo();
}
function closeMyPage(){
  document.getElementById('myPage').style.display = 'none';
}

function loadMyInfo(){
  var appliedList = document.getElementById('myAppliedList');
  var waitList = document.getElementById('myWaitList');
  var totalHoursBox = document.getElementById('totalHours');
  appliedList.innerHTML = '불러오는 중...';
  waitList.innerHTML = '불러오는 중...';
  totalHoursBox.textContent = '';

  db.ref('courses').once('value').then(function(snap){
    var courses = snap.val() || {};
    var totalHours = 0;
    var appliedFound = false;
    var waitFound = false;
    appliedList.innerHTML = '';
    waitList.innerHTML = '';

    Object.keys(courses).forEach(function(id){
      var c = courses[id];
      if (c.applied && c.applied[studentData.uid]) {
        appliedFound = true;
        var h = Number(c.hours || 1);
        totalHours += h;
        appliedList.innerHTML += '<li>' + c.name + ' (' + h + '시간)</li>';
      }
      if (c.waitlist && c.waitlist[studentData.uid]) {
        waitFound = true;
        var order = c.waitlist[studentData.uid].order || '-';
        waitList.innerHTML += '<li>' + c.name + ' (대기번호: ' + order + '번)</li>';
      }
    });

    if (!appliedFound) appliedList.innerHTML = '<li>신청한 과목이 없습니다.</li>';
    if (!waitFound) waitList.innerHTML = '<li>대기 중인 과목이 없습니다.</li>';
    totalHoursBox.textContent = '📌 총 수강시간: ' + totalHours + '시간';

    loadMonthlySchedule();
    loadWeeklySchedule();
    loadCalendarView();
  });
}

// 월별 시간표
function loadMonthlySchedule(){
  var sel = document.getElementById('calendarMonth');
  if (!sel) return;
  var month = Number(sel.value);
  var list = document.getElementById('monthlySchedule');
  if (!month) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = '불러오는 중...';
  db.ref('courses').once('value').then(function(snap){
    var courses = snap.val() || {};
    var found = false;
    list.innerHTML = '';
    Object.keys(courses).forEach(function(id){
      var c = courses[id];
      if (!c.period) return;
      if (!c.applied || !c.applied[studentData.uid]) return;
      var parts = String(c.period).split('~');
      if (!parts[0]) return;
      var m = Number(parts[0].split('-')[1]);
      if (m === month) {
        found = true;
        list.innerHTML += '<li>' + c.name + ' (' + c.period + ')</li>';
      }
    });
    if (!found) list.innerHTML = '<li>해당 월의 수업이 없습니다.</li>';
  });
}

// 주간 시간표
function loadWeeklySchedule(){
  var box = document.getElementById('weeklyTable');
  if (!box) return;
  box.innerHTML = '불러오는 중...';
  db.ref('courses').once('value').then(function(snap){
    var courses = snap.val() || {};
    var dayMap = {'월':1,'화':2,'수':3,'목':4,'금':5};
    var times = new Set();
    var schedule = {};
    Object.keys(courses).forEach(function(id){
      var c = courses[id];
      if (!c.applied || !c.applied[studentData.uid]) return;
      if (!c.day || !c.startTime) return;
      var d = dayMap[c.day];
      if (!d) return;
      var t = c.startTime;
      times.add(t);
      if (!schedule[t]) schedule[t] = {};
      if (!schedule[t][d]) schedule[t][d] = [];
      schedule[t][d].push(c.name);
    });
    times = Array.from(times).sort();
    var html = '<table class="table"><thead><tr><th>시간</th><th>월</th><th>화</th><th>수</th><th>목</th><th>금</th></tr></thead><tbody>';
    times.forEach(function(t){
      html += '<tr><td>' + t + '</td>';
      for (var d=1; d<=5; d++){
        var names = schedule[t] && schedule[t][d] ? schedule[t][d].join('<br>') : '';
        html += '<td>' + names + '</td>';
      }
      html += '</tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;
  });
}

// 간단 캘린더 뷰
function loadCalendarView(){
  var box = document.getElementById('calendarView');
  if (!box) return;
  box.innerHTML = '불러오는 중...';
  db.ref('courses').once('value').then(function(snap){
    var courses = snap.val() || {};
    var html = '';
    Object.keys(courses).forEach(function(id){
      var c = courses[id];
      if (!c.applied || !c.applied[studentData.uid]) return;
      if (!c.period) return;
      html += '<div style="margin-bottom:4px;"><b>' + c.name +
        '</b> <span style="color:#555;">(' + c.period + ')</span></div>';
    });
    box.innerHTML = html || '등록된 수업이 없습니다.';
  });
}
