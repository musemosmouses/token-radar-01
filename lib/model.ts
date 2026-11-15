// comps-5 — the token launch radar's model.
//
// A board of pre-token protocols ranked by an implied value the model fits from
// the snapshot's own traded protocols, never from a hardcoded list of names.
// Every row is scored by the same function, and the dashboard's sandbox runs
// that same function, so the page and the board agree by construction.
//
//   size curve  log10(mcap) = a + b x log10(tvl), OLS on the comparables
//   momentum    1 + 0.75 x clamp(change_7d, -40, +60) / 100
//   seasoning   0.55 + 0.45 x min(age_days, 730) / 730   (unknown age: 365)
//   kin         x0.5 when a related token already trades (name-base match)
//   implied     10 ^ (curve + log10(momentum) + log10(seasoning) + log10(kin))
//
// The comparables are the snapshot's traded protocols with a positive market
// cap, minus the categories whose token does not price off TVL (CEX, bridges,
// liquid staking / restaking, and cross-chain bridges, whose token prices off
// volume), minus versioned pools, minus mcap/TVL ratios outside 0.005..20
// (dead tokens and exchange-token outliers). On this snapshot that leaves 84
// comparables: a = 2.71, b = 0.56, R^2 = 0.22.
// Leave-one-out backtest on them: typical miss x2.61, mean x3.84, against a
// flat median multiple at x4.17 on the same comparables. The P25-P75 band of the LOO residuals is
// x0.43..x3.84 and is shown per row. All of it is fitted at run time from
// the snapshot in hand, so the numbers on the page are the model's, not
// constants copied from a notebook.
//
// Farm economics are net of gas: the expected airdrop slice assumes 10% of
// the implied value goes to depositors, shared pro-rata over TVL. The plan's
// capital is tiered by TVL ($1,000 / $500 / $250) and its gas is 6 on-chain
// transactions priced by the protocol's first chain. A row is farm when the
// net slice at plan size is at least $5, thin when it covers gas, skip when
// it does not. The assumption is stated on the page; the verdicts follow it.

import { farmEconomics, farmSteps } from './farm.ts';

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The fitted size curve and its backtest, as the page states them. */
export interface FitReport {
  intercept: number;
  slope: number;
  r2: number;
  comparables: number;
  loo_median: number;
  loo_mean: number;
  flat_median: number;
  band_low: number;
  band_high: number;
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  momentum_weight: number;
  momentum_floor: number;
  momentum_cap: number;
  seasoning_floor: number;
  seasoning_days: number;
  unknown_age_days: number;
  kin_discount: number;
  depositor_share: number;
  fit: FitReport;
}

export const MODEL: ModelConstants = {
  momentum_weight: 0.75,
  momentum_floor: -40,
  momentum_cap: 60,
  seasoning_floor: 0.55,
  seasoning_days: 730,
  unknown_age_days: 365,
  kin_discount: 0.5,
  depositor_share: 0.1,
  fit: {
    intercept: 2.7149,
    slope: 0.5576,
    r2: 0.217,
    comparables: 84,
    loo_median: 2.61,
    loo_mean: 3.84,
    flat_median: 4.52,
    band_low: 0.43,
    band_high: 3.84,
  },
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'comps-5';

/** How many live-token protocols the Token already trades view carries, by market cap. */
export const LIVE_ROWS = 40;

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    curve_value_usd: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    kin_multiplier: number;
    kin_note: string | null;
    age_days: number | null;
  };
  band: { low_usd: number; high_usd: number };
  econ: {
    slice_per_1k_usd: number;
    capital_usd: number;
    slice_usd: number;
    gas_usd: number;
    net_usd: number;
    net_per_hour_usd: number;
    verdict: 'farm' | 'thin' | 'skip';
    chain: string;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with the farm plan and economics in it. */
export type RadarRow = BoardRow;

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number;
  change_7d: number | null;
  multiple: number;
}

/** A pre-token protocol the strict rule set aside, with the reason. */
export interface SetAsideRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  reason: string;
}

/** One comparable the curve was fitted on, for the calibration scatter. */
export interface ComparablePoint {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  mcap_usd: number;
}

/** Everything the dashboard needs: the board, the live set, the set-aside, the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  set_aside_size: number;
  verdicts: { farm: number; thin: number; skip: number };
  board_digest: string;
  watchlist_slugs: string[];
  rows: RadarRow[];
  live: LiveRow[];
  set_aside: SetAsideRow[];
  comparables: ComparablePoint[];
  farm_next: { slug: string; name: string; net_per_hour_usd: number; net_usd: number; verdict: string }[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** A whole word wrapped, staked or staking in a name. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
/** A name beginning with an exchange's name. */
const EXCHANGE_NAMED = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;
/** Categories whose token does not price off TVL, or which are not a launch at all. */
const EXCLUDED_CATEGORIES = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);
/** The comparables leave cross-chain bridges out too: a bridge token prices off volume, not TVL. */
const COMPARABLE_EXCLUDED = new Set([...EXCLUDED_CATEGORIES, 'Cross Chain Bridge']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_NAMED.test(p.name)
  );
}

/** Why a pre-token protocol is set aside, or null when it is rankable. */
export function setAsideReason(p: SnapshotProtocol): string | null {
  if (!isPreToken(p)) return null;
  if (EXCLUDED_CATEGORIES.has(p.category ?? '')) return `category ${p.category} is not a launch: a ${p.category} product's token, if any, is the underlying's`;
  if (VERSIONED.test(p.name)) return 'name ends in a version marker: a pool of another protocol';
  if (WRAPPED_WORD.test(p.name)) return 'name carries wrapped, staked or staking: a product of a token that already trades';
  if (EXCHANGE_NAMED.test(p.name)) return 'name begins with an exchange: a centralised product, not a protocol launch';
  return null;
}

/** A name's first two words, lowercased, version markers stripped: the kin key. */
function nameBase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s(v\d+(\.\d+)?|\d+\.\d+)$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 2)
    .join(' ');
}

/** The traded protocols' name bases: a pre-token protocol sharing one has kin that already trades. */
function tradedBases(protocols: SnapshotProtocol[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of protocols) {
    if (isPreToken(p)) continue;
    const base = nameBase(p.name);
    if (!out.has(base)) out.set(base, p.name);
  }
  return out;
}

/** The comparables the size curve is fitted on. */
export function comparables(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter(
    (p) =>
      p.mcap_usd !== null &&
      p.mcap_usd > 0 &&
      p.tvl_usd > 0 &&
      !COMPARABLE_EXCLUDED.has(p.category ?? '') &&
      !VERSIONED.test(p.name) &&
      p.mcap_usd / p.tvl_usd >= 0.005 &&
      p.mcap_usd / p.tvl_usd <= 20,
  );
}

/** Ordinary least squares on log10(mcap) against log10(tvl). */
function ols(xs: number[], ys: number[]): { a: number; b: number; r2: number } {
  const n = xs.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
    syy += (ys[i]! - my) ** 2;
  }
  const b = sxx > 0 ? sxy / sxx : 0;
  const a = my - b * mx;
  return { a, b, r2: sxx > 0 && syy > 0 ? (sxy * sxy) / (sxx * syy) : 0 };
}

/** The log10 implied value of one protocol under a fitted curve, before the kin discount. */
function logImplied(p: SnapshotProtocol, asOf: string, fit: { a: number; b: number }, model: ModelConstants): { value: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, p.listed_at);
  const rawGrowth = finite(p.change_7d, 0);
  const growthPct = Math.min(model.momentum_cap, Math.max(model.momentum_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.momentum_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.seasoning_floor + ((1 - model.seasoning_floor) * Math.min(Math.max(ageForModel, 0), model.seasoning_days)) / model.seasoning_days;
  const value = fit.a + fit.b * Math.log10(p.tvl_usd) + Math.log10(growthMult) + Math.log10(maturityMult);
  return { value, growthPct, growthMult, maturityMult, age };
}

/** The size curve fitted on this snapshot, with its leave-one-out backtest. */
export function fitModel(snapshot: Snapshot, model: ModelConstants = MODEL): { fit: { a: number; b: number; r2: number }; report: FitReport } {
  const comps = comparables(snapshot);
  const fit = ols(
    comps.map((p) => Math.log10(p.tvl_usd)),
    comps.map((p) => Math.log10(p.mcap_usd)),
  );
  // Leave-one-out: refit without each comparable, predict it with the full factors.
  const errs: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const rest = comps.filter((_, j) => j !== i);
    const g = ols(
      rest.map((p) => Math.log10(p.tvl_usd)),
      rest.map((p) => Math.log10(p.mcap_usd)),
    );
    const pred = logImplied(comps[i]!, snapshot.as_of, g, model).value;
    errs.push(Math.log10(comps[i]!.mcap_usd!) - pred);
  }
  const abs = errs.map((e) => Math.abs(e)).sort((a, b) => a - b);
  const signed = [...errs].sort((a, b) => a - b);
  const median = abs[Math.floor(abs.length / 2)]!;
  const mean = abs.reduce((s, e) => s + e, 0) / abs.length;
  const flatRatio = (() => {
    const ratios = comps.map((p) => p.mcap_usd! / p.tvl_usd).sort((a, b) => a - b);
    return ratios[Math.floor(ratios.length / 2)]!;
  })();
  const flatErrs = comps.map((p) => Math.abs(Math.log10(p.tvl_usd * flatRatio) - Math.log10(p.mcap_usd!))).sort((a, b) => a - b);
  const report: FitReport = {
    intercept: round4(fit.a),
    slope: round4(fit.b),
    r2: round4(fit.r2),
    comparables: comps.length,
    loo_median: round2(10 ** median),
    loo_mean: round2(10 ** mean),
    flat_median: round2(10 ** flatErrs[Math.floor(flatErrs.length / 2)]!),
    band_low: round2(10 ** signed[Math.floor(0.25 * (signed.length - 1))]!),
    band_high: round2(10 ** signed[Math.floor(0.75 * (signed.length - 1))]!),
  };
  return { fit, report };
}

/** The implied value and its breakdown for one protocol. */
export function impliedValue(
  p: SnapshotProtocol,
  asOf: string,
  fit: { a: number; b: number },
  model: ModelConstants,
  kin: string | null,
): { implied: number; curve: number; growthPct: number; growthMult: number; maturityMult: number; kinMult: number; age: number | null } {
  const { value, growthPct, growthMult, maturityMult, age } = logImplied(p, asOf, fit, model);
  const kinMult = kin === null ? 1 : model.kin_discount;
  const curve = Math.max(1, Math.round(10 ** (fit.a + fit.b * Math.log10(p.tvl_usd))));
  const implied = Math.max(1, Math.round(10 ** value * kinMult));
  return { implied, curve, growthPct, growthMult, maturityMult, kinMult, age };
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const { fit, report } = fitModel(snapshot, model);
  const liveModel: ModelConstants = { ...model, fit: report };
  const index = bySlug(snapshot.protocols);
  const kinMap = tradedBases(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => {
    const base = nameBase(p.name);
    const kin = kinMap.has(base) ? kinMap.get(base)! : null;
    const v = impliedValue(p, snapshot.as_of, fit, liveModel, kin);
    const econ = farmEconomics(p, v.implied);
    return { p, v, kin, econ };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    model: {
      curve_value_usd: s.v.curve,
      growth_pct: round2(s.v.growthPct),
      growth_multiplier: round4(s.v.growthMult),
      maturity_multiplier: round4(s.v.maturityMult),
      kin_multiplier: s.v.kinMult,
      kin_note: s.kin === null ? null : `shares its name base with ${s.kin}, whose token already trades: implied value halved`,
      age_days: s.v.age,
    },
    band: {
      low_usd: Math.max(1, Math.round(s.v.implied * report.band_low)),
      high_usd: Math.max(1, Math.round(s.v.implied * report.band_high)),
    },
    econ: s.econ,
    farm_steps: farmSteps(s.p, s.v.age, s.econ),
  }));
}

/** The live-token protocols, by market cap, for the dashboard's Token already trades view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX' && p.mcap_usd !== null && p.mcap_usd > 0)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd!,
      change_7d: p.change_7d,
      multiple: round2(p.mcap_usd! / p.tvl_usd),
    }));
}

/** The pre-token protocols the strict rule set aside, by TVL, with the reason. */
export function setAsideRows(snapshot: Snapshot): SetAsideRow[] {
  return snapshot.protocols
    .filter((p) => setAsideReason(p) !== null)
    .sort((a, b) => b.tvl_usd - a.tvl_usd)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      reason: setAsideReason(p)!,
    }));
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const { report } = fitModel(snapshot, model);
  const liveModel: ModelConstants = { ...model, fit: report };
  const board = buildBoard(snapshot, liveModel);
  const live = liveRows(snapshot);
  const setAside = setAsideRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const verdicts = { farm: 0, thin: 0, skip: 0 };
  for (const r of board) verdicts[r.econ.verdict]++;
  const farmNext = [...board]
    .filter((r) => r.econ.verdict === 'farm')
    .sort((a, b) => b.econ.net_per_hour_usd - a.econ.net_per_hour_usd || b.econ.net_usd - a.econ.net_usd)
    .slice(0, 10)
    .map((r) => ({ slug: r.slug, name: r.name, net_per_hour_usd: r.econ.net_per_hour_usd, net_usd: r.econ.net_usd, verdict: r.econ.verdict }));
  const comps = comparables(snapshot).map((p) => ({ slug: p.slug, name: p.name, category: p.category, tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd! }));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model: liveModel,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    set_aside_size: setAside.length,
    verdicts,
    board_digest: '',
    watchlist_slugs: snapshot.watchlist,
    rows: board,
    live,
    set_aside: setAside,
    comparables: comps,
    farm_next: farmNext,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
