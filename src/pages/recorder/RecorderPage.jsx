// src/pages/recorder/RecorderPage.jsx

import React from "react";
import AudioRecorder from "./AudioRecorder";

const RecorderPage = () => {
  return (
    <div style={{ padding: "2rem" }}>
      <h1>음성 스케줄러</h1>
      <AudioRecorder />
      {/* 추후 요약 결과 카드 표시 영역 추가 예정 */}
    </div>
  );
};

export default RecorderPage;
