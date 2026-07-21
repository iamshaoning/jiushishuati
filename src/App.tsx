import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/Toast';
import { STATUS } from '@/lib/auth';

import Login from '@/pages/Login';
import Register from '@/pages/Register';
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

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route
              path="/teacher"
              element={
                <RequireAuth role="teacher">
                  <TeacherBanks />
                </RequireAuth>
              }
            />
            <Route
              path="/teacher/banks/new"
              element={
                <RequireAuth role="teacher">
                  <TeacherBankNew />
                </RequireAuth>
              }
            />
            <Route
              path="/teacher/banks/:id"
              element={
                <RequireAuth role="teacher">
                  <TeacherBankEdit />
                </RequireAuth>
              }
            />
            <Route
              path="/teacher/exam-new/:fromBankId"
              element={
                <RequireAuth role="teacher">
                  <TeacherExamNew />
                </RequireAuth>
              }
            />
            <Route
              path="/teacher/exam-records"
              element={
                <RequireAuth role="teacher">
                  <TeacherExamRecords />
                </RequireAuth>
              }
            />
            <Route
              path="/teacher/exam-records/:bankId"
              element={
                <RequireAuth role="teacher">
                  <TeacherExamRecordDetail />
                </RequireAuth>
              }
            />

            <Route
              path="/admin"
              element={
                <RequireAuth role="admin">
                  <AdminUsers />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/banks"
              element={
                <RequireAuth role="admin">
                  <AdminBanks />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/banks/:id"
              element={
                <RequireAuth role="admin">
                  <AdminBankEdit />
                </RequireAuth>
              }
            />

            <Route
              path="/student"
              element={
                <RequireAuth role="student">
                  <StudentBanks />
                </RequireAuth>
              }
            />
            <Route
              path="/student/practice/:bankId"
              element={
                <RequireAuth role="student">
                  <StudentPractice />
                </RequireAuth>
              }
            />
            <Route
              path="/student/records"
              element={
                <RequireAuth role="student">
                  <StudentPracticeRecords />
                </RequireAuth>
              }
            />
            <Route
              path="/student/wrong"
              element={
                <RequireAuth role="student">
                  <StudentWrongBook />
                </RequireAuth>
              }
            />

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}
