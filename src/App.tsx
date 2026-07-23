import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/Toast';
import ScreenGuard from '@/components/ScreenGuard';
import { STATUS } from '@/lib/auth';
import Layout from '@/components/Layout';

import AuthPage from '@/pages/AuthPage';
import TeacherBanks from '@/pages/teacher/Banks';
import TeacherBankNew from '@/pages/teacher/BankNew';
import TeacherBankEdit from '@/pages/teacher/BankEdit';
import TeacherExamNew from '@/pages/teacher/ExamNew';
import TeacherExamRecords from '@/pages/teacher/ExamRecords';
import TeacherExamRecordDetail from '@/pages/teacher/ExamRecordDetail';
import AdminUsers from '@/pages/admin/Users';
import AdminBanks from '@/pages/admin/Banks';
import AdminBankEdit from '@/pages/admin/BankEdit';
import StudentBanks from '@/pages/student/Banks';
import StudentPractice from '@/pages/student/Practice';
import StudentPracticeRecords from '@/pages/student/PracticeRecords';
import StudentWrongBook from '@/pages/student/WrongBook';

function RequireAuth({ children, role }: { children: ReactNode; role: 'teacher' | 'admin' | 'student' }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  const userRole: string = user.role;
  // 管理员可访问所有页面；其他角色仅可访问对应页面
  if (userRole !== role && userRole !== 'admin') {
    const target = userRole === 'admin' ? '/admin' : userRole === 'student' ? '/student' : '/teacher';
    return <Navigate to={target} replace />;
  }
  // 教师/学生非正常状态（待审批/封禁）：踢回登录
  if (userRole !== 'admin' && user.status !== STATUS.NORMAL) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// 嵌套路由：Layout 包裹 Outlet，子路由切换时 Layout 不重挂，保证菜单滑动指示器与侧边栏稳定
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <Routes location={location}>
      <Route path="/login" element={<AuthPage />} />
      <Route path="/register" element={<AuthPage />} />

      {/* 教师路由组 */}
      <Route
        path="/teacher"
        element={
          <RequireAuth role="teacher">
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<TeacherBanks />} />
        <Route path="banks/new" element={<TeacherBankNew />} />
        <Route path="banks/:id" element={<TeacherBankEdit />} />
        <Route path="exam-new/:fromBankId" element={<TeacherExamNew />} />
        <Route path="exam-records" element={<TeacherExamRecords />} />
        <Route path="exam-records/:bankId" element={<TeacherExamRecordDetail />} />
      </Route>

      {/* 管理员路由组 */}
      <Route
        path="/admin"
        element={
          <RequireAuth role="admin">
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<AdminUsers />} />
        <Route path="banks" element={<AdminBanks />} />
        <Route path="banks/:id" element={<AdminBankEdit />} />
      </Route>

      {/* 学生路由组：Practice 独立全屏，不放入 Layout */}
      <Route
        path="/student"
        element={
          <RequireAuth role="student">
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<StudentBanks />} />
        <Route path="records" element={<StudentPracticeRecords />} />
        <Route path="wrong" element={<StudentWrongBook />} />
      </Route>

      {/* Practice 全屏独立路由（不使用 Layout） */}
      <Route
        path="/student/practice/:bankId"
        element={
          <RequireAuth role="student">
            <StudentPractice />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ScreenGuard>
          <Router>
            <AnimatedRoutes />
          </Router>
        </ScreenGuard>
      </ToastProvider>
    </AuthProvider>
  );
}
