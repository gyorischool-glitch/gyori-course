function adminLogin(){
    const email=document.getElementById('email').value;
    const pw=document.getElementById('pw').value;
    firebase.auth().signInWithEmailAndPassword(email,pw)
    .then(()=>{window.location.href='admin.html';})
    .catch(e=>alert('로그인 실패: '+e.message));
}