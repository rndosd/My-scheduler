import React from 'react';
// 1. Navigate 컴포넌트를 import 합니다.
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const PrivateRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();

  // Firebase 인증 상태를 확인하는 동안 로딩 화면을 보여줍니다.
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <div>로딩 중...</div>
      </div>
    );
  }

  // 2. 로딩이 끝난 후, 로그인 사용자가 없으면 '/login' 경로로 리디렉션합니다.
  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  // 로그인된 경우에만 자식 컴포넌트(요청했던 페이지)를 보여줍니다.
  return children;
};

export default PrivateRoute;