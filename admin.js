// 관리자용 스크립트
var adb = firebase.database();
var auth = firebase.auth();
var currentCourseId = null;

// 로그인 페이지에서 사용
function adminLogin(){
  var email = document.getElementById('adminEmail').value.trim();
  var pw = document.getElementById('adminPw').value;
  if (!email || !pw){
    alert('이메일과 비밀번호를 모두 입력해 주세요.');
    return;
  }
  auth.signInWithEmailAndPassword(email, pw)
    .then(function(){
      location.href = 'admin.html';
    })
    .catch(function(err){
      alert('로그인 실패: ' + err.message);
    });
}

// 관리자 페이지 초기화
window.addEventListener('load', function(){
  if (location.pathname.indexOf('admin.html') === -1) return;
  auth.onAuthStateChanged(function(user){
    if (!user){
      location.href = 'admin-login.html';
      return;
    }
    var label = document.getElementById('adminUserLabel');
    if (label) label.textContent = user.email;
    loadApplyPeriod();
    loadCourseList();
  });
});

function logoutAdmin(){
  auth.signOut().then(function(){
    location.href = 'admin-login.html';
  });
}

function goStudent(){
  location.href = 'index.html';
}

// 수강신청 기간
function saveApplyPeriod(){
  var s = document.getElementById('applyStart').value;
  var e = document.getElementById('applyEnd').value;
  if (!s || !e){
    alert('시작/마감 날짜와 시간을 모두 입력하세요.');
    return;
  }
  adb.ref('settings/applyPeriod').set({start:s,end:e}).then(function(){
    alert('수강신청 기간이 저장되었습니다.');
    document.getElementById('applyPeriodMsg').textContent = '현재 설정: ' + s + ' ~ ' + e;
  });
}

function loadApplyPeriod(){
  var s = document.getElementById('applyStart');
  var e = document.getElementById('applyEnd');
  var msg = document.getElementById('applyPeriodMsg');
  adb.ref('settings/applyPeriod').once('value').then(function(snap){
    var v = snap.val();
    if (v){
      s.value = v.start || '';
      e.value = v.end || '';
      msg.textContent = '현재 설정: ' + v.start + ' ~ ' + v.end;
    }
  });
}

// 강좌 관리
function saveCourse(){
  var id = document.getElementById('courseId').value;
  var name = document.getElementById('courseName').value.trim();
  var gradeRange = document.getElementById('courseGradeRange').value.trim();
  var day = document.getElementById('courseDay').value.trim();
  var st = document.getElementById('courseStartTime').value;
  var et = document.getElementById('courseEndTime').value;
  var limit = Number(document.getElementById('courseLimit').value || 0);
  var hours = Number(document.getElementById('courseHours').value || 1);
  var period = document.getElementById('coursePeriod').value.trim();

  if (!name || !day || !st || !et || !limit){
    alert('강좌명, 요일, 시간, 정원은 반드시 입력해야 합니다.');
    return;
  }

  var data = {
    name: name,
    gradeRange: gradeRange || '1-6',
    day: day,
    startTime: st,
    endTime: et,
    limit: limit,
    hours: hours,
    period: period
  };

  if (id){
    adb.ref('courses/' + id).update(data).then(function(){
      alert('강좌가 수정되었습니다.');
      autoUpgrade(id);
      clearCourseForm();
      loadCourseList();
    });
  } else {
    var ref = adb.ref('courses').push();
    ref.set(data).then(function(){
      alert('강좌가 등록되었습니다.');
      clearCourseForm();
      loadCourseList();
    });
  }
}

function clearCourseForm(){
  document.getElementById('courseId').value = '';
  document.getElementById('courseName').value = '';
  document.getElementById('courseGradeRange').value = '';
  document.getElementById('courseDay').value = '';
  document.getElementById('courseStartTime').value = '';
  document.getElementById('courseEndTime').value = '';
  document.getElementById('courseLimit').value = '';
  document.getElementById('courseHours').value = '';
  document.getElementById('coursePeriod').value = '';
}

function loadCourseList(){
  var tbody = document.getElementById('courseListBody');
  tbody.innerHTML = '<tr><td colspan="7">불러오는 중...</td></tr>';
  adb.ref('courses').once('value').then(function(snap){
    var courses = snap.val() || {};
    tbody.innerHTML = '';
    Object.keys(courses).forEach(function(id){
      var c = courses[id];
      var appliedCount = c.applied ? Object.keys(c.applied).length : 0;
      var waitCount = c.waitlist ? Object.keys(c.waitlist).length : 0;
      var timeText = (c.startTime && c.endTime) ? (c.startTime + '~' + c.endTime) : '';
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + (c.name || '') + '</td>' +
        '<td>' + (c.gradeRange || '1-6') + '</td>' +
        '<td>' + (c.day || '') + '</td>' +
        '<td>' + timeText + '</td>' +
        '<td>' + (c.limit || 0) + '</td>' +
        '<td>' + appliedCount + '/' + waitCount + '</td>' +
        '<td>' +
          '<button class="btn small outline" onclick="editCourse(\'' + id + '\')">수정</button> ' +
          '<button class="btn small" onclick="viewApplicants(\'' + id + '\')">신청자</button> ' +
          '<button class="btn small" onclick="deleteCourse(\'' + id + '\')">삭제</button>' +
        '</td>';
      tbody.appendChild(tr);
    });
  });
}

function editCourse(id){
  adb.ref('courses/' + id).once('value').then(function(snap){
    var c = snap.val();
    document.getElementById('courseId').value = id;
    document.getElementById('courseName').value = c.name || '';
    document.getElementById('courseGradeRange').value = c.gradeRange || '';
    document.getElementById('courseDay').value = c.day || '';
    document.getElementById('courseStartTime').value = c.startTime || '';
    document.getElementById('courseEndTime').value = c.endTime || '';
    document.getElementById('courseLimit').value = c.limit || '';
    document.getElementById('courseHours').value = c.hours || '';
    document.getElementById('coursePeriod').value = c.period || '';
    window.scrollTo({top:0,behavior:'smooth'});
  });
}

function deleteCourse(id){
  if (!confirm('이 강좌를 삭제하시겠습니까?')) return;
  adb.ref('courses/' + id).remove().then(function(){
    alert('삭제되었습니다.');
    loadCourseList();
  });
}

// 정원 변경 시 대기자 자동 승급
function autoUpgrade(courseId){
  adb.ref('courses/' + courseId).once('value').then(function(snap){
    var c = snap.val();
    if (!c) return;
    var limit = c.limit || 0;
    var applied = c.applied ? Object.assign({}, c.applied) : {};
    var appliedCount = Object.keys(applied).length;
    var wait = c.waitlist || {};
    var arr = Object.entries(wait).map(function(e){
      return {
        uid: e[0],
        name: e[1].name,
        grade: e[1].grade,
        class: e[1].class,
        order: e[1].order || 9999
      };
    });
    arr.sort(function(a,b){ return a.order - b.order; });
    var updates = {};
    arr.forEach(function(w){
      if (appliedCount >= limit) return;
      updates['applied/' + w.uid] = {name:w.name,grade:w.grade,class:w.class};
      updates['waitlist/' + w.uid] = null;
      appliedCount++;
    });
    if (Object.keys(updates).length){
      adb.ref('courses/' + courseId).update(updates);
    }
  });
}

// 신청자 / 대기자 보기
function viewApplicants(courseId){
  currentCourseId = courseId;
  adb.ref('courses/' + courseId).once('value').then(function(snap){
    var c = snap.val();
    document.getElementById('selectedCourseTitle').textContent = c.name + ' 신청 현황';
    var appliedList = document.getElementById('appliedList');
    var waitList = document.getElementById('waitList');
    appliedList.innerHTML = '';
    waitList.innerHTML = '';

    if (c.applied){
      Object.values(c.applied).forEach(function(s){
        appliedList.innerHTML += '<li>' + s.grade + '학년 ' + s.class + '반 ' + s.name + '</li>';
      });
    } else {
      appliedList.innerHTML = '<li>신청자가 없습니다.</li>';
    }

    if (c.waitlist){
      var arr = Object.entries(c.waitlist).map(function(e){
        return { uid:e[0], order:e[1].order||9999, name:e[1].name, grade:e[1].grade, class:e[1].class };
      });
      arr.sort(function(a,b){ return a.order - b.order; });
      arr.forEach(function(s){
        waitList.innerHTML += '<li>' + s.order + '번 - ' + s.grade + '학년 ' + s.class + '반 ' + s.name + '</li>';
      });
    } else {
      waitList.innerHTML = '<li>대기자가 없습니다.</li>';
    }
  });
}

// CSV 다운로드
function downloadCourseCsv(){
  if (!currentCourseId){
    alert('먼저 강좌 목록에서 "신청자" 버튼을 눌러 강좌를 선택해 주세요.');
    return;
  }
  adb.ref('courses/' + currentCourseId).once('value').then(function(snap){
    var c = snap.val();
    if (!c){
      alert('강좌 정보를 찾을 수 없습니다.');
      return;
    }
    var rows = [];
    rows.push(['구분','학년','반','이름']);
    if (c.applied){
      Object.values(c.applied).forEach(function(s){
        rows.push(['신청자', s.grade, s.class, s.name]);
      });
    }
    if (c.waitlist){
      Object.values(c.waitlist).forEach(function(s){
        rows.push(['대기자', s.grade, s.class, s.name]);
      });
    }
    var csv = rows.map(function(r){ return r.join(','); }).join('\n');
    var blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (c.name || 'course') + '_신청현황.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}
