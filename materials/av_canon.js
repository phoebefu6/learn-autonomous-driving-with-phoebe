// Node canon for learn-autonomous-driving-with-phoebe: loads the SHIPPED engine, runs the whole ladder at
// the canon settings and the comparison settings, plus the selfTest fault proofs.
// Usage: node materials/av_canon.js <repo> <out.json>
// Then:  python3 -I materials/av_reference.py <repo> --compare <out.json>
const path = require("path"), fs = require("fs");
const repo = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const out = process.argv[3] || "av_canon.json";
const AV = require(path.join(repo, "assets", "av-live.js"));

const st = AV.selfTest();
const faults = AV.FAULTS.map(f => {
  const r = AV.selfTest(f);
  return { fault: f, pass: r.pass, failed: r.checks.filter(c => !c.pass).map(c => c.name) };
});

function pick(L) {
  return {
    contexts: L.contexts.map(c => ({ id: c.id, k: c.k, miles: c.miles, rate: c.rate, humanRate: c.humanRate })),
    fatal: L.fatal, own: L.own, matched: L.matched,
    tail: { point: L.tail.point, se: L.tail.se, upper: L.tail.upper, mcPoint: L.tail.mcPoint, truePoint: L.tail.truePoint,
      classes: L.tail.classes.map(c => ({ id: c.id, mcHits: c.mcHits, isHits: c.isHits, mcRate: c.mcRate, isRate: c.isRate, isRateSE: c.isRateSE, wMean: c.wMean })) },
    withTail: L.withTail, brk: L.brk,
    variance: L.variance || null,
    anti: L.anti ? { conflicts: L.anti.conflicts, pickedByScore: L.anti.pickedByScore, pickedBySafety: L.anti.pickedBySafety,
      scorePenalty: L.anti.scorePenalty,
      policies: L.anti.policies.map(p => ({ id: p.id, disengagements: p.disengagements, disengPer100k: p.disengPer100k, extraCrashes: p.extraCrashes, trueRate: p.trueRate })) } : null
  };
}

const t0 = Date.now();
const runs = {
  canon: pick(AV.ladder({})),
  miles60M: pick(AV.ladder({ miles: 60e6, withVariance: false })),
  miles400M: pick(AV.ladder({ miles: 400e6, withVariance: false })),
  conf90: pick(AV.ladder({ conf: 0.90, withVariance: false, withAnti: false })),
  conf99: pick(AV.ladder({ conf: 0.99, withVariance: false, withAnti: false })),
  budget500: pick(AV.ladder({ budget: 500, withAnti: false })),
  budget8000: pick(AV.ladder({ budget: 8000, withAnti: false }))
};
const ms = Date.now() - t0;
const sync = {};
for (const [k, d, t] of [["nearest60", "nearest", 60], ["backward60", "backward", 60], ["forward60", "forward", 60], ["forward20", "forward", 20], ["nearest20", "nearest", 20], ["strict60", "forwardStrict", 60]]) {
  const r = AV.syncToy({ direction: d, tolMs: t });
  sync[k] = { direction: r.direction, tolMs: r.tolMs, frames: r.frames, fireScans: r.fireScans, correct: r.correct, wrong: r.wrong, unmatched: r.unmatched, cams: r.cams };
}
const canon = { generated: new Date().toISOString().slice(0, 10), human: AV.HUMAN, defaults: AV.DEFAULTS,
  selfTest: st, faultProofs: faults, ms, runs, sync };
fs.writeFileSync(out, JSON.stringify(canon, null, 1));

const f = (x, d) => (x === null || x === undefined) ? "-" : x.toFixed(d);
for (const [name, r] of Object.entries(runs)) {
  console.log(name.padEnd(11), "fatal k", r.fatal.k, "U", f(r.fatal.upper, 3), r.fatal.verdict,
    "| own", r.own.k, f(r.own.point, 2), f(r.own.upper, 2), r.own.verdict,
    "| matched", f(r.matched.point, 2), f(r.matched.upper, 2), r.matched.verdict,
    "| tail IS", f(r.tail.point, 2), "MC", f(r.tail.mcPoint, 2),
    "| +tail", f(r.withTail.point, 2), f(r.withTail.upper, 2), r.withTail.verdict,
    "| break", r.brk.verdict,
    r.variance ? "| sd MC " + f(r.variance.mcSD, 3) + " IS " + f(r.variance.isSD, 3) + " x" + f(r.variance.ratio, 2) + " zeroAny " + f(r.variance.mcZeroAnyShare, 3) : "",
    r.anti ? "| anti " + r.anti.policies.map(p => p.id + " " + f(p.disengPer100k, 3) + "/" + p.extraCrashes + "/" + f(p.trueRate, 2)).join(", ") + " score->" + r.anti.pickedByScore + " safety->" + r.anti.pickedBySafety : "");
}
for (const [k, r] of Object.entries(sync)) console.log("sync", k.padEnd(10), "correct", r.correct, "wrong", r.wrong, "unmatched", r.unmatched, "of", r.frames, "| fire scans", r.fireScans.join(","));
console.log("human crash baseline", f(AV.HUMAN.crash, 4), "fatal", AV.HUMAN.fatal, "| miles needed (0 events, 95%)", f(runs.canon.fatal.milesNeeded, 0));
console.log("selfTest", st.pass, "| fault proofs:", faults.map(x => x.fault + "=" + (x.pass ? "PASSED(bad)" : "failed:" + x.failed.length)).join("; "), "| ms", ms);
process.exit(st.pass && faults.every(x => !x.pass) ? 0 : 1);
