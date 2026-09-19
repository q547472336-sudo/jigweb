# 拼图时光 V1 技术架构

版本：1.0，T03。依据：PRD V1.1、routes.md、interaction-rules.md、ui-spec.md。

## 1. 架构决策

V1 采用 Next.js 16 + TypeScript 的桌面 Web 应用，使用 App Router、Server Components 和 Route Handlers；目标数据层采用 Supabase PostgreSQL，文件使用 Supabase Storage，登录使用 Supabase Auth 的邮箱 OTP。拼图画布使用 Canvas/SVG 适配层，拼块生成、吸附、进度计算放在可测试的纯 TypeScript 模块。

M2 开发候选先使用 `lib/server/local-store.ts` 的单进程内存适配器验证 HTTP 契约；它不具备持久化与生产安全性。下一步用 Supabase CLI 启动数据库、Storage 和 Auth，并保持页面只依赖既有 API。生产权限必须在服务端和数据库 RLS 双重校验，前端隐藏按钮不作为安全边界。

后续多人实时能力使用 Supabase Realtime Broadcast/Presence 传输低延迟事件，PostgreSQL RPC 或事务函数作为房间状态、碎片锁和最终快照的权威写入口。Realtime 只负责传输，不直接决定谁获得锁。

## 2. 分层与目录边界

```text
jigsaw-web/
├─ app/                       # 路由、页面和 Route Handlers
├─ components/                # 页面组合与交互组件
├─ features/                  # discovery、game、auth、creation、personal、room
├─ lib/
│  ├─ domain/                 # 拼图、状态机、校验、排序等纯逻辑
│  ├─ server/                 # 服务端客户端、权限、事务和服务
│  ├─ client/                 # 浏览器存储、实时连接、请求适配器
│  └─ config/                 # 公开配置和规则版本
├─ public/                    # 非私有静态资源
├─ supabase/                  # migrations、functions、seed
├─ docs/                      # 产品、UI、架构与契约
└─ tasks/                     # 研发路线
```

前端负责页面、表单、画布输入和本地状态；领域层负责拼图算法与状态转换；后端负责会话、权限、图片、列表查询、存档版本、幂等写入和未来的权威计时／锁。页面不能直接读数据库，画布不能直接发网络写入。

## 3. 数据流与安全边界

公开发现由 Server Component 首次取列表，客户端通过 API 加载更多。普通拼图由纯逻辑处理拖动，松手先写 IndexedDB，登录用户再提交版本化快照。创建先获得短期上传 token，上传后由服务端校验元数据并创建作品。

挑战的开始、暂停、完成和计时事件由服务端确认；多人先由 PostgreSQL 原子函数获取锁，再通过 Realtime 广播确认事件。浏览器只持有 anon key，service role key 仅服务端环境变量。私有图片使用 RLS 与短期 signed URL；所有所有权、版本和状态在服务端重读。

写操作使用幂等键或版本号；OTP、创建、结算、房间位置更新不能只依赖客户端。日志不记录验证码、令牌、原图 URL 或完整存档。

## 4. 本地与生产

当前开发候选只需要 Node.js 与包管理器，OTP 默认码为 `000000`，服务重启会清空内存数据。接入阶段需要 Supabase CLI；`supabase start` 提供本地 Postgres、Auth、Storage。没有真实邮件服务时使用本地邮件捕获器，不伪造生产发送成功。生产需要迁移、Storage bucket 权限、邮件域名、站点 URL、RLS 审计、定时清理和错误监控。

## 5. M2 顺序

1. migration 与 seed：用户、作品、分类、公开查询、收藏、完成、最近记录。
2. Auth：邮箱 OTP、会话、受限路由、账号设置。
3. Storage：公开缩略图与私有资源授权。
4. Save：IndexedDB、本地优先同步、版本冲突选择。
5. Creation：裁剪、配置、预览、幂等创建。
6. Personal：概览、四列表、空态、通知、反馈。

挑战和多人依赖同一作品版本、用户、存档与权限基础，但不在 M2 实现业务。本架构为其预留权威写入口。
