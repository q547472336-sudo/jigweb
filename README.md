# 拼图时光 · jigsaw-web

桌面端在线拼图网站。当前阶段：M2 本地开发候选、M3～M4 本地协作实现已完成，正在推进 M5/T21 功能与权限回归；生产后端、Realtime 和最终画布仍待接入，详见 [当前开发状态](docs/qa/functional-report.md)。

## 文档

- [PRD V1.1](docs/PRD_V1.1.md)：当前执行入口，补全玩法、权限、存档、内容供应及验收规则。
- [研发任务](tasks/roadmap.md)：23 项任务、阶段门槛、依赖与验收。
- [路由与页面状态](docs/routes.md)：T01 路由、权限、弹窗和典型跳转。
- [交互规则](docs/interaction-rules.md)：T01 各模式状态、成功／失败和恢复语义。
- [技术架构](docs/architecture.md)：T03 平台、分层、安全边界和 M2 实施顺序。
- [数据模型](docs/data-model.md)：T03 实体、约束、权限和未来挑战／房间表。
- [API 契约](docs/api-contracts.md)：T03 HTTP、错误、幂等和实时事件格式。
- [设计 Tokens](docs/design-tokens.md)：T02 色彩、字体、间距、形状、动效和无障碍基础。
- [UI 与组件规范](docs/ui-spec.md)：T02 页面布局、组件状态与前端 Mock 契约。
- [PRD V1.0](docs/PRD_V1.0.md)：历史页面与功能基线；与 V1.1 配套阅读，冲突以 V1.1 为准。
- [M2 验收报告](docs/qa/m2-report.md)：已通过链路、测试证据和生产阻塞项。
- [当前开发状态](docs/qa/functional-report.md)：M3～M4 本地实现、T21 单机回归证据和下一阶段阻塞项。

## 本地运行与验证

```text
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run test:m2
```

本地 OTP 默认使用 `000000`，也可复制 `.env.example` 后修改。当前服务端数据保存在进程内，重启即清空，仅用于开发联调。

## 使用约定

1. 页面结构以 PRD 的已确认规则为准：列表卡片直接进入拼图；创建作品全程单页完成。
2. V1.0 的 D01～D12 已由 V1.1 同号规则收口；新规则属于本次补充决策，不代表原对话已逐项确认。
3. 前端只通过 `/api/v1` 访问领域数据；本地适配器不代表生产 Supabase 已配置。

```text
jigsaw-web/
├─ README.md
├─ app/                 页面与 API Route Handlers
├─ components/          UI 与拼图组件
├─ lib/                 客户端、领域、引擎和本地服务适配器
├─ public/placeholders/ 本地占位图片
├─ scripts/             M2、M3～M4 冒烟验收
├─ docs/
│  ├─ PRD_V1.0.md
│  ├─ PRD_V1.1.md
│  └─ qa/               验收报告
└─ tasks/
   └─ roadmap.md
```
