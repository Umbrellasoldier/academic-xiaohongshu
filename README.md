# 学术红书 Academic XiaoHongShu

> 面向广泛知识分享人群的学术社区平台 — 借鉴小红书的交互体验，聚焦学术知识分享

一个学术版小红书（XiaoHongShu），采用 Next.js 全栈方案构建。融合了瀑布流浏览、卡片式内容展示、互动机制等核心体验，并新增论文引用、LaTeX 公式、学科分类、AI 辅助、学术研讨室等学术差异化功能。

## 功能特性

### 核心内容
- **瀑布流 Feed** — CSS columns 布局 + 无限滚动 + 学科分类筛选
- **富文本编辑器** — TipTap 编辑器，支持图片、链接、代码块等
- **帖子详情** — TipTap JSON 渲染 + 图片画廊 + 作者信息
- **互动系统** — 点赞（乐观更新）、收藏、嵌套评论
- **用户主页** — 个人资料、帖子网格、收藏夹、关注系统
- **全文搜索** — 帖子 + 用户搜索，热门话题推荐

### 学术特色
- **LaTeX 公式** — KaTeX 渲染，行内 `$...$` 和块级 `$$...$$`，编辑器 + 评论 + 聊天全支持
- **论文引用系统** — DOI/arXiv 解析（Semantic Scholar + CrossRef），行内引用芯片 `[Author, Year]`
- **学科分类** — 12 个一级学科，带颜色标识的 SubjectBadge 组件
- **论文详情页** — 论文元数据展示，DOI 一键复制

### AI 辅助
- **AI 智能摘要** — GPT-4o-mini 流式输出，3-5 要点总结帖子核心内容
- **AI 学术翻译** — 保留 LaTeX 和引用格式的中英互译
- **智能推荐** — 基于兴趣和浏览历史的内容推荐

### 学术研讨室
- **实时聊天** — 消息列表、引用回复、乐观更新（轮询模拟，后续接入 Supabase Realtime）
- **LaTeX 聊天** — 聊天消息中直接输入和渲染数学公式
- **论文分享** — PAPER_SHARE 消息类型，展示论文元数据卡片
- **成员管理** — 成员列表、在线状态、角色权限（创建者/管理员/成员）
- **房间管理** — 创建研讨室、学科分类、公开/私密设置

### 基础设施
- **认证系统** — NextAuth v5，邮箱密码 + Google/GitHub OAuth
- **通知系统** — 应用内通知（评论、点赞、关注、研讨室消息、系统通知），未读计数，一键全部已读
- **响应式布局** — 桌面端导航栏 + 移动端底部导航
- **暗色模式** — 全局深色主题支持
- **Mock 数据** — 所有功能无需数据库即可运行开发

## 技术栈

| 层级 | 选型 | 版本 |
|------|------|------|
| 框架 | Next.js (App Router) | 16.2.2 |
| 语言 | TypeScript (strict) | 5.x |
| 样式 | Tailwind CSS | 4.x |
| UI 组件 | shadcn/ui (base-nova) | 4.x |
| 数据库 | PostgreSQL (Supabase) | — |
| ORM | Prisma | 7.x |
| 认证 | NextAuth.js v5 (Auth.js) | beta.30 |
| 富文本 | TipTap | 3.22.2 |
| LaTeX | KaTeX | 0.16.45 |
| 状态管理 | SWR | 2.4.1 |
| AI | OpenAI (GPT-4o-mini) | 6.33.0 |
| 图标 | Lucide React | 1.7.0 |

## 项目结构

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 认证路由组（无导航栏）
│   │   ├── login/page.tsx        # 登录页
│   │   └── register/page.tsx     # 注册页
│   ├── (main)/                   # 主应用路由组（有导航栏）
│   │   ├── feed/page.tsx         # 瀑布流首页
│   │   ├── feed/[category]/      # 学科分类 Feed
│   │   ├── post/[id]/page.tsx    # 帖子详情
│   │   ├── post/create/page.tsx  # 发布编辑器
│   │   ├── search/page.tsx       # 搜索页
│   │   ├── user/[username]/      # 用户主页 + 设置
│   │   ├── paper/[doi]/page.tsx  # 论文详情
│   │   └── rooms/                # 学术研讨室
│   │       ├── page.tsx          # 研讨室列表
│   │       └── [id]/page.tsx     # 聊天室
│   └── api/                      # API 路由（21 个端点）
│       ├── auth/                 # 认证（NextAuth + 注册）
│       ├── posts/                # 帖子 CRUD + 点赞/收藏/评论
│       ├── papers/               # 论文搜索 + DOI 解析
│       ├── rooms/                # 研讨室管理 + 消息
│       ├── notifications/        # 通知列表 + 标记已读
│       ├── search/               # 全文搜索
│       ├── users/                # 用户资料 + 关注
│       └── ai/                   # AI 摘要/翻译/推荐
├── components/                   # 按领域组织的组件
│   ├── ui/                       # shadcn/ui 基础组件（12个）
│   ├── layout/                   # Header, CategoryTabs, MobileNav, NotificationPanel
│   ├── feed/                     # MasonryGrid, PostCard, InfiniteScroll
│   ├── post/                     # ContentRenderer, PostActions, CommentSection, AIFeatures
│   ├── editor/                   # RichEditor, EditorToolbar, CitationPicker
│   ├── academic/                 # LatexRenderer, CitationCard, SubjectBadge
│   └── rooms/                    # RoomCard, ChatMessages, ChatInput, MemberList
├── lib/                          # 工具与配置
│   ├── mock-data.ts              # 帖子/评论 Mock 数据
│   ├── mock-rooms.ts             # 研讨室/消息 Mock 数据
│   ├── constants.ts              # 学科分类、站点配置
│   ├── auth.ts                   # NextAuth 配置
│   ├── prisma.ts                 # Prisma 客户端
│   ├── utils.ts                  # cn() 工具函数
│   └── tiptap-extensions/        # TipTap 自定义扩展
│       ├── math-inline.ts        # 行内公式节点
│       ├── math-block.ts         # 块级公式节点
│       └── *-view.tsx            # React NodeView 组件
├── services/                     # 业务逻辑层
│   ├── ai.service.ts             # OpenAI 流式摘要/翻译/推荐
│   └── paper.service.ts          # Semantic Scholar + CrossRef
└── types/index.ts                # 全局 TypeScript 类型定义
```

## 快速开始

### 环境要求

- Node.js 18+
- npm / pnpm / yarn

### 安装与启动

```bash
# 克隆项目
git clone <repo-url>
cd academic-xiaohongshu

# 安装依赖
npm install

# 启动开发服务器（无需数据库，自动使用 Mock 数据）
npm run dev
```

访问 http://localhost:3000 即可使用。

### 环境变量（可选）

创建 `.env.local` 文件配置以下变量。**所有变量均为可选**，未配置时系统自动降级到 Mock 数据：

```bash
# 数据库（Supabase PostgreSQL）
DATABASE_URL="postgresql://..."

# 认证
AUTH_SECRET="your-auth-secret"            # openssl rand -base64 32
AUTH_GOOGLE_ID="..."
AUTH_GOOGLE_SECRET="..."
AUTH_GITHUB_ID="..."
AUTH_GITHUB_SECRET="..."

# AI 功能
OPENAI_API_KEY="sk-..."                   # GPT-4o-mini 摘要/翻译/推荐

# 文件存储（Supabase Storage）
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
```

### 数据库配置（可选）

```bash
# 生成 Prisma Client
npm run db:generate

# 执行数据库迁移
npm run db:migrate

# 导入种子数据（学科分类）
npm run db:seed

# 打开 Prisma Studio 可视化管理
npm run db:studio
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/posts` | 帖子列表（分页、学科过滤） |
| `POST` | `/api/posts` | 创建帖子 |
| `GET` | `/api/posts/[id]` | 帖子详情 |
| `POST` | `/api/posts/[id]/like` | 点赞/取消点赞 |
| `POST` | `/api/posts/[id]/bookmark` | 收藏/取消收藏 |
| `GET/POST` | `/api/posts/[id]/comments` | 评论列表/发表评论 |
| `GET` | `/api/search` | 搜索帖子和用户 |
| `GET` | `/api/papers?doi=&arxiv=&q=` | 论文搜索/DOI解析 |
| `GET` | `/api/users/[username]` | 用户资料 |
| `GET` | `/api/users/[username]/posts` | 用户帖子列表 |
| `POST` | `/api/users/[username]/follow` | 关注/取关 |
| `POST` | `/api/ai/summarize` | AI 流式摘要 |
| `POST` | `/api/ai/translate` | AI 流式翻译 |
| `POST` | `/api/ai/recommend` | AI 推荐 |
| `GET/POST` | `/api/rooms` | 研讨室列表/创建 |
| `GET/POST` | `/api/rooms/[id]` | 研讨室详情/加入退出 |
| `GET/POST` | `/api/rooms/[id]/messages` | 消息列表/发送消息 |
| `GET/POST` | `/api/notifications` | 通知列表/标记已读 |

## 构建与部署

```bash
# 生产构建
npm run build

# 启动生产服务
npm start

# 代码检查
npm run lint
```

### 部署到 Vercel

项目完全兼容 Vercel 一键部署。设置环境变量后直接部署即可。

## 开发路线

- [x] **Phase 1** — 基础搭建（项目初始化、Prisma Schema、认证、应用骨架）
- [x] **Phase 2** — 核心内容（编辑器、瀑布流、互动系统、搜索）
- [x] **Phase 3** — 学术特色（LaTeX、论文引用、学科分类）
- [x] **Phase 4** — 高级功能（AI 辅助 + 学术研讨室 + 通知系统）
- [ ] **Next** — Supabase Realtime 实时消息、文件上传、性能优化、国际化

## 统计

- **115 个源文件** (TypeScript/TSX)
- **33 条路由** (12 页面 + 21 API)
- **12 个 shadcn/ui 组件**
- **7 大功能模块** (Feed / 编辑器 / 学术 / AI / 研讨室 / 通知 / 用户)

## License

MIT
