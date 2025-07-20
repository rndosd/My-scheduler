// src/services/apiService.js
import { auth } from '../firebase'; // Firebase auth import (나중에 설정)

// API 기본 URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://asia-northeast3-my-scheduler-465908.cloudfunctions.net/api';

/**
 * 인증 헤더가 포함된 fetch 요청
 */
async function authenticatedFetch(url, options = {}) {
  try {
    // Firebase Auth에서 토큰 가져오기 (임시로 주석 처리)
    // const user = auth.currentUser;
    // if (!user) {
    //   throw new Error('User not authenticated');
    // }
    // const token = await user.getIdToken();
    
    const headers = {
      'Content-Type': 'application/json',
      // 'Authorization': `Bearer ${token}`,
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
        errorMessage = response.statusText || errorMessage;
      }
      
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    } else {
      return response.text();
    }
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
}

/**
 * 일정 조회
 * @param {Object} filters - 필터 옵션
 * @returns {Promise<Object>} - 일정 목록
 */
export async function getSchedules(filters = {}) {
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
 * 새 일정 생성
 * @param {Object} scheduleData - 일정 데이터
 * @returns {Promise<Object>} - 생성된 일정
 */
export async function createSchedule(scheduleData) {
  if (!scheduleData || Object.keys(scheduleData).length === 0) {
    throw new Error('Schedule data is required');
  }

  return authenticatedFetch(`${API_BASE_URL}/schedules`, {
    method: 'POST',
    body: JSON.stringify(scheduleData)
  });
}

/**
 * 일정 수정
 * @param {string} scheduleId - 일정 ID
 * @param {Object} updates - 수정 내용
 * @returns {Promise<Object>} - 수정된 일정
 */
export async function updateSchedule(scheduleId, updates) {
  if (!scheduleId) {
    throw new Error('Schedule ID is required');
  }
  
  if (!updates || Object.keys(updates).length === 0) {
    throw new Error('Updates are required');
  }

  return authenticatedFetch(`${API_BASE_URL}/schedules/${scheduleId}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
}

/**
 * 일정 삭제
 * @param {string} scheduleId - 일정 ID
 * @returns {Promise<Object>} - 삭제 결과
 */
export async function deleteSchedule(scheduleId) {
  if (!scheduleId) {
    throw new Error('Schedule ID is required');
  }

  return authenticatedFetch(`${API_BASE_URL}/schedules/${scheduleId}`, {
    method: 'DELETE'
  });
}

/**
 * 음성 파일 처리
 * @param {File} audioFile - 음성 파일
 * @param {string} type - 처리 타입 (schedule, diary, memo)
 * @returns {Promise<Object>} - 처리 결과
 */
export async function processVoice(audioFile, type = 'schedule') {
  if (!audioFile || !audioFile.size) {
    throw new Error('Valid audio file is required');
  }

  const formData = new FormData();
  formData.append('audio', audioFile);
  formData.append('type', type);

  return authenticatedFetch(`${API_BASE_URL}/voice/process`, {
    method: 'POST',
    headers: {}, // FormData는 Content-Type 제거
    body: formData
  });
}