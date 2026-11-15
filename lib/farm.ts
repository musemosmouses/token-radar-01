// Farm economics and farm plans: what a row is worth farming, net of gas,
// and the concrete steps to farm it.
//
// The economics assume 10% of a row's implied value goes to depositors,
// shared pro-rata over its TVL. That is an assumption, stated on the page;
// the verdicts follow it. The plan's capital is tiered by TVL and its gas
// is six on-chain transactions priced by the protocol's first chain:
// Ethereum mainnet is expensive, the cheap chains and the L2s are not, and
// that difference decides most verdicts. A row is farm when the net slice
// at plan size is at least $5, thin when it covers gas, skip when it does
// not. Every step carries its own cost and time, and the plan's active time
// is 75 minutes: 5 to set the wallet up, 15 to deposit, 10 for a second
// action, 30 across three weekly actions, 10 to claim, 5 to log it.

import type { SnapshotProtocol } from './model.ts';

/** One farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row's farm economics. */
export interface FarmEconomics {
  slice_per_1k_usd: number;
  capital_usd: number;
  slice_usd: number;
  gas_usd: number;
  net_usd: number;
  net_per_hour_usd: number;
  verdict: 'farm' | 'thin' | 'skip';
  chain: string;
}

/** The plan's on-chain transactions: deposit, second action, three weekly actions, claim. */
export const PLAN_TXS = 6;
/** The plan's active time in hours: 75 minutes of doing, the hold days excluded. */
export const ACTIVE_HOURS = 1.25;
/** The share of the implied value assumed to reach depositors. */
export const DEPOSITOR_SHARE = 0.1;

/** Chains whose transactions cost about five cents. */
const CHEAP_CHAINS = new Set([
  'Solana', 'Sui', 'Aptos', 'Near', 'Sei', 'Injective', 'Stellar', 'Ripple', 'TON', 'Tron',
  'Algorand', 'Hedera', 'Flow', 'Cardano', 'Tezos', 'Cosmos', 'Osmosis', 'Celestia',
  'Polkadot', 'Kusama', 'Elrond', 'XION', 'Initia', 'Nibiru', 'Neutron', 'Dymension',
  'ICP', 'Arweave', 'Mina', 'VeChain', 'IoTeX', 'Kaspa', 'Radix', 'Waves', 'Kava',
  'Cronos', 'BSC', 'Binance', 'Avalanche', 'Flare',
]);

/** Cheap EVM chains and rollups, about thirty cents a transaction. */
const L2_CHAINS = new Set([
  'Arbitrum', 'Base', 'Optimism', 'Polygon', 'zkSync Era', 'Linea', 'Scroll', 'Blast',
  'Mantle', 'Mode', 'Unichain', 'World Chain', 'Ink', 'Soneium', 'Abstract', 'Zora',
  'Fraxtal', 'Metis', 'Boba', 'Morph', 'Taiko', 'Kroma', 'Zircuit', 'Manta', 'X Layer',
  'Katana', 'Stable', 'Plume', 'Berachain', 'Sonic', 'Hyperliquid L1', 'Monad', 'MegaETH',
  'Arc', 'Tempo', 'Plasma', 'Robinhood Chain',
]);

/** One transaction's gas in dollars on a chain, by tier. */
export function gasPerTx(chain: string): number {
  if (chain === 'Ethereum') return 8;
  if (CHEAP_CHAINS.has(chain)) return 0.05;
  if (L2_CHAINS.has(chain)) return 0.3;
  return 1;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
export function capitalFor(tvlUsd: number): number {
  if (tvlUsd >= 1_000_000_000) return 1000;
  if (tvlUsd >= 100_000_000) return 500;
  return 250;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
export function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** One row's farm economics, net of gas. */
export function farmEconomics(p: SnapshotProtocol, impliedUsd: number): FarmEconomics {
  const chain = p.chains.length > 0 ? p.chains[0]! : 'Ethereum';
  const slicePer1k = (impliedUsd * DEPOSITOR_SHARE) / p.tvl_usd * 1000;
  const capital = capitalFor(p.tvl_usd);
  const slice = (slicePer1k * capital) / 1000;
  const gas = PLAN_TXS * gasPerTx(chain);
  const net = slice - gas;
  const verdict: 'farm' | 'thin' | 'skip' = net >= 5 ? 'farm' : net >= 0 ? 'thin' : 'skip';
  const round2 = (n: number): number => Math.round(n * 100) / 100;
  return {
    slice_per_1k_usd: round2(slicePer1k),
    capital_usd: capital,
    slice_usd: round2(slice),
    gas_usd: round2(gas),
    net_usd: round2(net),
    net_per_hour_usd: round2(net / ACTIVE_HOURS),
    verdict,
    chain,
  };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A second qualifying action, different from the first, so the wallet shows more than one move. */
function secondActionFor(p: SnapshotProtocol, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow $25 against the deposit on ${name} and repay it the same week.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Swap $25 through ${name}'s pool on ${chain} so the wallet shows a trade as well as liquidity.`;
  if (c.includes('bridge')) return `Bridge $25 back through ${name} so the wallet shows two-way use.`;
  if (c.includes('staking') || c.includes('restak')) return `Delegate a second $25 stake through ${name} to a different validator or pool.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Close the hedge on ${name} and open a second one at half the size.`;
  if (c.includes('prediction')) return `Place a second $10 position on a different ${name} market.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $25 into a second ${name} vault on another chain the protocol supports.`;
  if (c.includes('stable') || c.includes('rwa')) return `Mint a second $25 of the asset on ${name} on a different chain.`;
  if (c.includes('insurance')) return `Buy a second $25 of cover from ${name} for a different risk.`;
  return `Make a second $25 deposit on ${name} a week later so the wallet shows repeat use.`;
}

/** The verdict in one line, with the numbers behind it. */
function verdictLine(econ: FarmEconomics): string {
  const net = econ.net_usd >= 0 ? `+$${econ.net_usd.toFixed(2)}` : `-$${Math.abs(econ.net_usd).toFixed(2)}`;
  if (econ.verdict === 'farm') return `At plan size the expected slice is $${econ.slice_usd.toFixed(2)} against $${econ.gas_usd.toFixed(2)} of gas, net ${net}: worth farming.`;
  if (econ.verdict === 'thin') return `At plan size the expected slice is $${econ.slice_usd.toFixed(2)} against $${econ.gas_usd.toFixed(2)} of gas, net ${net}: thin, farm only with spare capital.`;
  return `At plan size the expected slice is $${econ.slice_usd.toFixed(2)} against $${econ.gas_usd.toFixed(2)} of gas, net ${net}: a skip at this size, the gas eats the slice.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time.
 * The plan is derived from the protocol's own record (category, chains, TVL,
 * age) and its economics, never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, econ: FarmEconomics): string[] {
  const chain = chainOf(p);
  const capital = econ.capital_usd;
  const hold = holdDaysFor(age);
  const gasEach = gasPerTx(chain);
  const steps: FarmStep[] = [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: `${actionFor(p, capital, chain)} ${verdictLine(econ)}`,
      cost: `$${capital} of capital and about $${gasEach.toFixed(2)} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: secondActionFor(p, chain),
      cost: `$25 of capital and about $${gasEach.toFixed(2)} of gas`,
      time: '10 minutes',
    },
    {
      text: `Make one qualifying action each week for three more weeks, such as a deposit, a borrow, a swap or a vote.`,
      cost: `about $${(3 * gasEach).toFixed(2)} of gas in all`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: `about $${gasEach.toFixed(2)} of gas to claim, and never pay to claim`,
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
  return steps.map(stepText);
}
