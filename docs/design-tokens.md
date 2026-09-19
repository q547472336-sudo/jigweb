# 拼图时光 V1 Design Tokens

版本 1.0，T02。设计读取：桌面内容发现与在线拼图产品，轻盈、现代、蓝白，参考 Apple/Cursor 的克制层次与 Unsplash 的发现导航。参数：`DESIGN_VARIANCE 5`、`MOTION_INTENSITY 3`、`VISUAL_DENSITY 5`。

## 1. 基础原则

- V1 使用单一浅色主题，避免页面间切换深浅主题。
- 钴蓝是唯一品牌强调色；错误、警告、成功颜色仅承担语义，不作装饰。
- 使用冷灰中性色，不采用米黄、木纹、紫蓝光晕和大面积玻璃效果。
- 卡片只用于需要独立点击、浮层或明显层级的内容。普通分组优先使用留白和细分隔线。
- 正文和控件达到 WCAG AA；焦点不能只靠颜色表达。

## 2. 色彩

| Token | 值 | 用途 |
|---|---:|---|
| `color.canvas` | `#F7F9FC` | 页面背景 |
| `color.surface` | `#FFFFFF` | 卡片、弹窗、输入框 |
| `color.surface.subtle` | `#F0F4FA` | 次级区域、托盘底色 |
| `color.surface.strong` | `#E7EDF6` | 选中前的悬停与分隔层 |
| `color.text.primary` | `#172033` | 标题与正文主色 |
| `color.text.secondary` | `#5B667A` | 描述与元信息 |
| `color.text.tertiary` | `#7E899C` | 占位和辅助文字 |
| `color.border` | `#DCE3ED` | 普通边框 |
| `color.border.strong` | `#C3CDDB` | 强分隔和控件边界 |
| `color.brand` | `#2563EB` | 主按钮、链接、焦点 |
| `color.brand.hover` | `#1D4ED8` | 主交互悬停 |
| `color.brand.active` | `#1E40AF` | 主交互按下 |
| `color.brand.subtle` | `#EAF1FF` | 选中背景、轻提示 |
| `color.brand.border` | `#BFD0FF` | 选中边界 |
| `color.success` | `#16845B` | 成功状态 |
| `color.success.subtle` | `#E8F7F0` | 成功背景 |
| `color.warning` | `#A55B0A` | 警告状态 |
| `color.warning.subtle` | `#FFF4DF` | 警告背景 |
| `color.danger` | `#C43C4D` | 错误和破坏性操作 |
| `color.danger.subtle` | `#FDECEF` | 错误背景 |
| `color.overlay` | `rgba(23,32,51,.48)` | 弹窗遮罩 |
| `color.game.canvas` | `#EDF2F8` | 中央拼图工作区 |
| `color.game.grid` | `rgba(91,102,122,.16)` | 底版与定位辅助 |
| `color.game.lock` | `#F59E0B` | 多人占用语义 |

文本对比基线：主正文在白色上高于 12:1，次级文本高于 5:1；白色主按钮文字与 `color.brand` 的对比约 5.2:1。实际实现仍需用自动化对比检查复核。

## 3. 字体

优先字体：`Geist Sans`，中文回退为 `PingFang SC`, `Microsoft YaHei`, `Noto Sans CJK SC`, system-ui, sans-serif。代码、房间号和计时使用 `Geist Mono`，中文仍回退系统无衬线。字体由框架自带机制或自托管加载，不能依赖页面外链字体。

| Token | 字号／行高／字重 | 用途 |
|---|---|---|
| `type.display` | 48/56, 650 | 首页主标题，最多两行 |
| `type.h1` | 32/40, 650 | 页面标题 |
| `type.h2` | 24/32, 650 | 区块标题 |
| `type.h3` | 18/26, 600 | 卡片标题、弹窗标题 |
| `type.body` | 16/24, 400 | 正文和主要输入 |
| `type.body.strong` | 16/24, 600 | 重点正文 |
| `type.small` | 14/20, 400 | 元信息、筛选器 |
| `type.caption` | 12/18, 500 | 状态和辅助标签 |
| `type.timer` | 28/32, 600, tabular | 挑战计时 |

标题字距 `-0.02em`，正文正常字距；计时和数字统计启用等宽数字。不可用全大写微标签制造装饰层次。

## 4. 间距与尺寸

基础间距为 4px：`space.1=4`、`2=8`、`3=12`、`4=16`、`5=20`、`6=24`、`8=32`、`10=40`、`12=48`、`16=64`。

| Token | 值 | 说明 |
|---|---:|---|
| `layout.max` | 1440px | 普通内容最大宽度 |
| `layout.gutter` | 32px | 1280px 以上水平页边距 |
| `layout.gutter.compact` | 20px | 1024 至 1279px |
| `header.primary` | 64px | 第一行 Header |
| `header.categories` | 44px | 第二行分类导航 |
| `header.game` | 56px | 游戏页紧凑顶栏 |
| `control.sm` | 32px | 紧凑图标和筛选器 |
| `control.md` | 40px | 常规按钮与输入 |
| `control.lg` | 48px | 核心 CTA |
| `touch.minimum` | 40px | 桌面产品最小点击目标 |
| `sidebar.home` | 320px | 首页侧栏建议宽度 |
| `sidebar.me` | 232px | 我的导航建议宽度 |
| `game.tray.min` | 176px | 单侧托盘最小宽度 |
| `game.tray.max` | 256px | 单侧托盘最大宽度 |

## 5. 形状、边框和阴影

形状规则：输入和普通按钮 10px，内容卡片与面板 14px，弹窗 18px，圆形图标按钮为完全圆形。按钮高度与圆角组合保持一致，不使用到处都是胶囊形状。

| Token | 值 |
|---|---|
| `radius.control` | 10px |
| `radius.card` | 14px |
| `radius.modal` | 18px |
| `border.default` | 1px solid `color.border` |
| `shadow.card` | `0 8px 24px rgba(40,65,105,.08)` |
| `shadow.float` | `0 16px 48px rgba(40,65,105,.16)` |
| `shadow.focus` | `0 0 0 3px rgba(37,99,235,.28)` |

普通卡片默认不依赖阴影，使用白色表面和边界。悬停才增加轻微 `shadow.card`。浮动原图、底部工具栏和弹窗使用 `shadow.float`。

## 6. 动效

| Token | 值 | 用途 |
|---|---:|---|
| `motion.fast` | 120ms | 按下、焦点、图标 |
| `motion.base` | 180ms | 悬停、展开、筛选 |
| `motion.modal` | 220ms | 弹窗和覆盖层 |
| `ease.standard` | cubic-bezier(.2,.8,.2,1) | 常规状态变化 |
| `ease.exit` | cubic-bezier(.4,0,1,1) | 离开 |

动效只表达反馈和层级。按钮按下缩放到 0.98；卡片最多上移 2px。原图折叠、弹窗和列表加载有短过渡。遵守 `prefers-reduced-motion` 时取消位移、缩放和自动滚动，仅保留即时透明度变化。

## 7. 图标与图片

使用单一 Phosphor 图标家族，默认 `20px`、`weight=regular`；游戏关键动作可用 `22px`。每个纯图标按钮有可访问名称和 tooltip。不得手绘 SVG 图标路径或混用图标家族。

作品图使用真实图片槽位，保留原图比例和裁剪预览。卡片图片采用当前作品裁剪比例，不把所有卡片强制成 1:1。加载骨架与最终图片比例一致，避免布局跳动。

## 8. 层级和焦点

| 层 | z-index |
|---|---:|
| 页面内容 | 0 |
| 吸顶 Header | 20 |
| 游戏工具和原图浮窗 | 30 |
| Toast | 50 |
| 遮罩 | 60 |
| 弹窗 | 70 |
| Tooltip | 80 |

焦点环使用 `shadow.focus`，并保留可识别边框。弹窗打开后焦点进入标题或首个控件，关闭后返回触发点。挑战暂停遮罩覆盖画布、托盘、原图和游戏工具，但保留继续、退出所需控件。

## 9. 响应策略

V1 桌面验证宽度为 1280、1440、1920。1024 至 1279 采用紧凑间距和 176px 托盘，不删除功能。低于 1024 继续使用紧凑布局，不再显示额外的浏览器宽度提示；移动专属拼图布局不属于 V1。

不得使用固定 `h-screen` 造成浏览器栏变化跳动；需要整屏工作区时使用 `100dvh` 减去 Header。滚动区域必须清楚区分页面滚动、左右托盘滚动和中央画布平移。

## 10. 实现前检查

- 单一浅色主题、单一蓝色品牌强调、统一圆角和图标家族。
- 所有按钮、表单、卡片具有 default、hover、active、focus-visible、disabled，异步动作另有 loading。
- 每个页面具备对应 loading、empty、error，不用通用转圈替代内容骨架。
- 关键 CTA 在 1280×720 下可见且不换行。
- 所有动效可说明反馈目的，并提供 reduced-motion 行为。
- 首页可以较舒展，游戏、创建和我的保持产品界面密度，不套营销页面区块模板。
