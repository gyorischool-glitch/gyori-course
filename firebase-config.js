// firebase-config.js
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBu7kqKScxk7-8CgsXRi4hCiIYmPHpjeYU",
  authDomain: "gyori-course.firebaseapp.com",
  databaseURL: "https://gyori-course-default-rtdb.firebaseio.com",
  projectId: "gyori-course",
  storageBucket: "gyori-course.firebasestorage.app",
  messagingSenderId: "179567019982",
  appId: "1:179567019982:web:881f6915f5c76fb1474d9f",
  measurementId: "G-W862ZZXQY3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);