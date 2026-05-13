import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyABrvUpwTyWMzHh0tipdUQylWVPMapbmOo",
  authDomain: "ekam-expert-prod.firebaseapp.com",
  projectId: "ekam-expert-prod",
  storageBucket: "ekam-expert-prod.firebasestorage.app",
  messagingSenderId: "437936113983",
  appId: "1:437936113983:web:85cbc4db75cd294346ab8a",
  measurementId: "G-TD37QT1MX1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Optional: Initialize Analytics (Uncomment if needed)
// const analytics = getAnalytics(app);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
