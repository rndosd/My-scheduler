// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'; // Functions 추가
import { getAnalytics } from 'firebase/analytics';

// Firebase 설정 (Firebase Console에서 복사)
const firebaseConfig = {
  apiKey: 'AIzaSyBFNPUB_VyK1bnotfQmpvMfBLlnoEW_lFY',
  authDomain: 'my-scheduler-465908.firebaseapp.com',
  projectId: 'my-scheduler-465908',
  storageBucket: 'my-scheduler-465908.firebasestorage.app',
  messagingSenderId: '893603925224',
  appId: '1:893603925224:web:8a4fd074a04ac034af4d5d',
  measurementId: 'G-0WRXM4QX9T',
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// Auth, Firestore, Functions, Analytics 인스턴스 생성
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'asia-northeast3'); // Functions 추가
export const analytics = getAnalytics(app);

// 개발 환경에서 에뮬레이터 연결 (선택적)
if (import.meta.env.DEV) {
  try {
    // Auth 에뮬레이터 (9099 포트)
    if (!auth._delegate._config.emulator) {
      connectAuthEmulator(auth, 'http://localhost:9099');
    }

    // Firestore 에뮬레이터 (8080 포트)
    if (!db._delegate._databaseId.database.includes('emulator')) {
      connectFirestoreEmulator(db, 'localhost', 8080);
    }

    // Functions 에뮬레이터 (5001 포트) - 선택적
    // connectFunctionsEmulator(functions, 'localhost', 5001);
  } catch (error) {
    // 이미 연결된 경우 에러 무시
    console.log('Emulators already connected or not available');
  }
}

// 기본 내보내기
export default app;
