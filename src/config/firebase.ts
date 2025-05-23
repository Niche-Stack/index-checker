import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBCYO44Y4awxP-UbII2xlF9WPafsKKCXSM",
  authDomain: "indexchecker-534db.firebaseapp.com",
  projectId: "indexchecker-534db",
  storageBucket: "indexchecker-534db.firebasestorage.app",
  messagingSenderId: "146812028648",
  appId: "1:146812028648:web:547b3861747f3cfe98ab5d",
  measurementId: "G-4EMVNWEC8S"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Configure Google Auth Provider
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
googleProvider.addScope('https://www.googleapis.com/auth/webmasters'); // Add Search Console scope

export { auth, db, googleProvider };
export default app;