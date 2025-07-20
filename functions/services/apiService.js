const { admin, db } = require('../firebaseAdmin.js');

// API 기본 URL (Firebase Functions)
const API_BASE_URL = 'http://localhost:5001/my-scheduler-465908/asia-northeast3/api';

/**
 * 인증 헤더가 포함된 fetch 요청
 */
async function authenticatedFetch(url, options = {}) {
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  try {
    const token = await user.getIdToken();
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      let errorMessage = `Request failed with status: ${response.status}`;
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch (parseError) {
        // JSON 파싱 실패 시 상태 메시지 사용
        errorMessage = response.statusText || errorMessage;
      }
      
      throw new Error(errorMessage);
    }

    // 응답이 비어있을 수 있으므로 확인
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    } else {
      return response.text();
    }
  } catch (error) {
    console.error('Authenticated fetch error:', error);
    throw error;
  }
}

/**
 * 음성 파일 처리
 * @param {File} audioFile - 음성 파일
 * @param {string} type - 처리 타입 (schedule, diary, memo)
 * @returns {Promise<Object>} - 처리 결과
 */
async function processVoice(audioFile, type = 'schedule') {
  if (!audioFile || !audioFile.size) {
    throw new Error('Valid audio file is required');
  }

  const formData = new FormData();
  formData.append('audio', audioFile);
  formData.append('type', type);

  // FormData 사용 시 Content-Type 헤더 제거 (브라우저가 자동 설정)
  return authenticatedFetch(`${API_BASE_URL}/voice/process`, {
    method: 'POST',
    body: formData
  });
}

/**
 * 일정 조회
 * @param {Object} filters - 필터 옵션
 * @returns {Promise<Object>} - 일정 목록
 */
async function getSchedules(filters = {}) {
  // 빈 값이나 undefined 값 제거
  const cleanFilters = Object.entries(filters)
    .filter(([key, value]) => value !== undefined && value !== null && value !== '')
    .reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {});
    
  const queryParams = new URLSearchParams(cleanFilters).toString();
  const url = `${API_BASE_URL}/schedules${queryParams ? `?${queryParams}` : ''}`;
  
  return authenticatedFetch(url, {
    method: 'GET'
  });
}

/**
 * 일기 조회
 * @param {Object} filters - 필터 옵션
 * @returns {Promise<Object>} - 일기 목록
 */
async function getDiaryEntries(filters = {}) {
  // 빈 값이나 undefined 값 제거
  const cleanFilters = Object.entries(filters)
    .filter(([key, value]) => value !== undefined && value !== null && value !== '')
    .reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {});
    
  const queryParams = new URLSearchParams(cleanFilters).toString();
  const url = `${API_BASE_URL}/diary${queryParams ? `?${queryParams}` : ''}`;
  
  return authenticatedFetch(url, {
    method: 'GET'
  });
}

/**
 * 일정 수정
 * @param {string} scheduleId - 일정 ID
 * @param {Object} updates - 수정 내용
 * @returns {Promise<Object>} - 수정된 일정
 */
async function updateSchedule(scheduleId, updates) {
  if (!scheduleId) {
    throw new Error('Schedule ID is required');
  }
  
  if (!updates || Object.keys(updates).length === 0) {
    throw new Error('Updates are required');
  }

  return authenticatedFetch(`${API_BASE_URL}/schedules/${scheduleId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
}

/**
 * 일정 삭제
 * @param {string} scheduleId - 일정 ID
 * @returns {Promise<Object>} - 삭제 결과
 */
async function deleteSchedule(scheduleId) {
  if (!scheduleId) {
    throw new Error('Schedule ID is required');
  }

  return authenticatedFetch(`${API_BASE_URL}/schedules/${scheduleId}`, {
    method: 'DELETE'
  });
}

/**
 * 새 일정 생성
 * @param {Object} scheduleData - 일정 데이터
 * @returns {Promise<Object>} - 생성된 일정
 */
async function createSchedule(scheduleData) {
  if (!scheduleData || Object.keys(scheduleData).length === 0) {
    throw new Error('Schedule data is required');
  }

  return authenticatedFetch(`${API_BASE_URL}/schedules`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(scheduleData)
  });
}

/**
 * 음성 녹음 시작/중지를 위한 MediaRecorder 헬퍼
 */
class VoiceRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
  }

  async start() {
    try {
      // 이미 녹음 중인 경우 방지
      if (this.isRecording()) {
        throw new Error('Recording is already in progress');
      }

      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      });
      
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: this.getSupportedMimeType()
      });
      
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        this.cleanup();
      };

      this.mediaRecorder.start(1000); // 1초마다 데이터 수집
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.cleanup();
      throw error;
    }
  }

  stop() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        reject(new Error('No active recording to stop'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        try {
          const mimeType = this.mediaRecorder.mimeType;
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });
          
          // 파일 확장자 결정
          const extension = this.getFileExtension(mimeType);
          const audioFile = new File([audioBlob], `recording.${extension}`, { 
            type: mimeType 
          });
          
          this.cleanup();
          resolve(audioFile);
        } catch (error) {
          this.cleanup();
          reject(error);
        }
      };

      try {
        this.mediaRecorder.stop();
      } catch (error) {
        this.cleanup();
        reject(error);
      }
    });
  }

  pause() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }
  }

  resume() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
    }
  }

  isRecording() {
    return this.mediaRecorder && this.mediaRecorder.state === 'recording';
  }

  isPaused() {
    return this.mediaRecorder && this.mediaRecorder.state === 'paused';
  }

  cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }

  getSupportedMimeType() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm'; // 기본값
  }

  getFileExtension(mimeType) {
    const extensions = {
      'audio/webm': 'webm',
      'audio/mp4': 'm4a',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav'
    };

    for (const [type, ext] of Object.entries(extensions)) {
      if (mimeType.includes(type)) {
        return ext;
      }
    }

    return 'webm'; // 기본값
  }
}

// CommonJS exports
module.exports = {
  processVoice,
  getSchedules,
  getDiaryEntries,
  updateSchedule,
  deleteSchedule,
  createSchedule,
  VoiceRecorder
};