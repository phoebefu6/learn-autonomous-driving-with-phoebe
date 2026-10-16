"""Python reference for assets/av-live.js: same constants, same seeded draws, same arithmetic order.

Usage:
  python3 -I av_reference.py <repo>                  # run every canon setting, print the ladder
  python3 -I av_reference.py <repo> --compare FILE   # compare by VALUE with node's canon JSON
                                                      # (node materials/av_canon.js <repo> FILE)
  python3 -I av_reference.py <repo> --compare FILE --plant 0.001
                                                      # proves the comparator fails a 0.1% fault
Agreement rule: every integer (counts, hits, disengagements, verdicts, picks) identical; every real
number within 1e-9 relative (or 1e-12 absolute near zero). Exit 1 on any disagreement.

The human baselines are real (NHTSA, 2022 data); Lanehart and every fleet number are constructed.
Also runs a coverage check of the exposure-matched (Fay-Feuer) bound by simulation with --coverage.
"""
import json, math, sys

M32 = 0xFFFFFFFF


def to_i32(x):
    x &= M32
    return x - (1 << 32) if x & 0x80000000 else x


def imul(a, b):
    return to_i32(a * b)


def mulberry32(seed):
    st = [to_i32(seed)]

    def rnd():
        a = to_i32(st[0] + 0x6D2B79F5)
        st[0] = a
        t = imul(a ^ ((a & M32) >> 15), 1 | a)
        t = to_i32(to_i32(t + imul(t ^ ((t & M32) >> 7), 61 | t)) ^ t)
        return ((t ^ ((t & M32) >> 14)) & M32) / 4294967296.0
    return rnd


FAULT = [None]
HUMAN = {"fatal": 1.33, "crash": 5930496 / 31961.91}
CONTEXTS = [
    dict(id="highway", share=0.55, trueRate=60, humanShare=0.35, humanRel=0.50),
    dict(id="urban", share=0.30, trueRate=150, humanShare=0.40, humanRel=1.15),
    dict(id="night", share=0.10, trueRate=200, humanShare=0.15, humanRel=1.40),
    dict(id="rain", share=0.05, trueRate=330, humanShare=0.10, humanRel=1.60),
]
RARE = [
    dict(id="occluded", enc=4000, p=0.003),
    dict(id="wrongway", enc=300, p=0.02),
    dict(id="debris", enc=2500, p=0.004),
    dict(id="emergency", enc=1200, p=0.015),
]
POLICIES = [dict(id="cautious", tau=0.50), dict(id="standard", tau=0.90), dict(id="loose", tau=0.985)]
DEFAULTS = dict(seed=1016, miles=150e6, conf=0.95, budget=2000, reps=200, fatalTrue=0.3,
                conflictPer100M=2000, necessary=0.97, crashIfMissed=0.25)


def poisson(lam, rnd):
    L = math.exp(-lam)
    k, p = 0, 1.0
    while True:
        k += 1
        p *= rnd()
        if not p > L:
            break
    return k - 1


LG = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
      12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]


def lgamma(z):
    if z < 0.5:
        return math.log(math.pi / abs(math.sin(math.pi * z))) - lgamma(1 - z)
    z -= 1
    x = 0.99999999999980993
    for i in range(8):
        x += LG[i] / (z + i + 1)
    t = z + 7.5
    return 0.5 * math.log(2 * math.pi) + (z + 0.5) * math.log(t) - t + math.log(x)


def gammaP(a, x):
    if x <= 0:
        return 0.0
    lead = -x + a * math.log(x) - lgamma(a)
    if x < a + 1:
        ap, s = a, 1 / a
        d = s
        for _ in range(1000):
            ap += 1
            d *= x / ap
            s += d
            if abs(d) < abs(s) * 1e-16:
                break
        return s * math.exp(lead)
    b = x + 1 - a
    c = 1e300
    d = 1 / b
    h = d
    for i in range(1, 1000):
        an = -i * (i - a)
        b += 2
        d = an * d + b
        if abs(d) < 1e-300:
            d = 1e-300
        c = b + an / c
        if abs(c) < 1e-300:
            c = 1e-300
        d = 1 / d
        dl = d * c
        h *= dl
        if abs(dl - 1) < 1e-16:
            break
    return 1 - math.exp(lead) * h


def gammaQuantile(p, shape, scale):
    lo, hi = 0.0, max(1.0, shape)
    while gammaP(shape, hi) < p:
        hi *= 2
    for _ in range(200):
        mid = 0.5 * (lo + hi)
        if gammaP(shape, mid) < p:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi) * scale


def poissonUpper(k, conf):
    q = 1 - conf if FAULT[0] == "boundLowerTail" else conf
    return gammaQuantile(q, k + 1, 1)


def ffUpper(ks, miles, w, conf):
    y = v = wm = 0.0
    for i in range(len(ks)):
        wi = w[i] / miles[i]
        y += wi * ks[i]
        v += wi * wi * ks[i]
        if wi > wm:
            wm = wi
    shape = (y + wm) * (y + wm) / (v + wm * wm)
    scale = (v + wm * wm) / (y + wm)
    return {"point": y, "upper": gammaQuantile(conf, shape, scale)}


def matchWeights():
    return [c["share"] if FAULT[0] == "ownMix" else c["humanShare"] for c in CONTEXTS]


def verdict(point, upper, human):
    if upper < human:
        return "proven"
    if point < human:
        return "notproven"
    return "worse"


def humanRates():
    s = 0.0
    for c in CONTEXTS:
        s += c["humanShare"] * c["humanRel"]
    scale = HUMAN["crash"] / s
    return [c["humanRel"] * scale for c in CONTEXTS]


def expSample(rnd, mean):
    return -math.log(1 - rnd()) * mean


def rareEstimate(cls, n, rnd):
    t = -math.log(cls["p"])
    hits = 0
    for _ in range(n):
        if expSample(rnd, 1) > t:
            hits += 1
    mc = hits / n
    s = s2 = ws = 0.0
    isHits = 0
    for _ in range(n):
        x = expSample(rnd, t)
        w = 1 if FAULT[0] == "isNoWeight" else t * math.exp(-x + x / t)
        ws += w
        term = w if x > t else 0
        if x > t:
            isHits += 1
        s += term
        s2 += term * term
    est = s / n
    var = (s2 - n * est * est) / (n - 1) if n > 1 else 0
    return dict(mc=mc, mcSE=math.sqrt(mc * (1 - mc) / n), mcHits=hits, est=est,
                isSE=math.sqrt(max(var, 0) / n), isHits=isHits, wMean=ws / n)


def rareSet(o, seedBase):
    out = []
    for ci, cls in enumerate(RARE):
        r = rareEstimate(cls, o["budget"], mulberry32(to_i32(seedBase * 31 + 1000 + ci)))
        out.append(dict(id=cls["id"], mcHits=r["mcHits"], isHits=r["isHits"], wMean=r["wMean"],
                        mcRate=cls["enc"] * r["mc"], isRate=cls["enc"] * r["est"],
                        isRateSE=cls["enc"] * r["isSE"], trueRate=cls["enc"] * cls["p"]))
    return out


def variance(o):
    mcT, isT, zero = [], [], 0
    for r in range(o["reps"]):
        m = s = 0.0
        z = False
        for ci, cls in enumerate(RARE):
            e = rareEstimate(cls, o["budget"], mulberry32(to_i32(o["seed"] * 7919 + r * 13 + ci)))
            m += cls["enc"] * e["mc"]
            s += cls["enc"] * e["est"]
            if e["mcHits"] == 0:
                z = True
        mcT.append(m)
        isT.append(s)
        if z:
            zero += 1

    def sd(a):
        mu = 0.0
        for x in a:
            mu += x
        mu /= len(a)
        q = 0.0
        for x in a:
            q += (x - mu) * (x - mu)
        return mu, math.sqrt(q / (len(a) - 1))
    am, asd = sd(mcT)
    bm, bsd = sd(isT)
    tt = 0.0
    for c in RARE:
        tt += c["enc"] * c["p"]
    return dict(reps=o["reps"], mcMean=am, mcSD=asd, isMean=bm, isSD=bsd, ratio=asd / bsd,
                mcZeroAnyShare=zero / o["reps"], trueTotal=tt)


def antiLever(o, tailPoint):
    rnd = mulberry32(to_i32(o["seed"] + 2))
    n = int(math.floor(o["miles"] * o["conflictPer100M"] / 1e8 + 0.5))
    sev, cd = [], []
    for _ in range(n):
        sev.append(rnd())
        cd.append(rnd())
    pols = []
    for p in POLICIES:
        dis = crashes = 0
        for j in range(n):
            if sev[j] > p["tau"]:
                dis += 1
            elif sev[j] > o["necessary"] and cd[j] < o["crashIfMissed"]:
                crashes += 1
        pols.append(dict(id=p["id"], disengagements=dis, disengPer100k=dis / o["miles"] * 1e5,
                         extraCrashes=crashes, trueRate=tailPoint + crashes / o["miles"] * 1e8))
    byScore = sorted(pols, key=lambda q: q["disengPer100k"])[0]
    bySafety = sorted(pols, key=lambda q: (q["trueRate"], -q["disengPer100k"]))[0]
    return dict(conflicts=n, policies=pols, pickedByScore=byScore["id"], pickedBySafety=bySafety["id"],
                scorePenalty=byScore["trueRate"] - bySafety["trueRate"])


def ladder(opts=None, withVariance=True, withAnti=True):
    o = dict(DEFAULTS)
    o.update(opts or {})
    rnd = mulberry32(to_i32(o["seed"]))
    hr = humanRates()
    ctx = []
    for i, c in enumerate(CONTEXTS):
        m = o["miles"] * c["share"]
        k = poisson(m * c["trueRate"] / 1e8, rnd)
        ctx.append(dict(id=c["id"], k=k, miles=m, rate=k / m * 1e8, humanRate=hr[i]))
    kAll = sum(c["k"] for c in ctx)
    fatalK = poisson(o["miles"] * o["fatalTrue"] / 1e8, mulberry32(to_i32(o["seed"] + 1)))
    fPoint = fatalK / o["miles"] * 1e8
    fU = poissonUpper(fatalK, o["conf"]) / o["miles"] * 1e8
    milesNeeded = poissonUpper(0, o["conf"]) / (HUMAN["fatal"] / 1e8)
    fatal = dict(k=fatalK, point=fPoint, upper=fU, human=HUMAN["fatal"], milesNeeded=milesNeeded,
                 verdict=verdict(fPoint, fU, HUMAN["fatal"]))
    ownPoint = kAll / o["miles"] * 1e8
    ownUpper = poissonUpper(kAll, o["conf"]) / o["miles"] * 1e8
    own = dict(k=kAll, point=ownPoint, upper=ownUpper, verdict=verdict(ownPoint, ownUpper, HUMAN["crash"]))
    ff = ffUpper([c["k"] for c in ctx], [c["miles"] for c in ctx], matchWeights(), o["conf"])
    matched = dict(point=ff["point"] * 1e8, upper=ff["upper"] * 1e8)
    matched["verdict"] = verdict(matched["point"], matched["upper"], HUMAN["crash"])
    zOne = math.sqrt(gammaQuantile(2 * o["conf"] - 1, 0.5, 2))
    cl = rareSet(o, o["seed"])
    rp = 0.0
    for c in cl:
        rp += c["isRate"]
    rse = 0.0
    for c in cl:
        rse = rse + c["isRateSE"] * c["isRateSE"]
    rse = math.sqrt(rse)
    mcp = tp = 0.0
    for c in cl:
        mcp += c["mcRate"]
        tp += c["trueRate"]
    tail = dict(point=rp, se=rse, upper=rp + zOne * rse, mcPoint=mcp, truePoint=tp, classes=cl)
    withTail = dict(point=matched["point"] + tail["point"], upper=matched["upper"] + tail["upper"])
    withTail["verdict"] = verdict(withTail["point"], withTail["upper"], HUMAN["crash"])
    brk = dict(point=matched["point"], upper=matched["upper"], verdict=matched["verdict"])
    res = dict(contexts=ctx, fatal=fatal, own=own, matched=matched, tail=tail, withTail=withTail, brk=brk,
               variance=variance(o) if withVariance else None,
               anti=antiLever(o, withTail["point"]) if withAnti else None)
    return res


RUNS = {
    "canon": ({}, True, True),
    "miles60M": ({"miles": 60e6}, False, True),
    "miles400M": ({"miles": 400e6}, False, True),
    "conf90": ({"conf": 0.90}, False, False),
    "conf99": ({"conf": 0.99}, False, False),
    "budget500": ({"budget": 500}, True, False),
    "budget8000": ({"budget": 8000}, True, False),
}


CAMS = [("front", 0), ("front right", 55), ("back right", 110), ("back", 180), ("back left", 250), ("front left", 305)]


def syncToy(direction="nearest", tolMs=60, periodMs=50, scans=20, camPerSec=12):
    ts = [periodMs * (i + 1) for i in range(scans)]
    fire = [int(math.floor(j * scans / camPerSec)) for j in range(camPerSec)]
    correct = wrong = unmatched = 0
    rows = []
    for cid, az in CAMS:
        cc = cw = cu = 0
        for s in fire:
            t = periodMs * s + az / 360 * periodMs
            truth = periodMs * (s + 1)
            m, best = None, float("inf")
            for q in ts:
                d = q - t
                if direction == "backward" and d > 0:
                    continue
                if direction == "forward" and d < 0:
                    continue
                if direction == "forwardStrict" and d <= 0:
                    continue
                if abs(d) < best:
                    best, m = abs(d), q
            if m is None or best > tolMs:
                cu += 1
            elif m == truth:
                cc += 1
            else:
                cw += 1
        correct += cc
        wrong += cw
        unmatched += cu
        rows.append(dict(id=cid, az=az, correct=cc, wrong=cw, unmatched=cu))
    return dict(direction=direction, tolMs=tolMs, frames=len(CAMS) * len(fire), fireScans=fire,
                correct=correct, wrong=wrong, unmatched=unmatched, cams=rows)


SYNC = {"nearest60": ("nearest", 60), "backward60": ("backward", 60), "forward60": ("forward", 60),
        "forward20": ("forward", 20), "nearest20": ("nearest", 20), "strict60": ("forwardStrict", 60)}


def flat(x, pre=""):
    out = {}
    if isinstance(x, dict):
        for k, v in x.items():
            out.update(flat(v, pre + "." + k))
    elif isinstance(x, list):
        for i, v in enumerate(x):
            out.update(flat(v, pre + "[" + str(i) + "]"))
    else:
        out[pre] = x
    return out


def compare(py, node, plant=0.0):
    fp, fn = flat(py), flat(node)
    worst, bad, n = 0.0, [], 0
    for k, v in fp.items():
        if k not in fn:
            if not k.endswith(".trueRate") or "classes" not in k:
                bad.append("missing in node: " + k)
            continue
        w = fn[k]
        if plant and isinstance(v, float) and k.endswith("matched.upper") and ".canon" in ("." + k):
            v = v * (1 + plant)
        n += 1
        if isinstance(v, bool) or isinstance(v, str) or v is None:
            if v != w:
                bad.append(f"{k}: py {v!r} node {w!r}")
        elif isinstance(v, int) and isinstance(w, int):
            if v != w:
                bad.append(f"{k}: py {v} node {w}")
        else:
            v, w = float(v), float(w)
            d = abs(v - w) / max(abs(v), abs(w)) if max(abs(v), abs(w)) > 1e-12 else abs(v - w)
            worst = max(worst, d)
            if d > 1e-9:
                bad.append(f"{k}: py {v!r} node {w!r} rel {d:.2e}")
    return n, worst, bad


def coverage(trials=2000, conf=0.95):
    """Simulate the exposure-matched bound: share of draws whose upper bound covers the true matched rate."""
    rnd = mulberry32(424242)
    miles = [60e6 * c["share"] for c in CONTEXTS]
    w = [c["humanShare"] for c in CONTEXTS]
    true = sum(w[i] * CONTEXTS[i]["trueRate"] / 1e8 for i in range(4))
    hit = 0
    for _ in range(trials):
        ks = [poisson(miles[i] * CONTEXTS[i]["trueRate"] / 1e8, rnd) for i in range(4)]
        if ffUpper(ks, miles, w, conf)["upper"] >= true:
            hit += 1
    return hit / trials


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    runs = {name: ladder(o, v, a) for name, (o, v, a) in RUNS.items()}
    for name, r in runs.items():
        print(f"{name:11} fatal k {r['fatal']['k']} U {r['fatal']['upper']:.3f} {r['fatal']['verdict']} | own {r['own']['k']} "
              f"{r['own']['point']:.2f} {r['own']['upper']:.2f} {r['own']['verdict']} | matched {r['matched']['point']:.2f} "
              f"{r['matched']['upper']:.2f} {r['matched']['verdict']} | tail IS {r['tail']['point']:.2f} MC {r['tail']['mcPoint']:.2f} "
              f"| +tail {r['withTail']['point']:.2f} {r['withTail']['upper']:.2f} {r['withTail']['verdict']}")
    if "--coverage" in sys.argv:
        print("Fay-Feuer one-sided 95% coverage over 2000 constructed draws at 60M miles:", coverage())
    if "--compare" in sys.argv:
        node = json.load(open(sys.argv[sys.argv.index("--compare") + 1]))
        plant = float(sys.argv[sys.argv.index("--plant") + 1]) if "--plant" in sys.argv else 0.0
        sync = {k: syncToy(d, t) for k, (d, t) in SYNC.items()}
        n, worst, bad = compare({"runs": runs, "sync": sync}, {"runs": node["runs"], "sync": node["sync"]}, plant)
        st_ok = node["selfTest"]["pass"] and all(not f["pass"] for f in node["faultProofs"])
        print(f"compare: {n} values, worst relative diff {worst:.3e}, disagreements {len(bad)}; node selfTest+fault proofs ok: {st_ok}")
        for b in bad[:20]:
            print("  ", b)
        sys.exit(0 if not bad and st_ok else 1)


if __name__ == "__main__":
    main()
