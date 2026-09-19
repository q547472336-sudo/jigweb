# M2 Supabase 数据层

`migrations/202609130001_m2_core.sql` 创建 M2 表、约束、索引、更新时间触发器和原子 RPC；`migrations/202609130002_m2_rls.sql` 开启 RLS 并配置公开作品/私有作品/私有资源策略；`seed.sql` 可重复写入十个分类。

推荐使用 Supabase CLI 在目标项目执行：

```text
supabase db push
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

服务端需要配置 `.env` 中的 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` 和 `SUPABASE_SERVICE_ROLE_KEY`。最后一个变量只能存在于服务端，不能进入浏览器包或客户端环境。未配置完整时，应用明确运行在 `memory-dev` 适配器；此模式重启丢失数据，仅供本地联调。

生产请求必须携带 Supabase Auth access token（`Authorization: Bearer ...`）。`x-user-id` 只在 memory-dev 模式可用，配置 Supabase 后会被拒绝。

图片上传流程是：服务端校验声明元数据 → 生成所有者路径 `${userId}/${uploadId}/original` 的短期 signed upload URL → 上传完成后由服务端/边缘函数读取对象并执行实际解码校验 → 写入 `puzzle_assets`。当前仓库的本地完成接口支持 base64 解码测试；生产 signed upload URL 返回后，仍需部署负责对象读取、静态 WebP/动画判定和派生图生成的边缘函数。
