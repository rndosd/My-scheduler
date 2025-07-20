import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import toast, { Toaster } from 'react-hot-toast';
import styles from './SignupPage.module.css';

const SignupPage = () => {
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.displayName || !formData.email || !formData.password) {
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

    setLoading(true);
    try {
      // Firebase Functions 호출
      const requestAccount = httpsCallable(functions, 'requestAccount');

      const result = await requestAccount({
        name: formData.displayName,
        email: formData.email,
        password: formData.password,
      });

      console.log('회원가입 성공:', result.data);

      toast.success(
        `${formData.displayName}님, 환영합니다! 로그인 페이지로 이동합니다.`
      );
      navigate('/login');
    } catch (error) {
      console.error('회원가입 에러:', error);

      let errorMessage = '회원가입 중 오류가 발생했습니다.';

      // Firebase Functions 에러 처리
      if (error.code === 'functions/already-exists') {
        errorMessage = '이미 사용 중인 이메일입니다.';
      } else if (error.code === 'functions/invalid-argument') {
        errorMessage = '입력 정보를 확인해주세요.';
      } else if (error.code === 'functions/internal') {
        errorMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Toaster position="top-center" />
      <div className={styles.pageContainer}>
        <div className={styles.signupCard}>
          {/* 헤더 */}
          <div className={styles.header}>
            <span className={styles.icon}>🚀</span>
            <h1>My Voice Scheduler</h1>
            <p>새로운 계정을 만들어 시작하세요.</p>
          </div>

          {/* 회원가입 폼 */}
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="displayName">이름</label>
              <input
                id="displayName"
                type="text"
                name="displayName"
                value={formData.displayName}
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
              disabled={loading}
              className={styles.signupButton}
            >
              {loading ? '가입 중...' : '계정 만들기'}
            </button>
          </form>

          {/* 하단 링크 */}
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
