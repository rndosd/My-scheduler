// functions/services/whisperService.js

const fs = require('fs');
const path = require('path');
const os = require('os');
const OpenAI = require('openai');
const pLimit = require('p-limit');

// 지연 초기화 - 실제 사용할 때만 OpenAI 클라이언트 생성
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is missing');
  }
  return new OpenAI({ apiKey });
}

/**
 * Whisper 단일 파일 변환
 * @param {Buffer} audioBuffer
 * @param {string} [ext='webm']  확장자 힌트
 * @returns {Promise<string>}    변환 텍스트
 */
async function transcribe(audioBuffer, ext = 'webm') {
  // 1) tmp 파일 경로
  const tmp = path.join(os.tmpdir(), `audio_${Date.now()}.${ext}`);

  // 2) 버퍼 저장
  await fs.promises.writeFile(tmp, audioBuffer);

  try {
    // 3) OpenAI 클라이언트 생성 (런타임에)
    const openai = getOpenAIClient();
    
    // 4) Whisper 호출 (response_format:"text" → string)
    const transcription = await openai.audio.transcriptions.create({
      file:   fs.createReadStream(tmp),
      model:  'whisper-1',
      language: 'ko'
      // response_format은 기본값이 text이므로 생략 가능
    });
    return transcription.text;
  } finally {
    // 5) tmp 정리
    fs.promises.unlink(tmp).catch(() => {});
  }
}

/**
 * 대용량 음성 → 청크 변환 (25 MB 이하 권장)
 * @param {Buffer} buf
 * @param {number} [chunk=24*1024*1024]
 */
async function transcribeLongAudio(buf, chunk = 24 * 1024 * 1024) {
  const parts = [];
  for (let i = 0; i < buf.length; i += chunk) {
    parts.push(buf.slice(i, i + chunk));
  }

  // pLimit 로직 단순화
  const limit = pLimit(2); // 동시성 2개 제한
  const results = await Promise.all(
    parts.map(p => limit(() => transcribe(p)))
  );
  return results.join(' ');
}

/**
 * 음성 파일 전사 (메인 함수 - index.js에서 호출)
 * @param {Buffer} audioBuffer 
 * @param {Object} options - { language: 'ko', format: 'audio/webm' }
 * @returns {Promise<string>}
 */
async function transcribeAudio(audioBuffer, options = {}) {
  const { language = 'ko', format } = options;
  
  // 파일 크기에 따라 분기 처리
  const maxSize = 24 * 1024 * 1024; // 24MB
  
  if (audioBuffer.length > maxSize) {
    return transcribeLongAudio(audioBuffer);
  } else {
    // 파일 확장자 추출
    let ext = 'webm';
    if (format) {
      if (format.includes('mp4')) ext = 'm4a';
      else if (format.includes('ogg')) ext = 'ogg';
      else if (format.includes('wav')) ext = 'wav';
    }
    
    return transcribe(audioBuffer, ext);
  }
}

/* 헬스체크 */
async function healthCheck() {
  try {
    const openai = getOpenAIClient();
    await openai.models.list({ limit: 1 });
    return true;
  } catch (error) {
    console.error('Whisper health check failed:', error);
    return false;
  }
}

// CommonJS exports
module.exports = {
  transcribe,
  transcribeLongAudio,
  transcribeAudio,  // 메인 함수
  healthCheck
};