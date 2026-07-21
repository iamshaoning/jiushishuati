// 全局类型定义

export type UserRole = 'teacher' | 'student' | 'admin';

// 用户状态：0 正常(NORMAL), 1 封禁(BANNED), 2 待审批(PENDING)
export type UserStatus = 0 | 1 | 2;

export interface User {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}

export interface QuestionBank {
  id: string;
  name: string;
  description: string;
  question_count: number;
  created_at: string;
  updated_at: string;
  owner_id: string | null;
  share_code: string | null;
  type: 'practice' | 'exam';
  // 关联查询字段（非数据库列）
  owner_name?: string;
}

// 题型：single 单选, multiple 多选, judge 判断, short 填空
export type QuestionType = 'single' | 'multiple' | 'judge' | 'short';

export interface Question {
  id: string;
  bank_id: string;
  type: QuestionType;
  content: string;
  options: string[] | null;
  answer: string;
  analysis: string;
  sort_order: number;
  created_at: string;
}

export interface BankAccess {
  id: string;
  student_id: string;
  bank_id: string;
  claimed_at: string;
}

// 练习记录：学生每次完成练习/考试后写入一条
export interface PracticeRecord {
  id: string;
  student_id: string;
  bank_id: string;
  bank_name?: string; // 关联查询字段
  mode: 'practice' | 'exam';
  total: number;
  correct: number;
  started_at: string;
  ended_at: string;
}

// 试卷答题记录（只记错题）
export interface ExamAnswer {
  id: string;
  student_id: string;
  bank_id: string;
  question_id: string;
  student_answer: string;
  correct_answer: string;
  created_at: string;
  // 关联查询字段
  display_name?: string;
  question_content?: string;
  question_type?: QuestionType;
  question_options?: string[] | null;
}

// 错题本
export interface WrongQuestion {
  id: string;
  student_id: string;
  bank_id: string;
  bank_name?: string; // 关联查询字段
  question_id: string;
  student_answer: string;
  correct_answer: string;
  mode: 'practice' | 'exam';
  created_at: string;
  // 关联查询字段
  question_content?: string;
  question_type?: QuestionType;
  question_options?: string[] | null;
}

// 解析过程中的题目结构（未入库）
export interface ParsedQuestion {
  type: QuestionType;
  content: string;
  options: string[] | null;
  answer: string;
  analysis: string;
  sort_order: number;
}

// 用户统计
export interface UserStats {
  students: number;
  teachers: number;
  pending: number;
  banned: number;
}
