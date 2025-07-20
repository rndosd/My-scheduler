import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../contexts/AuthContext'; // AuthContext 경로는 실제 위치에 맞게 수정
import { createSchedule, getSchedules } from '../../services/apiService';

const SchedulerPage = () => {
  const [schedules, setSchedules] = useState([]);
  const [newScheduleTitle, setNewScheduleTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // AuthContext에서 현재 로그인된 사용자 정보를 가져옵니다.
  const { currentUser } = useContext(AuthContext);

  // 일정 데이터를 불러오는 함수
  const fetchSchedules = async () => {
    if (currentUser) {
      setIsLoading(true);
      try {
        // API 형식에 맞게 수정 - 필터 객체로 전달
        const response = await getSchedules({
          // 필요한 필터들 추가 가능
          limit: 50
        });
        setSchedules(response.schedules || []);
      } catch (error) {
        console.error('일정 불러오기 실패:', error);
        setSchedules([]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // 컴포넌트가 처음 렌더링될 때 일정을 불러옵니다.
  useEffect(() => {
    fetchSchedules();
  }, [currentUser]); // currentUser가 변경될 때마다 다시 불러옵니다.

  // 새 일정 추가 핸들러
  const handleAddSchedule = async (e) => {
    e.preventDefault();
    if (newScheduleTitle.trim() === '' || !currentUser) return;

    try {
      // API 형식에 맞게 수정 - 스케줄 객체로 전달
      await createSchedule({
        title: newScheduleTitle,
        date: new Date().toISOString().split('T')[0], // 오늘 날짜
        time: '09:00', // 기본 시간
        category: '개인',
        priority: '보통'
      });
      
      setNewScheduleTitle(''); // 입력 필드 초기화
      await fetchSchedules(); // 목록 새로고침
    } catch (error) {
      console.error('일정 추가 실패:', error);
      alert('일정 추가에 실패했습니다.');
    }
  };

  if (!currentUser) {
    return <div>로그인이 필요합니다.</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>🗓️ 나의 스케줄러</h2>
      <p>'{currentUser.displayName || currentUser.email}'님의 일정을 관리하세요.</p>

      {/* 일정 추가 폼 */}
      <form onSubmit={handleAddSchedule} style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={newScheduleTitle}
          onChange={(e) => setNewScheduleTitle(e.target.value)}
          placeholder="새로운 일정을 입력하세요"
          style={{ marginRight: '10px', padding: '8px' }}
        />
        <button type="submit" style={{ padding: '8px 12px' }}>
          추가
        </button>
      </form>

      {/* 일정 목록 */}
      <h3>내 일정 목록</h3>
      {isLoading ? (
        <p>일정을 불러오는 중...</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {schedules.length > 0 ? (
            schedules.map((schedule) => (
              <li
                key={schedule.id}
                style={{
                  padding: '10px',
                  borderBottom: '1px solid #ccc',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <strong>{schedule.title || schedule.processed?.title}</strong>
                  {schedule.processed?.date && (
                    <span style={{ marginLeft: '10px', color: '#666' }}>
                      📅 {schedule.processed.date}
                    </span>
                  )}
                  {schedule.processed?.time && (
                    <span style={{ marginLeft: '10px', color: '#666' }}>
                      🕐 {schedule.processed.time}
                    </span>
                  )}
                </div>
                {/* TODO: 완료 처리, 삭제 기능 추가 위치 */}
              </li>
            ))
          ) : (
            <p>등록된 일정이 없습니다.</p>
          )}
        </ul>
      )}
    </div>
  );
};

export default SchedulerPage;