# ADR-0001：V1 Web 平台与后端基础设施

状态：Accepted（T03）。日期：2026-09-12。

## 背景

产品需要桌面 Web、游客普通拼图、邮箱 OTP、私有图片、版本化存档、单页创建，并为后续挑战权威计时和多人碎片锁提供服务端能力。旧的 Expo 原型不作为本项目基线；当前唯一工作目录是 `jigsaw-web`。

## 决策

采用 Next.js 16 + TypeScript + App Router；Supabase PostgreSQL 作为数据库，Supabase Auth 处理邮箱 OTP，Supabase Storage 保存图片，以 SQL migration、RLS、RPC 约束数据和权限。拼图引擎为纯 TypeScript，与 React 页面和网络适配器分离。

M2 按 HTTP API、IndexedDB 和 Mock 优先实现；挑战和多人使用数据库权威写入口，Realtime 只做分发。供应商 SDK 封装在 `lib/server`，页面不能直接依赖。

## 原因

一套基础设施覆盖认证、数据库、对象存储和未来实时能力；Supabase CLI 可提供可重复的本地环境；PostgreSQL 事务／RPC 可承载版本检查、幂等写入和锁竞争；RLS 为私有作品与个人数据提供数据库级防线。

## 取舍与验证

方案依赖 Supabase 本地工具和生产服务；业务层保持 API 与领域逻辑独立，未来可替换适配器。后续必须验证：本地迁移与 seed、RLS 越权、重复幂等键、过期版本 409、并发锁单胜、服务端计时。当前 ADR 不宣称这些验证已经完成，也不创建真实凭据或购买服务。
