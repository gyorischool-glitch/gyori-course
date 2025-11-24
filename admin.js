// 관리자 JS
firebase.initializeApp(firebaseConfig);

function adminLogin(){
 let e=document.getElementById('email').value;
 let p=document.getElementById('pw').value;
 firebase.auth().signInWithEmailAndPassword(e,p)
 .then(()=>location.href='admin.html')
 .catch(err=>alert('로그인 실패: '+err.message));
}

function checkAdmin(){
 firebase.auth().onAuthStateChanged(u=>{
   if(!u) location.href='admin-login.html';
   loadAdmin();
 });
}

function loadAdmin(){
 document.getElementById('adminArea').innerHTML='<h3>강좌관리</h3>';
}

function logoutAdmin(){
 firebase.auth().signOut().then(()=>location.href='admin-login.html');
}
