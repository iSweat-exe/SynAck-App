-- The five first hard exercises, so that the server counts the experience and the coins they
-- earn (see 20261026200000_player_stats.sql: an exercise the catalog does not know earns nothing).

insert into public.catalog_items (kind, id, difficulty) values
  ('exercise', 'lis', 'hard'),
  ('exercise', 'edit_distance', 'hard'),
  ('exercise', 'knapsack', 'hard'),
  ('exercise', 'shortest_path', 'hard'),
  ('exercise', 'topological_order', 'hard');
