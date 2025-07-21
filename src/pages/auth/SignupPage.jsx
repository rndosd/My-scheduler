import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';

// Firebase Callable Function 관련 모듈
import { getFunctions, httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase'; // firebase.js에서 export한 functions 인스턴스

// 스타일 import
import styles from './SignupPage.module.css';

const SignupPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // 모든 입력 필드를 한번에 관리하는 핸들러
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 폼 제출 및 회원가입 처리
  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. 클라이언트 측 유효성 검사
    if (!formData.name || !formData.email || !formData.password) {
      toast.error('모든 필수 필드를 입력해주세요.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (formData.password.length < 6) {
      toast.error('비밀번호는 6자 이상이어야 합니다.');
      return;
    }

    setIsLoading(true);

    try {
      // 2. 백엔드의 'createAccount' 함수를 호출
      const createAccount = httpsCallable(functions, 'createAccount');
      await createAccount({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });

      // 3. 성공 시 피드백 및 메인 페이지로 이동
      toast.success(`${formData.name}님, 환영합니다!`);
      navigate('/'); // 바로 메인 페이지로 이동
    } catch (error) {
      // 4. 에러 처리 (Cloud Function에서 보낸 에러 메시지 표시)
      console.error('회원가입 오류:', error);
      toast.error(error.message || '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Toaster position="top-center" />
      <div className={styles.pageContainer}>
        <div className={styles.signupCard}>
          <div className={styles.header}>
            <span className={styles.icon}>🚀</span>
            <h1>My Voice Scheduler</h1>
            <p>새로운 계정을 만들어 시작하세요.</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="name">이름</label>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="사용하실 이름을 입력하세요"
                required
              />
            </div>
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
                placeholder="비밀번호 (6자 이상)"
                required
              />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="confirmPassword">비밀번호 확인</label>
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="비밀번호를 다시 입력하세요"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className={styles.signupButton}
            >
              {isLoading ? '계정 생성 중...' : '계정 만들기'}
            </button>
          </form>

          <div className={styles.footer}>
            <span>이미 계정이 있으신가요?</span>
            <Link to="/login">로그인</Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignupPage;
