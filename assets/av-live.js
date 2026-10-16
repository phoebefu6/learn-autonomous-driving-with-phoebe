/* av-live.js - the computed engine for learn-autonomous-driving-with-phoebe, by Phoebe Fu.
   One file for node and the browser. Python mirror: materials/av_reference.py (must agree).

   Real part: the human baselines. Fatality rate 1.33 per 100 million vehicle miles (NHTSA, 2022 data,
   DOT HS 813 643) and police-reported crashes 185.55 per 100 million miles (derived from the same
   report: 5,930,496 crashes over 3,196,191 million miles). The maths is exact: Poisson upper bounds by
   the gamma (Garwood) form, the Fay-Feuer gamma bound for an exposure-matched rate, and importance
   sampling with likelihood-ratio weights.
   Constructed parts (always labelled on the widget): Lanehart, a fictional robotaxi pilot fleet; its
   miles by road context, its true crash rates, the human context mix and context rates, the four rare
   scenario classes and their rates, the takeover policies and conflicts behind the anti-lever.

   Ladder: naive fatal-crash-free miles -> exact Poisson bounds -> exposure-matched comparison ->
   + importance-sampled rare-scenario rate. Anti-lever: score the fleet by disengagements per mile.
   Break button: drop the rare-scenario slices from evaluation. selfTest() runs on load; each check is
   proven to fail on a reintroduced fault (FAULTS).
*/
(function (root) {
  "use strict";

  var FAULT = null; // set only inside selfTest to prove a check can fail

  var HUMAN = { fatal: 1.33, crash: 5930496 / 31961.91 }; // per 100M vehicle miles, NHTSA 2022

  var CONTEXTS = [
    { id: "highway", label: "Highway", share: 0.55, trueRate: 60, humanShare: 0.35, humanRel: 0.50 },
    { id: "urban", label: "Urban, day", share: 0.30, trueRate: 150, humanShare: 0.40, humanRel: 1.15 },
    { id: "night", label: "Night", share: 0.10, trueRate: 200, humanShare: 0.15, humanRel: 1.40 },
    { id: "rain", label: "Rain", share: 0.05, trueRate: 330, humanShare: 0.10, humanRel: 1.60 }
  ];

  var RARE = [
    { id: "occluded", label: "Pedestrian steps out from behind a parked van", enc: 4000, p: 0.003 },
    { id: "wrongway", label: "Wrong-way vehicle on a divided road", enc: 300, p: 0.02 },
    { id: "debris", label: "Debris in lane at highway speed", enc: 2500, p: 0.004 },
    { id: "emergency", label: "Emergency vehicle crossing a junction", enc: 1200, p: 0.015 }
  ];

  var POLICIES = [
    { id: "cautious", label: "Cautious takeovers", tau: 0.50 },
    { id: "standard", label: "Standard takeovers", tau: 0.90 },
    { id: "loose", label: "Loose takeovers", tau: 0.985 }
  ];

  var DEFAULTS = {
    seed: 1016, miles: 150e6, conf: 0.95, budget: 2000, reps: 200,
    fatalTrue: 0.3, conflictPer100M: 2000, necessary: 0.97, crashIfMissed: 0.25
  };

  function extend(a, b) {
    var o = {}, k;
    for (k in a) o[k] = a[k];
    if (b) for (k in b) o[k] = b[k];
    return o;
  }

  function mulberry32(seed) {
    var a = seed | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function poisson(lam, rnd) { // Knuth; lam stays far below 700 here
    var L = Math.exp(-lam), k = 0, p = 1;
    do { k++; p *= rnd(); } while (p > L);
    return k - 1;
  }

  var LG = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  function lgamma(z) { // Lanczos, g = 7
    if (z < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - lgamma(1 - z);
    z -= 1;
    var x = 0.99999999999980993;
    for (var i = 0; i < 8; i++) x += LG[i] / (z + i + 1);
    var t = z + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }

  function gammaP(a, x) { // regularised lower incomplete gamma
    if (x <= 0) return 0;
    var lead = -x + a * Math.log(x) - lgamma(a);
    if (x < a + 1) {
      var ap = a, sum = 1 / a, del = sum;
      for (var n = 0; n < 1000; n++) {
        ap += 1; del *= x / ap; sum += del;
        if (Math.abs(del) < Math.abs(sum) * 1e-16) break;
      }
      return sum * Math.exp(lead);
    }
    var b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
    for (var i = 1; i < 1000; i++) {
      var an = -i * (i - a);
      b += 2;
      d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d;
      var dl = d * c; h *= dl;
      if (Math.abs(dl - 1) < 1e-16) break;
    }
    return 1 - Math.exp(lead) * h;
  }

  function gammaQuantile(p, shape, scale) { // bisection, 200 halvings
    var lo = 0, hi = Math.max(1, shape);
    while (gammaP(shape, hi) < p) hi *= 2;
    for (var i = 0; i < 200; i++) {
      var mid = 0.5 * (lo + hi);
      if (gammaP(shape, mid) < p) lo = mid; else hi = mid;
    }
    return 0.5 * (lo + hi) * scale;
  }

  // Exact (Garwood) upper bound on a Poisson mean after k events, one-sided at confidence conf.
  function poissonUpper(k, conf) {
    var q = FAULT === "boundLowerTail" ? 1 - conf : conf;
    return gammaQuantile(q, k + 1, 1);
  }

  function poissonCdf(k, mu) { return 1 - gammaP(k + 1, mu); }

  // Fay-Feuer gamma upper bound for a directly standardised rate. Per mile.
  function ffUpper(ks, miles, w, conf) {
    var y = 0, v = 0, wm = 0;
    for (var i = 0; i < ks.length; i++) {
      var wi = w[i] / miles[i];
      y += wi * ks[i]; v += wi * wi * ks[i]; if (wi > wm) wm = wi;
    }
    var shape = (y + wm) * (y + wm) / (v + wm * wm), scale = (v + wm * wm) / (y + wm);
    return { point: y, upper: gammaQuantile(conf, shape, scale) };
  }

  // The exposure match: weight each road context by the HUMAN baseline's share of miles.
  function matchWeights() {
    return CONTEXTS.map(function (c) { return FAULT === "ownMix" ? c.share : c.humanShare; });
  }

  function verdict(point, upper, human) {
    if (upper < human) return "proven";
    if (point < human) return "notproven";
    return "worse";
  }

  function humanRates() {
    var s = 0;
    CONTEXTS.forEach(function (c) { s += c.humanShare * c.humanRel; });
    var scale = HUMAN.crash / s;
    return CONTEXTS.map(function (c) { return c.humanRel * scale; });
  }

  function expSample(rnd, mean) { return -Math.log(1 - rnd()) * mean; }

  // One rare class, budget n simulated encounters. Plain Monte Carlo and importance sampling.
  function rareEstimate(cls, n, rnd) {
    var t = -Math.log(cls.p);
    var hits = 0;
    for (var i = 0; i < n; i++) if (expSample(rnd, 1) > t) hits++;
    var mc = hits / n;
    var s = 0, s2 = 0, ws = 0, isHits = 0;
    for (var j = 0; j < n; j++) {
      var x = expSample(rnd, t);
      var w = FAULT === "isNoWeight" ? 1 : t * Math.exp(-x + x / t);
      ws += w;
      var term = x > t ? w : 0;
      if (x > t) isHits++;
      s += term; s2 += term * term;
    }
    var is = s / n;
    var isVar = n > 1 ? (s2 - n * is * is) / (n - 1) : 0;
    return {
      mc: mc, mcSE: Math.sqrt(mc * (1 - mc) / n), mcHits: hits,
      is: is, isSE: Math.sqrt(Math.max(isVar, 0) / n), isHits: isHits, wMean: ws / n
    };
  }

  function rareSet(o, seedBase, dropTail) {
    var out = [];
    RARE.forEach(function (cls, ci) {
      var r = rareEstimate(cls, o.budget, mulberry32((seedBase * 31 + 1000 + ci) | 0));
      out.push({ id: cls.id, label: cls.label, enc: cls.enc, pTrue: cls.p, trueRate: cls.enc * cls.p,
        mc: r.mc, mcSE: r.mcSE, mcHits: r.mcHits, is: r.is, isSE: r.isSE, isHits: r.isHits, wMean: r.wMean,
        mcRate: cls.enc * r.mc, isRate: cls.enc * r.is, isRateSE: cls.enc * r.isSE });
    });
    if (dropTail) out.forEach(function (c) { c.isRate = 0; c.isRateSE = 0; c.mcRate = 0; });
    return out;
  }

  function sumRate(cl, k) { var s = 0; cl.forEach(function (c) { s += c[k]; }); return s; }

  function variance(o) {
    var mcT = [], isT = [], zeroAny = 0;
    for (var r = 0; r < o.reps; r++) {
      var m = 0, s = 0, z = false;
      RARE.forEach(function (cls, ci) {
        var e = rareEstimate(cls, o.budget, mulberry32((o.seed * 7919 + r * 13 + ci) | 0));
        m += cls.enc * e.mc; s += cls.enc * e.is; if (e.mcHits === 0) z = true;
      });
      mcT.push(m); isT.push(s); if (z) zeroAny++;
    }
    function sd(a) {
      var mu = 0; a.forEach(function (x) { mu += x; }); mu /= a.length;
      var q = 0; a.forEach(function (x) { q += (x - mu) * (x - mu); });
      return { mean: mu, sd: Math.sqrt(q / (a.length - 1)) };
    }
    var a = sd(mcT), b = sd(isT);
    return { reps: o.reps, mcMean: a.mean, mcSD: a.sd, isMean: b.mean, isSD: b.sd,
      ratio: a.sd / b.sd, mcZeroAnyShare: zeroAny / o.reps, trueTotal: sumRate(RARE.map(function (c) { return { r: c.enc * c.p }; }), "r") };
  }

  function antiLever(o, tailPoint) {
    var rnd = mulberry32((o.seed + 2) | 0);
    var n = Math.round(o.miles * o.conflictPer100M / 1e8);
    var sev = [], crashDraw = [];
    for (var i = 0; i < n; i++) { sev.push(rnd()); crashDraw.push(rnd()); }
    var pols = POLICIES.map(function (p) {
      var dis = 0, crashes = 0;
      for (var j = 0; j < n; j++) {
        if (sev[j] > p.tau) dis++;
        else if (sev[j] > o.necessary && crashDraw[j] < o.crashIfMissed) crashes++;
      }
      return { id: p.id, label: p.label, tau: p.tau, disengagements: dis,
        disengPer100k: dis / o.miles * 1e5, extraCrashes: crashes,
        trueRate: tailPoint + crashes / o.miles * 1e8 };
    });
    var byScore = pols.slice().sort(function (a, b) { return a.disengPer100k - b.disengPer100k; })[0];
    var bySafety = pols.slice().sort(function (a, b) { return a.trueRate - b.trueRate || b.disengPer100k - a.disengPer100k; })[0];
    return { conflicts: n, policies: pols, pickedByScore: byScore.id, pickedBySafety: bySafety.id,
      scorePenalty: byScore.trueRate - bySafety.trueRate };
  }

  function ladder(opts) {
    var o = extend(DEFAULTS, opts);
    var rnd = mulberry32(o.seed | 0);
    var hr = humanRates();
    var ctx = CONTEXTS.map(function (c, i) {
      var m = o.miles * c.share;
      var k = poisson(m * c.trueRate / 1e8, rnd);
      return { id: c.id, label: c.label, share: c.share, miles: m, trueRate: c.trueRate, k: k,
        rate: k / m * 1e8, humanShare: c.humanShare, humanRate: hr[i] };
    });
    var kAll = 0; ctx.forEach(function (c) { kAll += c.k; });
    var fatalK = poisson(o.miles * o.fatalTrue / 1e8, mulberry32((o.seed + 1) | 0));

    // rung 1: naive
    var naive = { fatalK: fatalK, miles: o.miles, fatalPoint: fatalK / o.miles * 1e8,
      claim: fatalK === 0 ? "zero fatal crashes" : fatalK + " fatal crashes" };
    // rung 2: exact Poisson bounds
    var fU = poissonUpper(fatalK, o.conf) / o.miles * 1e8;
    var milesNeeded = poissonUpper(0, o.conf) / (HUMAN.fatal / 1e8);
    var fatal = { k: fatalK, point: naive.fatalPoint, upper: fU, human: HUMAN.fatal,
      milesNeeded: milesNeeded, verdict: verdict(naive.fatalPoint, fU, HUMAN.fatal) };
    var ownPoint = kAll / o.miles * 1e8, ownUpper = poissonUpper(kAll, o.conf) / o.miles * 1e8;
    var own = { k: kAll, point: ownPoint, upper: ownUpper, verdict: verdict(ownPoint, ownUpper, HUMAN.crash) };
    // rung 3: exposure matched
    var w = matchWeights();
    var ff = ffUpper(ctx.map(function (c) { return c.k; }), ctx.map(function (c) { return c.miles; }), w, o.conf);
    var matched = { point: ff.point * 1e8, upper: ff.upper * 1e8 };
    matched.verdict = verdict(matched.point, matched.upper, HUMAN.crash);
    // rung 4: + importance-sampled rare-scenario rate
    var z = gammaQuantile(o.conf, 0.5, 2); // chi-square(1) quantile
    var zOne = Math.sqrt(gammaQuantile(2 * o.conf - 1, 0.5, 2)); // one-sided normal quantile
    var cl = rareSet(o, o.seed, false);
    var rarePoint = sumRate(cl, "isRate");
    var rareSE = Math.sqrt(cl.reduce(function (s, c) { return s + c.isRateSE * c.isRateSE; }, 0));
    var tail = { classes: cl, point: rarePoint, se: rareSE, upper: rarePoint + zOne * rareSE,
      mcPoint: sumRate(cl, "mcRate"), truePoint: sumRate(cl, "trueRate") };
    var withTail = { point: matched.point + tail.point, upper: matched.upper + tail.upper };
    withTail.verdict = verdict(withTail.point, withTail.upper, HUMAN.crash);
    // break button: the tail dropped from evaluation
    var brk = { point: matched.point, upper: matched.upper, verdict: matched.verdict };
    var res = {
      opts: o, human: { fatal: HUMAN.fatal, crash: HUMAN.crash }, contexts: ctx,
      naive: naive, fatal: fatal, own: own, matched: matched, tail: tail, withTail: withTail, brk: brk,
      zOne: zOne, chi1: z
    };
    if (o.withVariance !== false) res.variance = variance(o);
    if (o.withAnti !== false) res.anti = antiLever(o, withTail.point);
    return res;
  }


  // Drive-log sync toy (constructed timing model after the public dataset's design, F9): one spinning
  // lidar at 20 Hz stamps each scan when its rotation completes; six cameras at 12 Hz fire as the sweep
  // crosses each camera's centre. Join every camera frame to a lidar scan by timestamp and count how many
  // land on the scan they were actually taken in.
  var CAMS = [
    { id: "front", az: 0 }, { id: "front right", az: 55 }, { id: "back right", az: 110 },
    { id: "back", az: 180 }, { id: "back left", az: 250 }, { id: "front left", az: 305 }
  ];
  function syncToy(opts) {
    var o = extend({ direction: "nearest", tolMs: 60, periodMs: 50, scans: 20, camPerSec: 12 }, opts);
    var ts = [];
    for (var i = 0; i < o.scans; i++) ts.push(o.periodMs * (i + 1));
    var fire = [];
    for (var j = 0; j < o.camPerSec; j++) fire.push(Math.floor(j * o.scans / o.camPerSec));
    var correct = 0, wrong = 0, unmatched = 0, rows = [];
    CAMS.forEach(function (c) {
      var cc = 0, cw = 0, cu = 0;
      fire.forEach(function (sIdx) {
        var t = o.periodMs * sIdx + c.az / 360 * o.periodMs;
        var truth = o.periodMs * (sIdx + 1), m = null, best = Infinity;
        for (var q = 0; q < ts.length; q++) {
          var d = ts[q] - t;
          if (o.direction === "backward" && d > 0) continue;
          if (o.direction === "forward" && d < 0) continue;
          if (o.direction === "forwardStrict" && d <= 0) continue;
          if (Math.abs(d) < best) { best = Math.abs(d); m = ts[q]; }
        }
        if (m === null || best > o.tolMs) cu++;
        else if (m === truth) cc++;
        else cw++;
      });
      correct += cc; wrong += cw; unmatched += cu;
      rows.push({ id: c.id, az: c.az, correct: cc, wrong: cw, unmatched: cu });
    });
    return { direction: o.direction, tolMs: o.tolMs, frames: CAMS.length * fire.length, fireScans: fire,
      correct: correct, wrong: wrong, unmatched: unmatched, cams: rows };
  }

  // Each check is a property; selfTest(fault) re-runs them with a fault planted in the REAL code path.
  function selfTest(fault) {
    var prev = FAULT; FAULT = fault || null;
    var checks = [];
    function chk(name, ok) { checks.push({ name: name, pass: !!ok }); }
    try {
      chk("zero-event bound is -ln(1 - C), the rule of three at 95%",
        Math.abs(poissonUpper(0, 0.95) - (-Math.log(0.05))) < 1e-9);
      var exact = true, above = true;
      for (var k = 0; k <= 40; k += 4) {
        var u = poissonUpper(k, 0.95);
        if (u < k) above = false;
        if (Math.abs(poissonCdf(k, u) - 0.05) > 1e-7) exact = false;
      }
      chk("Poisson upper bound sits above the count and leaves exactly 5% in the tail", exact && above);
      var one = ffUpper([12], [3e6], [1], 0.95);
      chk("one-stratum matched bound equals the exact Poisson bound",
        Math.abs(one.upper * 3e6 - poissonUpper(12, 0.95)) < 1e-6);
      var ctxK = [10, 40, 12, 9], ctxM = [2e6, 2e6, 1e6, 3e5], hs = CONTEXTS.map(function (c) { return c.humanShare; });
      var wUse = matchWeights();
      var mm = ffUpper(ctxK, ctxM, wUse, 0.95), want = 0;
      for (var i = 0; i < 4; i++) want += hs[i] * ctxK[i] / ctxM[i];
      chk("exposure-matched rate weights each context by the human mix", Math.abs(mm.point - want) < 1e-15 && mm.upper > mm.point);
      var toy = { p: 0.001, enc: 1 }, sum = 0, wsum = 0, R = 300;
      for (var r = 0; r < R; r++) {
        var e = rareEstimate(toy, 400, mulberry32(90001 + r));
        sum += e.is; wsum += e.wMean;
      }
      chk("importance sampling is unbiased: mean estimate within 6% of the true rate", Math.abs(sum / R - 0.001) < 0.00006);
      chk("importance weights average 1 over the proposal", Math.abs(wsum / R - 1) < 0.05);
    } catch (err) {
      chk("engine ran without error: " + String(err), false);
    }
    FAULT = prev;
    return { pass: checks.every(function (c) { return c.pass; }), checks: checks };
  }

  var AV = {
    HUMAN: HUMAN, CONTEXTS: CONTEXTS, RARE: RARE, POLICIES: POLICIES, DEFAULTS: DEFAULTS,
    mulberry32: mulberry32, poisson: poisson, lgamma: lgamma, gammaP: gammaP, gammaQuantile: gammaQuantile,
    poissonUpper: poissonUpper, poissonCdf: poissonCdf, ffUpper: ffUpper, humanRates: humanRates,
    rareEstimate: rareEstimate, ladder: ladder, syncToy: syncToy, CAMS: CAMS, antiLever: antiLever, verdict: verdict,
    selfTest: selfTest, FAULTS: ["boundLowerTail", "isNoWeight", "ownMix"]
  };

  if (typeof module !== "undefined" && module.exports) module.exports = AV;
  if (root) {
    root.AV = AV;
    try {
      AV.selfTestResult = selfTest();
      if (!AV.selfTestResult.pass && root.console) root.console.error("av-live selfTest failed", AV.selfTestResult);
    } catch (e) { AV.selfTestResult = { pass: false, error: String(e) }; }
  }
})(typeof window !== "undefined" ? window : null);
