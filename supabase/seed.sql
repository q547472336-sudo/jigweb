-- 可重复 seed：不依赖固定 UUID，不创建 auth.users。
insert into public.categories (slug, name, sort_order, active) values
  ('landscape', '风景', 10, true), ('art', '艺术', 20, true), ('animal', '动物', 30, true),
  ('illustration', '插画', 40, true), ('architecture', '建筑', 50, true), ('daily', '日常', 60, true),
  ('food', '美食', 70, true), ('people', '人物', 80, true), ('festival', '节日', 90, true), ('other', '其他', 100, true)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order, active = excluded.active;
