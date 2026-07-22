# 玖拾刷题

AI开发的刷题平台，支持教师建库出卷、学生练习考试、错题归集。

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
  - **Word 文件**（.docx）：支持含原生公式（OMML→LaTeX）与图片的题目导入
  - **Excel 文件**（.xlsx）：按行解析题型/题干/选项/答案
  - **文本粘贴**：支持纯文本题目直接粘贴快速导入
 - 单题增删改、题库元信息编辑
- 试卷考试记录查看

### 学生
- 通过分享码领取题库
- 练习模式：即时判分、错题自动归集
- 考试模式：交卷后记录错题
- 错题本：按题型统计、重做移除
- 练习记录与正确率统计

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
│   ├── wrongQuestions.ts  #   错题本（RPC）
│   ├── users.ts           #   用户管理（RPC）
│   ├── crypto.ts          #   分享码生成
│   ├── renderRichText.ts  #   富文本渲染（图片/公式/填空判分归一化）
│   └── parsers/           #   题目解析
│       ├── word.ts        #     Word（docx）解析：公式 + 图片
│       ├── excel.ts       #     Excel（xlsx）解析
│       ├── text.ts        #     粘贴文本解析
│       ├── answer.ts      #     答案文件解析
│       ├── types.ts       #     解析相关类型
│       └── omml2mathml.d.ts #   OMML→MathML 转换模块声明
├── pages/
│   ├── AuthPage.tsx       #   登录 / 注册（含登录登出形变过渡动画）
│   ├── admin/             #   管理员页面
│   │   ├── Users.tsx      #     用户审批与管理
│   │   ├── Banks.tsx      #     全平台题库查看
│   │   └── BankEdit.tsx   #     题库编辑（管理员视角）
│   ├── teacher/           #   教师页面
│   │   ├── Banks.tsx      #     教师题库列表
│   │   ├── BankNew.tsx    #     新建题库
│   │   ├── BankEdit.tsx   #     题库编辑（题目增删改 + 三种导入）
│   │   ├── ExamNew.tsx    #     从题库生成试卷
│   │   ├── ExamRecords.tsx #    考试记录列表
│   │   └── ExamRecordDetail.tsx # 考试记录详情
│   └── student/           #   学生页面
│       ├── Banks.tsx      #     学生题库列表（分享码领取）
│       ├── Practice.tsx   #     练习 / 考试答题（全屏）
│       ├── PracticeRecords.tsx # 练习记录与正确率
│       └── WrongBook.tsx  #     错题本
├── App.tsx                # 路由 + 鉴权守卫
├── main.tsx               # 入口
├── index.css              # 全局样式 + KaTeX 字体覆盖
└── vite-env.d.ts          # Vite 环境类型声明