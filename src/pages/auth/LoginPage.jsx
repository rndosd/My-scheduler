import React, { useState } from 'react';
import { Link } from 'react-router-dom';
// import { useAuth } from '../../hooks/useAuth'; // 필요시 주석 해제
import styles from './LoginPage.module.css';
import { Toaster } from 'react-hot-toast';

const LoginPage = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  // const { loading, signIn } = useAuth(); // 실제 기능 연결 시 주석 해제
  const loading = false; // UI 확인을 위한 임시 변수

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // signIn(formData.email, formData.password); // 실제 기능 연결 시 주석 해제
    console.log('로그인 시도:', formData);
  };

  return (
    <>
      <Toaster position="top-center" />
      <div className={styles.pageContainer}>
        <div className={styles.loginCard}>
          {/* 헤더 */}
          <div className={styles.header}>
            <span className={styles.icon}>🗓️</span>
            <h1>My Voice Scheduler</h1>
            <p>로그인하여 일정을 관리하세요.</p>
          </div>

          {/* 로그인 폼 */}
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="email">이메일</label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="이메일 주소를 입력하세요"
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="password">비밀번호</label>
              <input
                id="password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="비밀번호를 입력하세요"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={styles.loginButton}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* 추가 옵션 */}
          <div className={styles.footer}>
            <Link to="/forgot-password">비밀번호 찾기</Link>
            <span>|</span>
            <Link to="/signup">회원가입</Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
