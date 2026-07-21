import { createClient } from '@supabase/supabase-js';

// Supabase 配置：通过 .env 环境变量注入（publishable key 可在前端暴露）
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// 表名常量
export const TABLES = {
  USERS: 'users',
  QUESTION_BANKS: 'question_banks',
  QUESTIONS: 'questions',
  BANK_ACCESS: 'bank_access',
  PRACTICE_RECORDS: 'practice_records',
  EXAM_ANSWERS: 'exam_answers',
  WRONG_QUESTIONS: 'wrong_questions',
} as const;
