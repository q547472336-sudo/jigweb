# 拼图时光 V1 API 契约

版本：1.0，T03。HTTP 前缀 `/api/v1`；时间使用 ISO 8601 UTC，业务日由服务端按 Asia/Shanghai 计算。

## 1. 通用格式

成功：`{ "data": {}, "requestId": "req_123" }`

列表：`{ "data": { "items": [], "page": 1, "pageSize": 24, "hasMore": false, "total": 0 }, "requestId": "req_123" }`

错误：`{ "error": { "code": "PUZZLE_NOT_FOUND", "message": "作品不可用", "retryable": false, "field": null }, "requestId": "req_123" }`

写请求可带 `Idempotency-Key`；存档和房间请求带 `stateVersion`。冲突 409、未登录 401、无权 403、不可公开或不存在 404。

## 2. 认证和个人

| 方法 | 路径 | 认证 | 请求／说明 |
|---|---|---|---|
| POST | `/auth/otp/request` | 公开 | `{ email }`；返回 `expiresAt,resendAt`，不透露账户存在 |
| POST | `/auth/otp/verify` | 公开 | `{ email,code }`；返回 session/profile |
| GET | `/me` | 登录 | profile 与摘要统计 |
| PATCH | `/me` | 登录 | `{ displayName?,bio?,avatarUploadToken? }` |
| POST | `/me/email/change/request` | 登录 | `{ newEmail }`；向旧／新邮箱分别发送验证码 |
| POST | `/me/email/change/confirm` | 登录 | `{ oldCode,newCode }`；两边验证成功后更换 |
| POST | `/auth/signout` | 登录 | 撤销当前会话 |

OTP 为 6 位、10 分钟、60 秒重发；每邮箱每小时最多 5 次、每码最多 5 次错误。

## 3. 发现和存档

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| GET | `/puzzles` | 公开 | `q,category,pieces,sort,page,pageSize=24` |
| GET | `/puzzles/:id` | 公开／所有者 | 摘要、权限、普通 session；私有非所有者统一 404 |
| GET | `/categories` | 公开 | active 分类 |
| GET | `/collections/:type` | 公开 | `popular|featured|new` |
| POST/DELETE | `/puzzles/:id/favorite` | 登录 | 幂等收藏／取消 |
| GET | `/leaderboard` | 公开 | `date,page`，只读 |
| POST | `/sessions` | 游客／登录 | 创建普通 ready 局 |
| GET | `/sessions/:id` | 所有者 | 返回快照与版本 |
| PUT | `/sessions/:id` | 所有者 | 版本化快照；冲突 409 |
| POST | `/sessions/:id/complete` | 所有者 | 服务端验证全部 fixed，幂等完成 |
| POST | `/sessions/migrate` | 登录 | 返回 `same|cloud_missing|conflict`，冲突不覆盖 |
| GET | `/me/collections/:type` | 登录 | `works|favorites|completed|recent` |

`PuzzleSummary` 至少含 `id,title,imageUrl,aspectRatio,author,category,rows,columns,pieceCount,playCount,visibility,favorite,playState,progress`。游客普通快照只在 IndexedDB；登录迁移由同一接口处理。

## 4. 创建、资源、举报和通知

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| POST | `/uploads/sign` | 登录 | 文件元数据校验后返回短期上传 token |
| POST | `/puzzles` | 登录 | `Idempotency-Key`；图片 token、crop、文本、分类、行列、形状、可见性 |
| GET | `/puzzles/:id/assets/:kind` | 有权限 | 返回短期 signed URL |
| POST | `/reports` | 登录 | 24 小时重复返回既有受理号 |
| POST | `/feedback` | 登录 | 返回 ticketNo |
| GET | `/me/notifications` | 登录 | 每页 20，按时间倒序 |
| POST | `/me/notifications/:id/read` | 登录 | 只能标记本人 |
| POST | `/me/notifications/read-all` | 登录 | 幂等 |

允许图片类型和创建规则见 PRD D09。重复创建请求返回原作品 ID；失败码至少包括 `INVALID_IMAGE_TYPE`、`IMAGE_TOO_LARGE`、`IMAGE_DIMENSION_INVALID`、`UPLOAD_FAILED`、`CREATE_FAILED`。通知类型仅 `room_completed`、`feedback_updated`、`puzzle_unpublished`。

## 5. 挑战、房间和实时预留

挑战接口：`GET /challenge/today`、`POST /challenge/attempts`、`POST /challenge/attempts/:id/start`、`POST /challenge/attempts/:id/pause`、`POST /challenge/attempts/:id/complete`。服务端确认开始、暂停、完成与计时，不信任客户端时钟。

房间接口：`POST /rooms`、`POST /rooms/:id/join`、`POST /rooms/:id/start`、`POST /rooms/:id/pieces/:pieceId/lock`、`renew`、`release`、`POST /rooms/:id/events`。锁是 5 秒租约；事件携带 token 和版本。Realtime channel 为 `room:{roomId}`，只广播服务端确认的 snapshot、lock、move、fixed、presence、state 事件；广播不等于持久化成功。

错误码至少包括 `AUTH_REQUIRED`、`AUTH_INVALID`、`FORBIDDEN`、`NOT_FOUND`、`PUZZLE_UNAVAILABLE`、`VALIDATION_ERROR`、`VERSION_CONFLICT`、`IDEMPOTENCY_REPLAY`、`RATE_LIMITED`、`UPLOAD_FAILED`、`SAVE_FAILED`、`CHALLENGE_NOT_OPEN`、`CHALLENGE_EXPIRED`、`ROOM_FULL`、`ROOM_ENDED`、`LOCK_TAKEN`、`LOCK_EXPIRED`、`STALE_EVENT`、`INTERNAL_ERROR`。
