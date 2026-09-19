# 拼图时光 V1 UI 与组件规范

版本 1.0，T02。依据：[PRD V1.1](PRD_V1.1.md)、[routes](routes.md)、[interaction rules](interaction-rules.md) 和 [design tokens](design-tokens.md)。本文件定义前端可实现的页面布局、组件状态和 Mock 契约，不修改产品规则。

## 1. 设计方向

设计读取：面向桌面用户的内容发现与在线拼图产品，视觉轻盈、现代、蓝白，参考 Apple/Cursor 的克制层次和 Unsplash 的发现导航。

- `DESIGN_VARIANCE 5`：内容页允许非对称主栏和侧栏，产品操作区保持稳定。
- `MOTION_INTENSITY 3`：动效用于按下、弹窗、展开和保存反馈，不使用循环装饰动画。
- `VISUAL_DENSITY 5`：首页留白较多，游戏、创建和个人区提高密度。
- 基础系统：可访问的 Radix primitives 与项目自有组件层，样式使用 design tokens。若 T03 选定其他前端基础，必须保持本文件状态与视觉契约。
- V1 为浅色主题。Apple/Cursor 只作为布局与层级参考，不声称使用官方 Apple 网页设计系统。

## 2. 全局框架

### 2.1 内容 Header

第一行 64px：左侧品牌字标“拼图时光”，中间弹性搜索框，右侧“创建作品”“我的”和登录／头像。最大内容宽 1440px。创建作品使用主色实心按钮；其他导航为文字或轻按钮。登录后头像菜单含我的主页、设置、退出。

第二行 44px：精选、风景、艺术、动物、插画、建筑、日常、美食、人物、节日、其他。可水平滚动但桌面优先完整展示；当前分类以品牌色文字和 2px 下划线表示，不使用一排胶囊。

游戏页改用 56px 紧凑顶栏，内容 Header 不叠加出现。左侧返回和作品名，中间进度／挑战计时，右侧保存状态、暂停、一起拼。私有作品隐藏一起拼。

### 2.2 页面容器

- 发现页：`max 1440px`，主栏 `minmax(0,1fr)`，侧栏 320px，间距 32px。
- 搜索／分类／集合：单主栏，卡片 4 列；1280 下仍保持 4 列，间距收紧。
- 我的：232px 固定导航加弹性主栏，间距 32px。
- 创建：左侧编辑表单 440px，右侧粘性预览；1280 下右侧至少 560px。
- 游戏：整页工作区高度为 `100dvh - 56px`，两侧托盘 176 至 256px，中间画布最少 640px。

## 3. 核心组件

### 3.1 Button

变体：primary、secondary、ghost、danger、icon。高度 40px，核心 CTA 48px，紧凑工具 36px。状态：default、hover、active、focus-visible、disabled、loading。loading 保持按钮宽度，显示小型进度图标与动词，如“创建中”。破坏性动作不能用品牌蓝伪装。

### 3.2 PuzzleCard

结构：比例稳定的作品图、作品名、作者、片数、去重游玩人数；右上收藏按钮。我的作品卡替换作者为创建时间和可见性。

主状态互斥：

| 状态 | 图上反馈 | 元信息 | 点击 |
|---|---|---|---|
| 未开始 | 无覆盖 | 片数、人数 | 普通 ready |
| 进行中 | 底部细进度条和百分比 | “进行中” | 恢复普通 active |
| 已完成 | 右下完成图标和文字 | “已完成” | 普通 ready，新拖动后开新局 |

收藏、hover、focus、loading、unavailable 可叠加。不可访问卡片不继续渲染私有缩略图。收藏点击阻止卡片导航；失败回滚并在卡片附近提示。

### 3.3 FilterBar

搜索结果显示搜索词和结果数，筛选为分类、片数、排序。原生语义按钮触发 Popover 或 Select，当前条件以文字呈现。清空筛选只在有筛选时出现。加载更多失败保留旧卡片并在列表尾部重试。

### 3.4 状态组件

- Skeleton：匹配最终卡片、榜单和表单布局。
- EmptyState：标题、原因、一项主动作和可选次动作。
- InlineError：靠近失败区域，包含重试。
- Toast：只用于短暂确认，不承载需要决策的错误。
- Modal：最大宽 480px；冲突选择 640px；标题、正文、动作顺序稳定。
- StatusBadge：仅表达保存、可见性、成员在线和模式，不作装饰。

### 3.5 登录与账户

LoginModal 两步：邮箱输入、验证码输入。验证码页显示掩码邮箱、重发倒计时和更换邮箱。错误就近显示；不出现“邮箱不存在”。关闭恢复触发点。设置页资料区、邮箱区分组，不显示社交绑定占位按钮。

### 3.6 SaveStatus 与 SaveConflictModal

保存状态用图标加文字：已保存到本机、同步中、已同步、同步失败。失败可点击查看详情和重试。冲突弹窗左右比较本机和云端的进度、更新时间、设备描述，每项提供“继续此版本”；选择前不提供模糊的默认主按钮。

## 4. 页面规范

### 4.1 首页 `/`

Hero 使用左文右图的非对称结构，控制在首屏内：一个标题、一句说明、一个搜索主动作和今日挑战次入口。右侧使用真实拼图图片，不使用紫蓝渐变或伪产品截图。

Hero 后为热门、编辑推荐、新上架，每区 8 张卡片，桌面 4 列两行；区头为标题和“查看全部”。右侧栏顶部今日挑战卡，中部今日榜前 5，底部创建入口。侧栏卡片只在有独立交互时使用，避免每段都包卡。

状态：整页骨架；某一区加载失败时其他区域仍可用并局部重试；挑战缺题显示未开放；榜单为空显示“还没有完成者”。

### 4.2 搜索、分类和集合

共用 `PuzzleListingPage`。搜索页标题显示关键词；分类页显示分类名和简短说明；集合页显示热门／编辑推荐／新上架。FilterBar 后为 4 列卡片和加载更多。无结果提供修改关键词、清除筛选和浏览分类。不存在的分类／集合进入专用 not-found，不复用空结果。

### 4.3 普通拼图 `/puzzle/:id`

顶栏以下为三栏：左托盘、中央工作区、右托盘。两托盘各自滚动，碎片默认整齐排列；边框筛选后未匹配片隐藏但位置状态不变。中央画布背景与页面区分，缩放和复位控件放右下，不与底部工具冲突。

原图浮窗默认右上，宽 220px，可拖动、折叠、复位。底部工具栏居中悬浮，含打乱、边框、提示、底版。工具均显示 tooltip 和选择状态，不出现分色工具。

拖动反馈：抓取片提高 2px 视觉层级并显示柔和边缘；正确范围内用目标格轻高亮，松手后短促吸附；错误松手不抖动。键盘抓取时顶栏下方出现简短操作说明，并用 aria-live 反馈位置与固定结果。

ready 不显示“进行中”；首次有效拖动后 SaveStatus 出现。暂停覆盖交互工作区并显示进度、继续和退出。完成弹窗展示作品图、完成反馈、再拼、返回发现和收藏。

### 4.4 创建 `/create`

左侧分组为图片、构图、作品信息、拼图设置、可见性。所有内容在同一路由；使用折叠分组可以管理密度，但不是跨页步骤器。右侧粘性预览同时展示裁剪成品和迷你拼图片数效果。

上传区支持点击选择与拖入，列出 JPEG／PNG／静态 WebP、10MB 和最小尺寸。错误就近显示。裁剪器提供五种比例、缩放滑杆、复位；切图时确认清除旧裁剪。自定义片数使用行列两个数字输入并实时显示乘积与范围。

创建按钮仅在当前表单有效时启用。提交中锁定重复动作；失败保留表单。成功弹窗：开始拼图、我的作品，公开时附复制链接；不能出现详情页 CTA。

### 4.5 我的主页和子页

左栏为概览、我的作品、收藏、完成、最近、通知、设置、帮助。概览主区依次为个人资料摘要、三项统计、最近玩过横向 4 张、四个快捷入口、最近 3 条真实通知。控制为概览，不复制完整列表。

四个列表共用卡片网格和排序；我的作品显示可见性；收藏空态去发现；完成列表按作品去重；最近列表显示模式和最近游玩时间。通知页使用时间分组列表，每页 20 条，未读以背景和文字共同表达。设置页采用清楚的表单分组。

### 4.6 今日挑战和榜单

复用游戏布局，但顶栏中心显示正计时，左侧明确“练习，不计榜”或“今日挑战”。没有打乱、边框、提示、底版和一起拼。原图浮窗可用。

starting 时碎片保持原位并禁用；暂停／失焦覆盖画布、托盘和原图。断网覆盖显示“正在重连，计时继续”。另一个标签页已有正式局时显示只读占用页。跨日、缺题、下线各有独立说明。

完成弹窗依次显示本次成绩、今日最佳、当前排名、再挑战、查看榜单。榜单页含日期切换、前 3 的轻强调、标准名次列表和粘性“我的排名”条；不把全部行做成独立卡片。

### 4.7 多人房间

等待页显示作品预览、房间号、复制链接、2 至 4 个成员席位、截止时间和房主开始按钮。非房主看到“等待房主开始”。房主掉线倒计时和转移结果以状态条表达。

进行中复用普通游戏布局；顶栏显示成员头像、共享进度和连接状态。被占碎片用橙色边界、成员头像和“某某正在拖动”表达，颜色之外必须有文字／图标。没有全房暂停和打乱。

重连覆盖只禁止棋盘操作，说明正在同步最新状态。房间结束按原因给回普通拼图或创建新房。完成结果区显示实际参与成员，不暗示观看者获得完成记录。

### 4.8 帮助、反馈和举报

帮助页为可搜索的分区内容和反馈入口。反馈登录后在同页打开表单；成功显示受理号。举报在卡片或拼图菜单弹窗中完成，类别单选、描述必填；重复举报返回已有受理号，不显示内部处理信息。

## 5. 组件边界

| 组件域 | 主要组件 | 数据责任 |
|---|---|---|
| Shell | ContentHeader、CategoryNav、GameHeader、MeSidebar | 会话、导航状态 |
| Discovery | HeroSearch、PuzzleSection、PuzzleGrid、PuzzleCard、FilterBar、LeaderboardSummary | 列表查询与分页 |
| Game | PuzzleWorkspace、PieceTray、PuzzleCanvas、ReferenceImage、GameDock、SaveStatus | 引擎状态、本地视图 |
| Auth | LoginModal、VerificationForm、ProfileForm、EmailChangeFlow | 会话和验证接口 |
| Creation | UploadField、CropEditor、PuzzleSettings、CreationPreview、CreateSuccessModal | 本地草稿与创建接口 |
| Personal | ProfileSummary、StatsRow、PersonalList、NotificationList、SaveConflictModal | 用户数据接口 |
| Challenge | ChallengeHeader、ChallengeOverlay、ChallengeResult、LeaderboardTable | 权威挑战接口 |
| Room | RoomLobby、MemberStrip、PieceLockIndicator、ReconnectOverlay、RoomResult | 实时房间接口 |
| Feedback | EmptyState、InlineError、Toast、ConfirmModal、Skeleton | 通用 UI 状态 |

PuzzleCanvas 只处理渲染、指针／键盘输入和画布坐标；拼块生成、吸附判断和状态转换放在可测试的纯逻辑模块。网络保存、挑战和房间适配器不直接写画布内部状态，而通过统一 action 进入游戏状态机。

## 6. Mock 契约

T03 接口尚未落盘时，前端以以下最小字段开发，最终以 `api-contracts.md` 为准。字段差异通过适配层处理，不在页面散落临时判断。

```ts
type PuzzleSummary = {
  id: string;
  title: string;
  imageUrl: string;
  aspectRatio: number;
  author: { id: string; name: string; avatarUrl?: string };
  category: string;
  rows: number;
  columns: number;
  pieceCount: number;
  playCount: number;
  visibility: "public" | "private";
  favorite: boolean;
  playState: "not_started" | "in_progress" | "completed";
  progress?: number;
};

type PageResult<T> = {
  items: T[];
  page: number;
  pageSize: 24;
  hasMore: boolean;
  total: number;
};

type PuzzleSnapshot = {
  sessionId: string;
  puzzleId: string;
  version: number;
  status: "ready" | "active" | "paused" | "completed";
  pieces: Array<{
    id: string;
    tray: "left" | "right" | "board";
    x: number;
    y: number;
    fixed: boolean;
  }>;
  updatedAt: string;
};

type ApiState<T> =
  | { status: "idle" | "loading" }
  | { status: "success"; data: T }
  | { status: "empty" }
  | { status: "error"; code: string; message: string; retryable: boolean };
```

前端 Mock 必须包含成功、空、慢请求、权限失败、资源下线、保存冲突和重复提交场景。Mock 图片使用项目内明确授权的测试资源或可替换色块槽位；正式页面交付前换成真实可用图片。

## 7. 无障碍和键盘

- Header、分类、侧栏和弹窗使用正确 landmark；页面只有一个 H1。
- 卡片主链接与收藏按钮分别可聚焦，避免嵌套交互元素。
- 拖放同时提供 D12 键盘流程；aria-live 只播报关键抓取、移动、放下、固定结果。
- 计时视觉每帧更新时，不让读屏每帧朗读；提供可按需读取的文本。
- 弹窗焦点闭环，关闭回触发点；暂停覆盖后焦点进入继续按钮。
- 保存、错误、完成和成员锁定不只用颜色表达。

## 8. T02 验收结果

- 已覆盖 routes.md 中全部页面、弹窗和关键状态。
- PuzzleCard 已定义三种互斥主状态以及收藏、加载、不可访问叠加状态。
- 1280×720 的游戏布局保留双托盘、中央画布、原图和底部工具；创建页仍是单路由。
- 登录、暂停、空态、重连和存档选择均有可实现的 UI。
- 已列出后续前端组件边界和 Mock 契约，未选择后端服务或修改 PRD。
- 视觉只能依据文字基线审阅；没有可定位的最终视觉源，因此不宣称像素级还原。
