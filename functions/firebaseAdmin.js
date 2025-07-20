// functions/firebaseAdmin.js

const admin = require('firebase-admin');

// 이미 초기화되었는지 확인 후, 초기화되지 않았을 때만 실행 (권장 방식)
if (!admin.apps.length) {
  admin.initializeApp();
}

// Firestore 인스턴스 생성
const db = admin.firestore();

// 초기화된 admin 객체와 db 인스턴스를 다른 파일에서 쓸 수 있도록 내보내기
module.exports = { admin, db };