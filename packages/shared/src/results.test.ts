import { describe, expect, it } from "bun:test";
import { computeResults } from "./results";
import type { Marker } from "./markers";

let seq = 0;
const mk = (kind: Marker["kind"], tSeconds: number, over: Partial<Marker> = {}): Marker => ({
  id: `m${seq++}`,
  videoId: "v",
  kind,
  tSeconds,
  confidence: kind === "shot" ? 0.9 : 0.95,
  source: "auto",
  isIgnored: false,
  createdAt: "",
  updatedAt: "",
  ...over,
});

describe("computeResults", () => {
  it("anchors on the beep and computes splits/first/total", () => {
    const markers = [mk("beep", 1.0), mk("shot", 2.0), mk("shot", 2.3), mk("shot", 2.9)];
    const r = computeResults(markers);
    expect(r.anchorSource).toBe("beep");
    expect(r.anchorT).toBe(1.0);
    expect(r.shotCount).toBe(3);
    expect(r.firstShot).toBeCloseTo(1.0); // 2.0 - 1.0
    expect(r.totalTime).toBeCloseTo(1.9); // 2.9 - 1.0
    expect(r.shots[0].split).toBeNull();
    expect(r.shots[1].split).toBeCloseTo(0.3);
    expect(r.shots[2].split).toBeCloseTo(0.6);
    expect(r.fastestSplit).toEqual({ index: 2, value: r.shots[1].split! });
    expect(r.slowestSplit?.index).toBe(3);
  });

  it("excludes ignored shots from counting and splits", () => {
    const markers = [mk("beep", 1.0), mk("shot", 2.0), mk("shot", 2.3, { isIgnored: true }), mk("shot", 2.9)];
    const r = computeResults(markers);
    expect(r.shotCount).toBe(2);
    expect(r.shots.map((s) => s.tSeconds)).toEqual([2.0, 2.9]);
    expect(r.shots[1].split).toBeCloseTo(0.9); // 2.9 - 2.0, skipping the ignored one
  });

  it("falls back to the first shot when there is no beep", () => {
    const markers = [mk("shot", 5.0), mk("shot", 5.5)];
    const r = computeResults(markers);
    expect(r.anchorSource).toBe("first-shot");
    expect(r.anchorT).toBe(5.0);
    expect(r.firstShot).toBe(0);
    expect(r.totalTime).toBeCloseTo(0.5);
  });

  it("honours an explicit anchor override over a detected beep", () => {
    const markers = [mk("beep", 1.0), mk("shot", 2.0)];
    const r = computeResults(markers, { anchorOverride: 1.5 });
    expect(r.anchorSource).toBe("manual");
    expect(r.firstShot).toBeCloseTo(0.5);
  });

  it("sorts out-of-order markers before computing", () => {
    const markers = [mk("shot", 2.9), mk("shot", 2.0), mk("beep", 1.0)];
    const r = computeResults(markers);
    expect(r.shots.map((s) => s.tSeconds)).toEqual([2.0, 2.9]);
  });

  it("handles an empty / no-shot stage", () => {
    const r = computeResults([mk("beep", 1.0)]);
    expect(r.shotCount).toBe(0);
    expect(r.firstShot).toBeNull();
    expect(r.totalTime).toBeNull();
    expect(r.fastestSplit).toBeNull();
  });
});
