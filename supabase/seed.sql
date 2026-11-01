-- Local development seed. Runs after migrations on `pnpm db:reset`.
-- Catalog data only. Users are created by tests (supabase/tests) or by signing in
-- locally with a magic link (Mailpit, http://127.0.0.1:54324). Never put production data here.

insert into public.leagues (id, slug, name_pl, name_en, tier) values
  (1, 'bernoulli', 'Bernoulli', 'Bernoulli', 1),
  (2, 'gauss', 'Gauss', 'Gauss', 2),
  (3, 'markov', 'Markow', 'Markov', 3),
  (4, 'kolmogorov', 'Kołmogorow', 'Kolmogorov', 4),
  (5, 'ito', 'Itô', 'Itô', 5),
  (6, 'black-scholes', 'Black–Scholes', 'Black–Scholes', 6);

insert into public.achievements (id, name_pl, name_en, description_pl, description_en, sort) values
  ('ruina-gracza', 'Ruina gracza', 'Gambler’s ruin', 'Przeprowadź 1000 symulacji strategii martyngałowej.', 'Run 1,000 simulations of a martingale strategy.', 10),
  ('anty-guru', 'Anty-guru', 'Anti-guru', 'Ukończ 10 wpisów w Debunk Lab.', 'Finish 10 Debunk Lab entries.', 20),
  ('kelly', 'Kelly', 'Kelly', 'Oblicz ułamek Kelly’ego poprawnie za pierwszym razem.', 'Get the Kelly fraction right on the first try.', 30);

insert into public.feature_flags (key, enabled, description) values
  ('placement-quiz', true, 'Optional placement quiz after onboarding');
