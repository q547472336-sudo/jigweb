# 拼图时光 V1 数据模型

版本：1.0，T03。目标数据库为 PostgreSQL；字段使用 snake_case，API 适配为 camelCase。

## 1. M2 表

| 表 | 关键字段 | 约束 |
|---|---|---|
| `profiles` | `id`、`display_name`、`avatar_path`、`bio`、timestamps | id 对应 auth user；昵称 1～30，简介 ≤200 |
| `puzzles` | `id`、`owner_id`、`title`、`description`、`visibility`、`status`、`category_id`、`rows`、`columns`、`shape`、`version` | public/private；片数 9～500 |
| `puzzle_assets` | `puzzle_id`、`kind`、`storage_path`、`mime_type`、`width`、`height`、`bytes` | original/cropped/game/thumbnail；作品版本和类型唯一 |
| `categories` | `id`、`slug`、`name`、`sort_order`、`active` | slug 唯一；公共查询只取 active |
| `puzzle_curation` | `puzzle_id`、`collection`、`position`、`active` | popular/featured/new；位置唯一 |
| `favorites` | `user_id`、`puzzle_id`、`created_at` | `(user_id,puzzle_id)` 主键 |
| `play_sessions` | `id`、`user_id` nullable、`guest_id` nullable、`puzzle_id`、`puzzle_version`、`mode`、`status`、`snapshot`、`state_version`、timestamps | user/guest 二选一；普通局每身份每作品一个 active |
| `completion_records` | `user_id`、`puzzle_id`、`first_completed_at`、`last_completed_at`、`source` | `(user_id,puzzle_id)` 主键，完成列表去重 |
| `recent_plays` | `user_id`、`puzzle_id`、`last_played_at`、`last_mode`、`session_id` | `(user_id,puzzle_id)` 主键 |
| `notifications` | `id`、`user_id`、`type`、`subject_id`、`read_at`、`payload`、`created_at` | 仅 V1 三类事件；只能读本人 |
| `reports` | `id`、`reporter_id`、`puzzle_id`、`category`、`description`、`dedupe_key`、`status` | 同用户同作品 24 小时去重 |
| `feedback` | `id`、`user_id`、`type`、`description`、`status`、`ticket_no` | 描述 1～1000；ticket 唯一 |

## 2. 预留挑战与多人表

| 表 | 关键字段 | 约束 |
|---|---|---|
| `daily_challenges` | `id`、`business_date`、`timezone`、`puzzle_id`、`puzzle_version`、`rows`、`columns`、`shape`、`seed`、`rule_version`、`status` | 业务日唯一；生效后不可变 |
| `challenge_attempts` | `id`、`challenge_id`、`user_id`、`status`、`started_at`、`completed_at`、`paused_ms`、`elapsed_ms`、`event_cursor` | 每用户每天一个 active；服务端计时 |
| `challenge_bests` | `challenge_id`、`user_id`、`attempt_id`、`elapsed_ms`、`completed_at` | `(challenge_id,user_id)` 主键；只接受更优成绩 |
| `rooms` | `id`、`owner_id`、`puzzle_id`、`source_session_id`、`snapshot`、`state_version`、`status`、`expires_at`、`started_at` | 2～4 人；来源局独立副本 |
| `room_members` | `room_id`、`user_id`、`role`、`joined_at`、`left_at`、`participated_at`、`last_seen_at` | `(room_id,user_id)` 主键 |
| `piece_locks` | `room_id`、`piece_id`、`user_id`、`lease_token`、`expires_at`、`version` | `(room_id,piece_id)` 主键；服务端原子获取 |
| `room_piece_events` | `id`、`room_id`、`piece_id`、`user_id`、`event_type`、`payload`、`version`、`created_at` | 版本单调递增；旧版本拒绝 |

## 3. JSON、权限和索引

`snapshot` 至少包含 `pieces: [{ id, tray, x, y, fixed }]`、`puzzle_version` 和 `state_version`；相机、原图位置属于本地视图。客户端不能上传目标坐标。

公共查询只返回 `published + public` 作品；私有作品只允许所有者读取，使用短期 signed URL。用户只能读写自己的存档、收藏、完成、最近、通知、反馈和举报；维护角色才可下线和维护推荐。房间位置必须经过成员、租约和版本检查。

为公共作品分类／时间、标题搜索、作者昵称、最近游玩、通知、挑战最佳和房间过期建立索引。下线采用软删除，撤销公共索引与资源访问后再清理。作品请求 ID、挑战 attempt ID、房间 state_version 和限流键必须可重放或唯一。迁移文件是唯一 schema 来源。
