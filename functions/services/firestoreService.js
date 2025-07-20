/**
 * functions/services/firestoreService.js
 * -------------------------------------
 * Firestore 관련 모든 로직을 한 곳에 모아둔 서비스 모듈
 */

const { admin, db } = require('../firebaseAdmin.js');

// ─────────────────────────────
// 1. 헬스 체크
// ─────────────────────────────
/**
 * Firestore 읽기 테스트로 헬스체크
 * @returns {Promise<boolean>}
 */
async function healthCheck() {
  try {
    await db.collection('meta').doc('__healthcheck__').get();
    return true;
  } catch (err) {
    console.error('Firestore healthCheck error:', err);
    throw err;
  }
}

// ─────────────────────────────
// 2. 공통 유틸
// ─────────────────────────────
/**
 * 서버 타임스탬프 반환
 */
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;

/**
 * 타입별 서브컬렉션 매핑
 */
function getSubCollectionPath(userId, type) {
  switch (type) {
    case 'schedule':
      return `users/${userId}/schedules`;
    case 'diary':
      return `users/${userId}/diary`;
    case 'memo':
      return `users/${userId}/memos`;
    default:
      throw new Error(`Unknown type: ${type}`);
  }
}

// ─────────────────────────────
// 3. 문서 저장 (GPT·Whisper 처리 데이터 등)
// ─────────────────────────────
/**
 * @param {string} uid      - 사용자 UID
 * @param {Object} data     - 저장할 데이터 (processed 등 포함)
 * @param {string} type     - schedule | diary | memo
 * @returns {Promise<admin.firestore.DocumentReference>}
 */
async function saveDocument(uid, data, type) {
  const path = getSubCollectionPath(uid, type);
  const docData = {
    ...data,
    userId: uid,
    type,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  return db.collection(path).add(docData);
}

// ─────────────────────────────
// 4. 일정 (Schedule)
// ─────────────────────────────
/**
 * 일정 목록 조회
 * @param {Object} filters
 *    └ userId   {string}
 *    └ date     {string}    YYYY-MM-DD
 *    └ startDate{string}    YYYY-MM-DD
 *    └ endDate  {string}    YYYY-MM-DD
 *    └ category {string}
 *    └ limit    {number}
 */
async function getSchedules(filters = {}) {
  const {
    userId,
    date,
    startDate,
    endDate,
    category,
    limit = 50
  } = filters;

  let q = db.collection(`users/${userId}/schedules`);

  if (date) {
    q = q.where('processed.date', '==', date);
  } else if (startDate && endDate) {
    q = q
      .where('processed.date', '>=', startDate)
      .where('processed.date', '<=', endDate);
  }

  if (category) q = q.where('processed.category', '==', category);

  q = q.orderBy('processed.date', 'desc').limit(limit);

  const snapshot = await q.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * 일정 생성
 * @param {Object} scheduleData - { userId, ... }
 */
async function createSchedule(scheduleData) {
  const { userId } = scheduleData;
  const docData = {
    ...scheduleData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  return db.collection(`users/${userId}/schedules`).add(docData);
}

/**
 * 일정 수정
 */
async function updateSchedule(scheduleId, updates, uid) {
  const docRef = db.doc(`users/${uid}/schedules/${scheduleId}`);

  const docSnap = await docRef.get();
  if (!docSnap.exists) throw new Error('Schedule not found');

  const updateData = {
    ...updates,
    updatedAt: serverTimestamp()
  };

  // processed 필드 병합 처리
  if (updates.processed) {
    updateData.processed = {
      ...docSnap.data().processed,
      ...updates.processed
    };
  }

  await docRef.update(updateData);
  return docRef;
}

/**
 * 일정 삭제
 */
async function deleteSchedule(scheduleId, uid) {
  return db.doc(`users/${uid}/schedules/${scheduleId}`).delete();
}

// ─────────────────────────────
// 5. 일기 (Diary)
// ─────────────────────────────
async function getDiaryEntries(filters = {}) {
  const { userId, date, month, limit = 20 } = filters;
  let q = db.collection(`users/${userId}/diary`);

  if (date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    q = q.where('createdAt', '>=', dayStart).where('createdAt', '<=', dayEnd);
  } else if (month) {
    const [y, m] = month.split('-');
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59, 999);
    q = q.where('createdAt', '>=', start).where('createdAt', '<=', end);
  }

  q = q.orderBy('createdAt', 'desc').limit(limit);
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function createDiaryEntry(diaryData) {
  const { userId } = diaryData;
  const docData = {
    ...diaryData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  return db.collection(`users/${userId}/diary`).add(docData);
}

// ─────────────────────────────
// 6. 메모 (Memo)
// ─────────────────────────────
async function getMemos(filters = {}) {
  const { userId, category, limit = 50 } = filters;
  let q = db.collection(`users/${userId}/memos`);
  if (category) q = q.where('category', '==', category);
  q = q.orderBy('createdAt', 'desc').limit(limit);

  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ─────────────────────────────
// 7. 간단 Analytics (문서 수 집계)
// ─────────────────────────────
async function getAnalyticsSummary(uid, period = '7d') {
  // period: 7d | 30d | all  (단순 예시)
  const periodDays = period === '30d' ? 30 : period === 'all' ? 3650 : 7;
  const since = new Date();
  since.setDate(since.getDate() - periodDays);

  const [scheduleSnap, diarySnap, memoSnap] = await Promise.all([
    db
      .collection(`users/${uid}/schedules`)
      .where('createdAt', '>=', since)
      .get(),
    db.collection(`users/${uid}/diary`).where('createdAt', '>=', since).get(),
    db.collection(`users/${uid}/memos`).where('createdAt', '>=', since).get()
  ]);

  return {
    period,
    since: since.toISOString(),
    counts: {
      schedules: scheduleSnap.size,
      diary: diarySnap.size,
      memos: memoSnap.size
    }
  };
}

// ─────────────────────────────
// 8. 모듈 내보내기 (CommonJS)
// ─────────────────────────────
module.exports = {
  /* health */
  healthCheck,

  /* generic */
  saveDocument,

  /* schedules */
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,

  /* diary */
  getDiaryEntries,
  createDiaryEntry,

  /* memos */
  getMemos,

  /* analytics */
  getAnalyticsSummary
};