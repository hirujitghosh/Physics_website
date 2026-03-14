// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAcXgj5QdroAULf3an5EpB2lz2IV5EIDH0",
  authDomain: "numberonephysicslearningspace.firebaseapp.com",
  projectId: "numberonephysicslearningspace",
  storageBucket: "numberonephysicslearningspace.firebasestorage.app",
  messagingSenderId: "419651034908",
  appId: "1:419651034908:web:63b41cbb435f15359164d9",
  measurementId: "G-ZZLVL3Q326"
};


// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const db = firebase.firestore();
const auth = firebase.auth();

// Google Apps Script URL
const APPS_SCRIPT_URL = "YOUR_GOOGLE_APPS_SCRIPT_URL";

// Collection references
const collections = {
    students: db.collection('students'),
    assignments: db.collection('assignments'),
    submissions: db.collection('submissions'),
    attendance: db.collection('attendance'),
    attendanceSummary: db.collection('attendance_summary'),
    feedback: db.collection('feedback'),
    admins: db.collection('admins')
};