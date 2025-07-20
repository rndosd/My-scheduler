// functions/index.js (CommonJS 버전)

const {
  onRequest,
  onCall,
  HttpsError,
} = require('firebase-functions/v2/https'); // onCall, HttpsError 추가
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const multer = require('multer');

// v2 글로벌 설정
setGlobalOptions({
  region: 'asia-northeast3',
  memory: '1GiB',
  timeoutSeconds: 540,
});

// 로컬 서비스 파일들도 require로 변경
const gptService = require('./services/gptService.js');
const firestoreService = require('./services/firestoreService.js');
const whisperService = require('./services/whisperService.js');
const apiService = require('./services/apiService.js');

// ✅ Firebase Admin 초기화 (가장 먼저)
if (!admin.apps.length) {
  admin.initializeApp();
}

// ✅ Admin 서비스들 추가
const authAdmin = admin.auth();
const db = admin.firestore();
const { FieldValue } = admin.firestore;

const app = express();

// CORS 설정
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? ['https://your-domain.com']
        : ['http://localhost:3000'],
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Multer (파일 업로드) 설정
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) cb(null, true);
    else cb(new Error('Only audio files are allowed'), false);
  },
});

// 인증 미들웨어
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
    };
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}

// 에러 핸들링 미들웨어
function handleError(err, req, res, next) {
  console.error('Error:', err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large' });
  }
  if (err.message === 'Only audio files are allowed') {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({
    error:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
  });
}

// ── 루트 & 헬스체크 ──
app.get('', (req, res) => {
  res.json({
    message: 'My Scheduler API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services: ['gpt', 'firestore', 'whisper', 'api'],
  });
});

app.get('/health', async (req, res) => {
  try {
    const checks = await Promise.allSettled([
      firestoreService.healthCheck(),
      gptService.healthCheck(),
      whisperService.healthCheck(),
    ]);

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        firestore: checks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        gpt: checks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
        whisper: checks[2].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ── 음성 처리 API ──
app.post(
  '/voice/process',
  authenticateUser,
  upload.single('audio'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      const { type = 'schedule' } = req.body;
      const audioBuffer = req.file.buffer;

      // 1) Whisper로 텍스트 변환
      const transcription = await whisperService.transcribeAudio(audioBuffer, {
        language: 'ko',
        format: req.file.mimetype,
      });
      if (!transcription) {
        return res.status(400).json({ error: 'Could not transcribe audio' });
      }

      // 2) GPT로 구조화
      const structuredData = await gptService.processText(transcription, type);

      // 3) Firestore에 저장
      const docRef = await firestoreService.saveDocument(
        req.user.uid,
        structuredData,
        type
      );

      res.json({
        success: true,
        transcription,
        data: structuredData,
        id: docRef.id,
      });
    } catch (error) {
      console.error('Voice processing error:', error);
      res.status(500).json({
        error: 'Failed to process voice',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

// ── 일정 관리 API ──
app.get('/schedules', authenticateUser, async (req, res) => {
  try {
    const { date, startDate, endDate, limit = 50 } = req.query;
    const filters = {
      userId: req.user.uid,
      date,
      startDate,
      endDate,
      limit: parseInt(limit, 10),
    };
    const schedules = await firestoreService.getSchedules(filters);
    res.json({ schedules });
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ error: 'Failed to get schedules' });
  }
});

app.post('/schedules', authenticateUser, async (req, res) => {
  try {
    const scheduleData = { ...req.body, userId: req.user.uid };
    const docRef = await firestoreService.createSchedule(scheduleData);
    res.json({ success: true, id: docRef.id, data: scheduleData });
  } catch (error) {
    console.error('Create schedule error:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

app.put('/schedules/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    await firestoreService.updateSchedule(id, updates, req.user.uid);
    res.json({ success: true, id, updates });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

app.delete('/schedules/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    await firestoreService.deleteSchedule(id, req.user.uid);
    res.json({ success: true, id });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// ── 일기 관리 API ──
app.get('/diary', authenticateUser, async (req, res) => {
  try {
    const { date, limit = 20 } = req.query;
    const filters = {
      userId: req.user.uid,
      date,
      limit: parseInt(limit, 10),
    };
    const entries = await firestoreService.getDiaryEntries(filters);
    res.json({ entries });
  } catch (error) {
    console.error('Get diary error:', error);
    res.status(500).json({ error: 'Failed to get diary entries' });
  }
});

app.post('/diary', authenticateUser, async (req, res) => {
  try {
    const diaryData = { ...req.body, userId: req.user.uid };
    const docRef = await firestoreService.createDiaryEntry(diaryData);
    res.json({ success: true, id: docRef.id, data: diaryData });
  } catch (error) {
    console.error('Create diary error:', error);
    res.status(500).json({ error: 'Failed to create diary entry' });
  }
});

// ── 메모 관리 API ──
app.get('/memos', authenticateUser, async (req, res) => {
  try {
    const { category, limit = 50 } = req.query;
    const filters = {
      userId: req.user.uid,
      category,
      limit: parseInt(limit, 10),
    };
    const memos = await firestoreService.getMemos(filters);
    res.json({ memos });
  } catch (error) {
    console.error('Get memos error:', error);
    res.status(500).json({ error: 'Failed to get memos' });
  }
});

// ── 통계/분석 API ──
app.get('/analytics/summary', authenticateUser, async (req, res) => {
  try {
    const { period = '7d' } = req.query;
    const summary = await firestoreService.getAnalyticsSummary(
      req.user.uid,
      period
    );
    res.json(summary);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// 에러 핸들러 & 404
app.use(handleError);
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ✅ Firebase Functions v2 export
exports.api = onRequest(app);

// 개발 환경 로컬 서버
if (process.env.NODE_ENV === 'development') {
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
  });
}

// ✅ 일반 계정 생성 함수
exports.requestAccount = onCall(
  {
    region: 'asia-northeast3',
    cors: [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://your-domain.com',
    ],
  },
  async (request) => {
    const { name, email, password } = request.data;

    if (!name || !email || !password) {
      throw new HttpsError('invalid-argument', '모든 필드를 입력해주세요.');
    }

    try {
      // 이메일 중복 확인
      const userExists = await authAdmin.getUserByEmail(email).catch((err) => {
        if (err.code === 'auth/user-not-found') return null;
        throw err;
      });
      if (userExists) {
        throw new HttpsError('already-exists', 'auth/email-already-exists');
      }

      // 사용자 생성
      const newUser = await authAdmin.createUser({
        email,
        password,
        displayName: name,
      });

      // Custom Claims 설정 (기본 user 역할)
      await authAdmin.setCustomUserClaims(newUser.uid, { role: 'user' });

      // Firestore에 사용자 정보 저장
      await db.doc(`users/${newUser.uid}`).set({
        uid: newUser.uid,
        name,
        email,
        role: 'user',
        createdAt: FieldValue.serverTimestamp(),
      });

      return { success: true, message: '회원가입이 완료되었습니다.' };
    } catch (error) {
      console.error('requestAccount error:', error);
      if (error.code && error.httpErrorCode) throw error;
      throw new HttpsError('internal', error.message || '서버 오류 발생');
    }
  }
);
