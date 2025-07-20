// 🚨 여기서 Router import 구문을 제거하세요.
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import SchedulerPage from './pages/scheduler/SchedulerPage';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <AuthProvider>
      {/* 👇 이 <Router>와 짝이 되는 </Router>를 반드시 제거해야 합니다. */}
      {/* <Router> */}
        <div className="App">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <SchedulerPage />
                </PrivateRoute>
              }
            />
            {/* ... 다른 라우트들 */}
          </Routes>
        </div>
      {/* </Router> */}
      {/* 👆 이 </Router>와 짝이 되는 <Router>를 반드시 제거해야 합니다. */}
    </AuthProvider>
  );
}

export default App;