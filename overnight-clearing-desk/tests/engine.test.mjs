import assert from "node:assert/strict";
import * as E from "../overnight-engine.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };
let seq = 0;
const id = (p) => `${p}${++seq}`;

function setup(names = ["A", "B", "C"]) {
  const s = E.normalize(E.newState(0));
  for (const nm of names) s.banks[nm] = E.newBank(nm, 0);
  return s;
}
let ts = 1;
function order(s, stub, side, rate, volume) {
  const err = E.validateOrder(s, stub, side, rate, volume);
  if (err) return err;
  s.orders[id("o")] = { stub, side, rate, volume, remaining: volume, status: "open", day: s.day, ts: ts++ };
  return null;
}
const balanced = (s) => Object.values(s.banks).forEach((b) => assert.ok(E.totals(b).balanced, `${b.name} unbalanced ${JSON.stringify(E.totals(b))}`));

test("starting balance sheet balances at $120B", () => {
  const s = setup(["A"]);
  assert.deepEqual(E.totals(s.banks.A), { assets: 120, liabEq: 120, balanced: true });
});

test("shocks keep A = L + E", () => {
  const s = setup();
  E.shockBank(s.banks.A, "volatile", -8);
  E.shockBank(s.banks.B, "stickyDep", 5);
  E.shockBank(s.banks.C, "treasuries", 3);
  assert.equal(s.banks.A.cash, -8);
  assert.equal(s.banks.B.cash, 5);
  assert.equal(s.banks.C.cash, -3);
  balanced(s);
});

test("a bid alone rests in the book and shows as an open order", () => {
  const s = setup();
  E.shockBank(s.banks.A, "volatile", -8);
  assert.equal(order(s, "A", "bid", 4.45, 5), null);
  assert.equal(E.matchOrders(s, 10, id).length, 0);
  assert.equal(E.openOrders(s, "A").length, 1);
  assert.equal(E.capacity(s, "A").canBorrow, 15);
});

test("crossing offer fills at the resting bid's rate and moves both balance sheets", () => {
  const s = setup();
  E.shockBank(s.banks.A, "volatile", -8);
  E.shockBank(s.banks.B, "volatile", 6);
  order(s, "A", "bid", 4.45, 5);
  order(s, "B", "offer", 4.41, 5);
  const fills = E.matchOrders(s, 10, id);
  assert.equal(fills.length, 1);
  assert.equal(fills[0].rate, 4.45);     // bid was resting first
  assert.equal(fills[0].volume, 5);
  assert.equal(s.banks.A.cash, -3);
  assert.equal(s.banks.A.repoBorrowed, 5);
  assert.equal(s.banks.A.pledged, 5);
  assert.equal(s.banks.B.cash, 1);
  assert.equal(s.banks.B.repoLent, 5);
  assert.equal(E.openOrders(s, "A").length, 0);
  balanced(s);
});

test("non-crossing orders do not trade", () => {
  const s = setup();
  E.shockBank(s.banks.B, "volatile", 6);
  order(s, "A", "bid", 4.40, 2);
  order(s, "B", "offer", 4.45, 2);
  assert.equal(E.hasCross(s), false);
  assert.equal(E.matchOrders(s, 10, id).length, 0);
});

test("price-time priority and partial fills", () => {
  const s = setup(["A", "B", "C", "D"]);
  E.shockBank(s.banks.D, "volatile", 8);
  order(s, "A", "bid", 4.42, 3);
  order(s, "B", "bid", 4.48, 3);  // best bid
  order(s, "C", "bid", 4.48, 3);  // same price, later
  order(s, "D", "offer", 4.41, 5);
  const fills = E.matchOrders(s, 10, id);
  assert.deepEqual(fills.map((f) => [f.borrower, f.volume, f.rate]), [["B", 3, 4.48], ["C", 2, 4.48]]);
  assert.equal(Object.values(s.orders).find((o) => o.stub === "C").remaining, 1);
  balanced(s);
});

test("validation: cannot lend cash you don't have or pledge Treasuries you don't have", () => {
  const s = setup();
  assert.match(order(s, "A", "offer", 4.4, 1), /only lend up to \$0\.00B/);
  assert.match(order(s, "A", "bid", 4.4, 25), /only borrow up to \$20\.00B/);
  assert.equal(order(s, "A", "bid", 4.4, 15), null);
  assert.match(order(s, "A", "bid", 4.4, 6), /only borrow up to \$5\.00B/);
});

test("intermediation: borrow cheap then lend on", () => {
  const s = setup();
  E.shockBank(s.banks.B, "volatile", 6);
  order(s, "B", "offer", 4.40, 5);
  order(s, "A", "bid", 4.40, 5);
  E.matchOrders(s, 10, id);
  assert.equal(s.banks.A.cash, 5);
  assert.equal(order(s, "A", "offer", 4.46, 5), null);
  order(s, "C", "bid", 4.47, 5);
  E.matchOrders(s, 11, id);
  assert.equal(s.banks.A.cash, 0);
  assert.equal(s.banks.A.repoLent, 5);
  assert.equal(s.banks.A.repoBorrowed, 5);
  balanced(s);
});

test("no self-trades", () => {
  const s = setup();
  E.shockBank(s.banks.A, "volatile", 5);
  order(s, "A", "offer", 4.40, 2);
  order(s, "A", "bid", 4.45, 2);
  assert.equal(E.hasCross(s), false);
  assert.equal(E.matchOrders(s, 10, id).length, 0);
});

test("matcher re-checks cash at match time (shock after order)", () => {
  const s = setup();
  E.shockBank(s.banks.B, "volatile", 4);
  order(s, "B", "offer", 4.40, 4);
  E.shockBank(s.banks.B, "volatile", -3);   // only $1B left
  order(s, "A", "bid", 4.45, 4);
  const fills = E.matchOrders(s, 10, id);
  assert.equal(fills[0].volume, 1);
  assert.equal(s.banks.B.cash, 0);
  E.matchOrders(s, 11, id);
  const offer = Object.values(s.orders).find((o) => o.stub === "B");
  assert.equal(offer.status, "cancelled");
  balanced(s);
});

test("VW median", () => {
  assert.equal(E.volumeWeightedMedian([{ rate: 4.4, volume: 1 }, { rate: 4.5, volume: 3 }, { rate: 4.45, volume: 1 }]), 4.5);
  assert.equal(E.volumeWeightedMedian([{ rate: 4.4, volume: 2 }, { rate: 4.5, volume: 2 }]), 4.4);
  assert.equal(E.volumeWeightedMedian([]), null);
});

test("close: SOFR from private trades only; residuals go to SRF / overdraft / IORB", () => {
  const s = setup(["A", "B", "C"]);
  E.shockBank(s.banks.A, "volatile", -8);
  E.shockBank(s.banks.B, "volatile", 6);
  E.shockBank(s.banks.C, "volatile", -25);  // more than its $20B of Treasuries
  order(s, "A", "bid", 4.45, 5);
  order(s, "B", "offer", 4.42, 5);
  E.matchOrders(s, 10, id);
  order(s, "A", "bid", 4.40, 1);   // left open -> expires
  const r = E.closeMarket(s, 20, id);
  assert.equal(s.sofr, 4.45);       // bid rested first, so the only private trade printed at 4.45
  assert.equal(r.srfCount, 2);      // A ($3B) and C ($20B)
  assert.equal(r.overdraftCount, 1);
  assert.equal(r.parkedCount, 1);   // B has $1B left at the Fed
  assert.equal(Object.values(s.orders).filter((o) => o.status === "open").length, 0);
  const t = E.tradesForDay(s);
  const srfA = t.find((x) => x.kind === "srf" && x.borrower === "A");
  assert.equal(srfA.volume, 3); assert.equal(srfA.rate, 4.5);
  const od = t.find((x) => x.kind === "overdraft");
  assert.equal(od.volume, 5); assert.equal(od.rate, 5.5);
  for (const b of Object.values(s.banks)) assert.ok(b.cash >= 0);
  assert.equal(s.banks.C.pledged, 20);
  balanced(s);
  // SOFR must ignore Fed trades even though SRF volume is larger
  assert.equal(E.volumeWeightedMedian(t.filter((x) => x.kind === "private")), 4.45);
});

test("advance: interest accrues to equity AND cash, repos unwind, A = L + E", () => {
  const s = setup(["A", "B"]);
  E.shockBank(s.banks.A, "volatile", -5);
  E.shockBank(s.banks.B, "volatile", 5);
  order(s, "B", "offer", 4.42, 5);
  order(s, "A", "bid", 4.46, 5);
  E.matchOrders(s, 10, id);
  E.closeMarket(s, 20, id);
  assert.equal(s.sofr, 4.42);
  const eqA = s.banks.A.equity, eqB = s.banks.B.equity;
  E.advanceDay(s, 30, id);
  const repoInt = 5 * 4.42 / 100 / 360;
  const base = (80 * 0.065 + 20 * (4.42 + 1) / 100 - 90 * 0.035) / 360;
  assert.ok(Math.abs(s.banks.A.dayPnL - (base - repoInt)) < 2e-6, `A pnl ${s.banks.A.dayPnL}`);
  assert.ok(Math.abs(s.banks.B.dayPnL - (base + repoInt)) < 2e-6, `B pnl ${s.banks.B.dayPnL}`);
  assert.ok(s.banks.B.equity > eqB && s.banks.A.equity > eqA);
  // repos unwound: A is back to its structural -5 gap (minus interest), nothing pledged
  assert.equal(s.banks.A.repoBorrowed, 0);
  assert.equal(s.banks.A.pledged, 0);
  assert.equal(s.banks.B.repoLent, 0);
  assert.ok(Math.abs(s.banks.A.cash - (-5 + s.banks.A.dayPnL)) < 1e-6);
  assert.equal(s.day, 2);
  assert.equal(s.phase, "trading");
  assert.equal(s.sofr, null);
  assert.equal(s.lastSofr, 4.42);
  assert.equal(Object.keys(s.orders).length, 0);
  assert.equal(s.history.d1.sofr, 4.42);
  assert.equal(s.history.d1.volume, 5);
  balanced(s);
});

test("advance without explicit close closes first; no trades -> SOFR null, float uses IORB", () => {
  const s = setup(["A"]);
  const r = E.advanceDay(s, 30, id);
  assert.equal(r.sofrRef, 4.40);
  assert.equal(s.history.d1.sofr, null);
  balanced(s);
});

test("multi-day: three days of random play stay balanced", () => {
  const s = setup(["A", "B", "C", "D", "E"]);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let d = 0; d < 3; d++) {
    E.randomizeShocks(s, rnd);
    for (let k = 0; k < 30; k++) {
      const stubs = Object.keys(s.banks);
      const stub = stubs[Math.floor(rnd() * stubs.length)];
      const side = rnd() < 0.5 ? "bid" : "offer";
      const cap = E.capacity(s, stub);
      const vol = E.r2(Math.min(side === "bid" ? cap.canBorrow : cap.canLend, 1 + rnd() * 4));
      if (vol >= 0.01) order(s, stub, side, E.r2(4.38 + rnd() * 0.14), vol);
      E.matchOrders(s, 100 + k, id);
      balanced(s);
      for (const b of Object.values(s.banks)) assert.ok(b.pledged <= b.treasuries + 1e-6);
    }
    E.advanceDay(s, 1000 + d, id);
    balanced(s);
  }
  assert.equal(s.day, 4);
  assert.equal(Object.keys(s.history).length, 3);
});

test("normalize fills what Firebase drops", () => {
  const s = E.normalize({ day: 2, banks: { x: { name: "X", fixedLoans: 80 } } });
  assert.deepEqual(Object.keys(s.orders), []);
  assert.equal(s.banks.x.cash, 0);
  assert.equal(s.rates.srf, 4.5);
  assert.equal(s.sofr, null);
});

test("external (sponsored) participant can borrow without a balance sheet", () => {
  const s = setup(["A"]);
  E.shockBank(s.banks.A, "volatile", 6);
  s.orders.x1 = { stub: "ext_hf", name: "Hedge Fund", side: "bid", rate: 4.47, volume: 20, remaining: 20, status: "open", day: 1, ts: ts++ };
  order(s, "A", "offer", 4.43, 6);
  const f = E.matchOrders(s, 10, id);
  assert.equal(f[0].borrowerName, "Hedge Fund");
  assert.equal(f[0].volume, 6);
  assert.equal(f[0].rate, 4.47);
  E.advanceDay(s, 20, id);
  assert.equal(s.banks.A.repoLent, 0);
  balanced(s);
});

test("corridor warnings", () => {
  const s = setup(["A"]);
  assert.match(E.corridorWarning(s, "bid", 4.6), /Standing Repo Facility/);
  assert.match(E.corridorWarning(s, "offer", 4.3), /IORB/);
  assert.equal(E.corridorWarning(s, "bid", 4.45), null);
});

console.log(`\n${n} tests passed`);
