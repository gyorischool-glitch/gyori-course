// 학생용 JS
firebase.initializeApp(firebaseConfig);
let db=firebase.database();

window.onload=function(){
 let u=localStorage.getItem('studentUser');
 if(!u){location.href='login.html';return;}
 u=JSON.parse(u);
 document.getElementById('userBox').innerHTML=u.grade+'학년 '+u.class+'반 '+u.name;
 loadCourses();
}

function loadCourses(){
 db.ref('courses').once('value').then(s=>{
   let h='';
   s.forEach(c=>{
     let v=c.val();
     h+=`<div><b>${v.name}</b> (${v.day} ${v.startTime}) 
     <button onclick="apply('${c.key}')">신청</button></div>`;
   });
   document.getElementById('courseList').innerHTML=h;
 });
}

function apply(id){
 let u=JSON.parse(localStorage.getItem('studentUser'));
 db.ref('courses/'+id+'/applied/'+u.uid).set({
   name:u.name,grade:u.grade,class:u.class
 });
 alert('신청 완료');
}

function logout(){
 localStorage.removeItem('studentUser');
 location.href='login.html';
}
