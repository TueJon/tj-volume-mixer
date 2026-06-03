"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../public/js/volume-core.js");

test("clampPercent bounds and NaN handling", () => {
  assert.equal(Core.clampPercent(50), 50);
  assert.equal(Core.clampPercent(-10), 0);
  assert.equal(Core.clampPercent(9999), Core.MAX_PERCENT);
  assert.equal(Core.clampPercent("x"), Core.DEFAULT_PERCENT);
  assert.equal(Core.clampPercent(NaN), Core.DEFAULT_PERCENT);
});

test("percent <-> multiplier round trip", () => {
  assert.equal(Core.percentToMultiplier(100), 1);
  assert.equal(Core.percentToMultiplier(300), 3);
  assert.equal(Core.multiplierToPercent(0.5), 50);
  assert.equal(Core.multiplierToPercent(6), 600);
  assert.equal(Core.multiplierToPercent(99), Core.MAX_PERCENT); // clamped
});

test("originKey only persists http(s) origins", () => {
  assert.equal(Core.originKey("https://youtube.com/watch?v=1"), "https://youtube.com");
  assert.equal(Core.originKey("http://example.com:8080/a"), "http://example.com:8080");
  assert.equal(Core.originKey("chrome://extensions"), null);
  assert.equal(Core.originKey("file:///tmp/x.html"), null);
  assert.equal(Core.originKey("about:blank"), null);
  assert.equal(Core.originKey("not a url"), null);
});

test("decideApplication: attenuation uses el.volume, no Web Audio", () => {
  const p = Core.decideApplication(0.4, false);
  assert.deepEqual(p, { method: "volume", value: 0.4 });
});

test("decideApplication: boost requires a gain node", () => {
  const p = Core.decideApplication(2.5, false);
  assert.deepEqual(p, { method: "gain", value: 2.5 });
});

test("decideApplication: once on gain, stay on gain even for <=1", () => {
  const p = Core.decideApplication(0.3, true);
  assert.deepEqual(p, { method: "gain", value: 0.3 });
});

test("decideApplication clamps boost to MAX", () => {
  const p = Core.decideApplication(50, false); // 5000%
  assert.equal(p.method, "gain");
  assert.equal(p.value, Core.MAX_PERCENT / 100);
});

test("migrateLegacy drops numeric tabId keys, keeps origin keys", () => {
  const out = Core.migrateLegacy({
    volumes: {
      "https://a.com": 0.5,
      "https://b.com": 2, // boost preserved
      123: 0.7, // recycled tabId — must be dropped
      456: 0.2,
    },
  });
  assert.deepEqual(out, { "https://a.com": 0.5, "https://b.com": 2 });
});

test("migrateLegacy: new siteVolumes shape wins over legacy", () => {
  const out = Core.migrateLegacy({
    siteVolumes: { "https://a.com": 0.8 },
    volumes: { "https://a.com": 0.1, "https://c.com": 0.3 },
  });
  assert.equal(out["https://a.com"], 0.8); // current shape preferred
  assert.equal(out["https://c.com"], 0.3); // legacy-only origin migrated
});

test("migrateLegacy clamps out-of-range legacy values", () => {
  const out = Core.migrateLegacy({ volumes: { "https://a.com": 99 } });
  assert.equal(out["https://a.com"], Core.MAX_PERCENT / 100);
});

test("migrateLegacy tolerates empty / malformed input", () => {
  assert.deepEqual(Core.migrateLegacy(null), {});
  assert.deepEqual(Core.migrateLegacy({}), {});
  assert.deepEqual(Core.migrateLegacy({ volumes: null }), {});
});
