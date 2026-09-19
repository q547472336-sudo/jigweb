# 拼图时光 V1 路由与页面状态

版本 1.0。依据：[PRD V1.1](PRD_V1.1.md) 与 [PRD V1.0](PRD_V1.0.md)，冲突以 V1.1 为准。

## 全局约束

- 所有作品卡片直接进入 `/puzzle/:id`，不设作品详情页。
- 上传、裁剪、设置、预览和创建全部位于 `/create`，不设步骤子路由。
- 登录、暂停、退出、完成、建房、加房和错误使用弹窗或页内状态。
- 登录成功继续一次原动作；取消恢复原上下文。`returnTo` 仅接受站内白名单路径。
- `loading`、`empty`、`error` 互斥，错误不能显示成空数据。

## 路由清单

| 路由 | 页面与访问 | 状态 | 主要出口 |
|---|---|---|---|
| `/` | 首页；公开 | loading、ready、partial-error | 搜索、分类、集合、拼图、挑战、榜单、创建、我的 |
| `/search` | 搜索；公开 | empty-query、loading、results、no-results、error | 拼图、分类、首页 |
| `/category/:slug` | 分类；公开 | loading、results、empty、not-found、error | 分类切换、拼图、首页 |
| `/collections/:type` | 热门／推荐／新上架；公开 | loading、results、empty、not-found、error | 拼图、首页 |
| `/puzzle/:id` | 普通拼图；公开作品游客可玩 | loading、ready、active、paused、saving、save-error、completed、unavailable | 一起拼、收藏、再拼、返回 |
| `/challenge` | 游客练习／登录正式挑战 | unavailable、loading、ready、starting、active、pausing、paused、reconnecting、submitting、completed、invalid | 再挑战、榜单、首页 |
| `/leaderboard` | 挑战榜；公开 | loading、results、empty、error | 日期、挑战、首页 |
| `/create` | 单页创建；登录 | empty、editing、invalid、uploading、creating、create-error、success | 拼图、我的作品、离开确认 |
| `/room/:roomId` | 多人；登录 | joining、waiting、starting、active、reconnecting、completed、ended、full、not-found、forbidden | 开始、离开、普通拼图、新房 |
| `/me` | 我的概览；登录 | loading、ready、empty、error | 四列表、设置、通知、帮助 |
| `/me/works` | 我的作品；登录 | loading、results、empty、error | 创建、拼图、我的 |
| `/me/favorites` | 我的收藏；登录 | loading、results、empty、error | 发现、拼图、我的 |
| `/me/completed` | 我的完成；登录 | loading、results、empty、error | 拼图新局、我的 |
| `/me/recent` | 最近玩过；登录 | loading、results、empty、error | 拼图、我的 |
| `/me/settings` | 设置；登录 | loading、ready、saving、verify-email、success、error | 我的 |
| `/me/notifications` | 通知；登录 | loading、results、empty、error | 已读、关联内容、我的 |
| `/help` | 帮助公开、反馈需登录 | help、form、submitting、success、error | 登录、返回 |

搜索参数为 `q`、`category`、`pieces`、`sort`、`page`；分类为 `sort`、`pieces`、`page`；集合类型仅 `popular`、`featured`、`new`；榜单为 `date`、`page`。非法参数回退默认并从 URL 清理，未来榜单日期不可选。列表每页 24 项，`page=N` 表示已加载前 N 页，返回恢复条件与滚动位置。

## 弹窗和覆盖层

| 名称 | 成功 | 取消／失败 |
|---|---|---|
| LoginModal | 继续一次触发动作 | 留在原上下文；直达受限路由回可访问来源 |
| PauseModal | 继续普通局 | 退出进入确认 |
| ChallengePauseOverlay | 服务端确认继续后揭开 | 失败保持遮挡并重试 |
| ExitConfirmModal | 普通保存后退出；挑战暂停退出或放弃 | 继续当前局 |
| PuzzleCompletedModal | 再拼／收藏／发现 | 关闭仍为完成态 |
| ChallengeCompletedModal | 再挑战／榜单 | 提交失败保留重试 |
| CreateRoomModal | 保存快照并进入房间 | 保留普通局 |
| JoinRoomModal | 进入等待房 | 保留来源，区分不存在／满／结束 |
| CreateSuccessModal | 拼图／我的作品／公开链接 | 保持成功态，不重复提交 |
| SaveConflictModal | 用户选择一份存档 | 选择前保留两份 |
| ReportModal | 返回受理号 | 保留当前页 |

## 关键路径

1. 首页、搜索、分类、集合、个人列表 → 卡片 → 普通拼图。
2. 已完成卡片 → ready → 首次有效拖动 → 新 active 局。
3. 普通 active → 一起拼 → 登录（如需）→ 保存 → 等待 → 房主开始 → 多人完成。
4. 首页挑战 → 游客练习或登录正式 → 首次有效拖动 → 计时 → 结算 → 榜单。
5. 创建 → 登录 → 同页编辑与预览 → 成功 → 拼图或我的作品。

## T01 路由验收

- AC01～AC06、AC19、AC25～AC31 与 A01～A04 均可映射。
- 刷新可恢复列表条件、榜单日期和房间地址；敏感权限由服务端重验。
- 404、下线、私有越权、房间结束均有返回出口。
- 不出现 `/puzzle/:id/detail` 或创建步骤子路由。
