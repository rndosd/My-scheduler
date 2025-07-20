import React, { useState, useRef } from 'react';
import { VoiceRecorder, processVoice } from '../services/apiService';

function VoiceRecorderComponent({ type = 'schedule', onProcessed }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [transcribedText, setTranscribedText] = useState('');
  const [processedData, setProcessedData] = useState(null);
  
  const recorderRef = useRef(null);

  // 녹음 시작
  const startRecording = async () => {
    try {
      setError(null);
      
      if (!recorderRef.current) {
        recorderRef.current = new VoiceRecorder();
      }
      
      await recorderRef.current.start();
      setIsRecording(true);
      
    } catch (err) {
      setError('마이크 접근 권한이 필요합니다.');
      console.error('Recording error:', err);
    }
  };

  // 녹음 중지 및 처리
  const stopRecording = async () => {
    if (!recorderRef.current || !isRecording) return;

    try {
      setIsRecording(false);
      setIsProcessing(true);
      
      // 녹음 중지하고 파일 가져오기
      const audioFile = await recorderRef.current.stop();
      
      // 서버로 전송하여 처리
      const result = await processVoice(audioFile, type);
      
      setTranscribedText(result.data.rawText);
      setProcessedData(result.data.processed);
      
      // 부모 컴포넌트에 결과 전달
      if (onProcessed) {
        onProcessed(result.data);
      }
      
    } catch (err) {
      setError('음성 처리 중 오류가 발생했습니다.');
      console.error('Processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 결과 수정
  const handleEdit = (field, value) => {
    setProcessedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="voice-recorder-container p-6 bg-white rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4">
        {type === 'schedule' ? '일정 음성 입력' : 
         type === 'diary' ? '일기 음성 입력' : 
         '메모 음성 입력'}
      </h3>

      {/* 녹음 버튼 */}
      <div className="recording-controls mb-6">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={isProcessing}
            className="px-6 py-3 bg-red-500 text-white rounded-full hover:bg-red-600 disabled:bg-gray-300 transition-colors"
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              녹음 시작
            </span>
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="px-6 py-3 bg-gray-500 text-white rounded-full hover:bg-gray-600 animate-pulse"
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
              </svg>
              녹음 중지
            </span>
          </button>
        )}
      </div>

      {/* 처리 중 표시 */}
      {isProcessing && (
        <div className="processing-indicator mb-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
            <span className="text-gray-600">음성을 처리하고 있습니다...</span>
          </div>
        </div>
      )}

      {/* 에러 표시 */}
      {error && (
        <div className="error-message mb-4 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* 변환된 텍스트 표시 */}
      {transcribedText && (
        <div className="transcribed-text mb-6">
          <h4 className="font-semibold mb-2">변환된 텍스트:</h4>
          <div className="p-4 bg-gray-100 rounded">
            {transcribedText}
          </div>
        </div>
      )}

      {/* 처리된 데이터 표시 및 수정 */}
      {processedData && type === 'schedule' && (
        <div className="processed-data">
          <h4 className="font-semibold mb-4">분석된 일정 정보:</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">제목</label>
              <input
                type="text"
                value={processedData.title || ''}
                onChange={(e) => handleEdit('title', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">날짜</label>
                <input
                  type="date"
                  value={processedData.date || ''}
                  onChange={(e) => handleEdit('date', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">시간</label>
                <input
                  type="time"
                  value={processedData.time || ''}
                  onChange={(e) => handleEdit('time', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">장소</label>
              <input
                type="text"
                value={processedData.location || ''}
                onChange={(e) => handleEdit('location', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">메모</label>
              <textarea
                value={processedData.notes || ''}
                onChange={(e) => handleEdit('notes', e.target.value)}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VoiceRecorderComponent;