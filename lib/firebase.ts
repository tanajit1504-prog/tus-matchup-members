import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAf6hFz6lEK0rc6Nb0cbyYOAMm61xRhV7M',
  authDomain: 'tusmatchup.firebaseapp.com',
  projectId: 'tusmatchup',
  storageBucket: 'tusmatchup.firebasestorage.app',
  messagingSenderId: '494454419818',
  appId: '1:494454419818:web:9a00b67bfd420f4d073513',
  measurementId: 'G-CCFSGHDQFJ',
};

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
export const studentEmail = (studentId: string) => `student-${studentId}@tusmatchup.app`;
