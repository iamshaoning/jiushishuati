# 玖拾刷题

面向中学场景的在线刷题平台，支持教师建库出卷、学生练习考试、错题归集，并具备 Word 公式与插图的题目导入能力。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite 6 |
| 样式 | TailwindCSS 3 |
| 后端 | Supabase（PostgreSQL + RLS + RPC） |
| 路由 | React Router 7（HashRouter） |
| 公式渲染 | KaTeX |
| 文件解析 | Mammoth（Word）、SheetJS（Excel）、JSZip |
| 图标 | lucide-react |
| 部署 | GitHub Pages + GitHub Actions |

## 功能概览

### 管理员
- 教师注册审批、账号封禁/解封/删除
- 全平台题库查看与管理
- 新教师注册实时提醒（Supabase Realtime）

### 教师
- 创建题库（练习题 / 试卷两种类型）
- 三种题目导入方式：
  - **Word 文件**（.docx）：支持原生公式（OMML→LaTeX）与图片自动提取，EMF/WMF 矢量图自动替换为 PNG 预览
  - **Excel 文件**（.xlsx）：按行解析题型/题干/选项/答案
  - **直接粘贴**：富文本编辑，支持插入图片
- 单题增删改、题库元信息编辑
- 试卷考试记录查看（按学生/按试卷）

### 学生
- 通过分享码领取题库
- 练习模式：即时判分、错题自动归集
- 考试模式：交卷后记录错题
- 错题本：按题型统计、重做移除
- 练习记录与正确率统计

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 Supabase 项目 URL 与 anon key：
#   VITE_SUPABASE_URL=https://your-project.supabase.co
#   VITE_SUPABASE_ANON_KEY=your-publishable-key

# 3. 启动开发服务器
npm run dev
```

类型检查：

```bash
npm run check
```

## 部署（GitHub Pages）

项目通过 GitHub Actions 自动构建部署，推送到 `main` 分支即触发。

### 仓库配置

1. **Pages 部署源**：Settings → Pages → Source 选择 `GitHub Actions`
2. **Actions Secrets**：Settings → Secrets and variables → Actions 添加：
   - `VITE_SUPABASE_URL` — Supabase 项目 URL
   - `VITE_SUPABASE_ANON_KEY` — Supabase anon key

### 访问地址

```
https://<用户名>.github.io/jiushishuati/
```

> `vite.config.ts` 的 `base` 已设为 `/jiushishuati/`，与仓库名匹配。若更换仓库名需同步修改。

## 安全设计

- **写操作 RPC 化**：所有写操作通过 `SECURITY DEFINER` RPC 执行，第一个参数为 `p_token`，服务端反查 `auth_token` 得到真实身份与角色，前端 localStorage 的 role 仅用于 UI 路由，无法绕过后端鉴权
- **RLS 收紧**：业务表对 `anon`/`authenticated` 收回 `INSERT/UPDATE/DELETE`，仅保留 `SELECT`，写操作只能走鉴权 RPC
- **密码哈希保护**：users 表列级权限收紧，`anon` 无法读取 `password_hash`
- **身份不可伪造**：学生类 RPC 的 `student_id` 一律从 token 反查，不接受前端传入
- **题库归属校验**：教师 RPC 校验 `owner_id`，仅 owner 或 admin 可操作

> anon key 会打包进前端 JS，这是 Supabase 的设计（publishable key 可暴露），安全性完全依赖上述 RLS 与 RPC 鉴权。

## 项目结构

```
src/
├── components/          # 通用组件
│   ├── Layout.tsx       #   侧边栏 + 内容区布局
│   ├── Modal.tsx        #   弹窗
│   ├── Toast.tsx        #   全局提示
│   ├── StatCard.tsx     #   统计卡片
│   ├── QuestionEditor.tsx  # 题目编辑器
│   └── MathTextInput.tsx   # 公式输入
├── context/
│   └── AuthContext.tsx  # 登录态管理
├── lib/
│   ├── supabase.ts      #   Supabase 客户端 + 表名常量
│   ├── auth.ts          #   登录/注册/登出 + token 管理
│   ├── types.ts         #   全局类型
│   ├── banks.ts         #   题库管理（RPC）
│   ├── questions.ts     #   题目管理（RPC）
│   ├── exam.ts          #   考试答题（RPC）
│   ├── student.ts       #   学生操作（RPC）
│   ├── wrongQuestions.ts#   错题本（RPC）
│   ├── users.ts         #   用户管理（RPC）
│   ├── crypto.ts        #   分享码生成
│   ├── renderRichText.ts#   富文本渲染（图片/公式/填空判分归一化）
│   └── parsers/         #   题目解析
│       ├── word.ts      #     Word（docx）解析：公式 + 图片
│       ├── excel.ts     #     Excel（xlsx）解析
│       ├── text.ts      #     粘贴文本解析
│       ├── answer.ts    #     答案文件解析
│       └── types.ts
├── pages/
│   ├── Login.tsx        #   登录
│   ├── Register.tsx     #   注册（教师/学生）
│   ├── admin/           #   管理员页面
│   ├── teacher/         #   教师页面
│   └── student/         #   学生页面
├── App.tsx              # 路由 + 鉴权守卫
├── main.tsx             # 入口
└── index.css            # 全局样式 + KaTeX 字体覆盖
```

## Supabase 数据库

数据库迁移脚本（`supabase_migrations*.sql`）不在仓库中，由项目维护者在 Supabase SQL Editor 手动执行。核心表：

| 表 | 说明 |
|----|------|
| `users` | 用户（username/password_hash/role/status/auth_token） |
| `question_banks` | 题库（name/owner_id/share_code/type） |
| `questions` | 题目（bank_id/type/content/options/answer/analysis） |
| `bank_access` | 学生领取记录 |
| `practice_records` | 练习/考试记录 |
| `exam_answers` | 试卷考试错题 |
| `wrong_questions` | 错题本 |
