// firebase-config.js - Firebase v9+ modular setup (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

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

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);