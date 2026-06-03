// TJ Volume Mixer — pure, side-effect-free helpers.
// No DOM / chrome / Web Audio access here so this file is unit-testable in Node
// and shippable both as a content-script (global `TJVolumeCore` in the isolated
// world) and inside the popup bundle (global `window.TJVolumeCore`).
(function (root) {
  "use strict";

  var MIN_PERCENT = 0;
  var MAX_PERCENT = 600; // allow boosting up to 6x
  var DEFAULT_PERCENT = 100;
  var STORAGE_KEY = "siteVolumes"; // { [origin]: multiplier }  (1 = 100%)
  var LEGACY_KEY = "volumes"; // old shape mixed origin + numeric tabId keys

  function clampPercent(p) {
    if (typeof p !== "number" || isNaN(p)) return DEFAULT_PERCENT;
    if (p < MIN_PERCENT) return MIN_PERCENT;
    if (p > MAX_PERCENT) return MAX_PERCENT;
    return p;
  }

  function clampMultiplier(m) {
    return clampPercent(m * 100) / 100;
  }

  function percentToMultiplier(p) {
    return clampPercent(p) / 100;
  }

  function multiplierToPercent(m) {
    if (typeof m !== "number" || isNaN(m)) return DEFAULT_PERCENT;
    return clampPercent(Math.round(m * 100));
  }

  // Persistence key for a page. Only http(s) origins are persisted; chrome://,
  // file://, about:, etc. return null (handled per-session, never stored).
  function originKey(href) {
    try {
      var u = new URL(href);
      if (u.protocol === "http:" || u.protocol === "https:") return u.origin;
    } catch (e) {
      /* not a valid URL */
    }
    return null;
  }

  // Decide how to apply a multiplier to a single media element.
  //  - Once an element is routed through a GainNode we must keep using gain
  //    (you cannot cleanly revert a MediaElementSource back to el.volume).
  //  - Attenuation only (<= 1x) uses el.volume: no Web Audio, so no risk of
  //    silencing cross-origin media.
  //  - Boost (> 1x) requires a GainNode.
  // Returns { method: "gain"|"volume", value } where value is the gain (0..6)
  // or the volume (0..1) to set.
  function decideApplication(multiplier, hasGainNode) {
    var m = clampMultiplier(multiplier);
    if (hasGainNode) return { method: "gain", value: m };
    if (m <= 1) return { method: "volume", value: m };
    return { method: "gain", value: m };
  }

  // Build the persisted map from raw storage, migrating the legacy shape.
  // Numeric tabId keys from the old format are intentionally dropped — Chrome
  // recycles tab ids across sessions, so they applied stale volumes to new tabs.
  function migrateLegacy(stored) {
    var out = {};
    stored = stored || {};
    function take(src) {
      if (!src || typeof src !== "object") return;
      for (var k in src) {
        if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
        if (k.indexOf("://") === -1) continue; // skip non-origin (tabId) keys
        if (out[k] === undefined) out[k] = clampMultiplier(src[k]);
      }
    }
    take(stored[STORAGE_KEY]); // current shape wins
    take(stored[LEGACY_KEY]); // fall back to migrating old origin keys
    return out;
  }

  var api = {
    MIN_PERCENT: MIN_PERCENT,
    MAX_PERCENT: MAX_PERCENT,
    DEFAULT_PERCENT: DEFAULT_PERCENT,
    STORAGE_KEY: STORAGE_KEY,
    LEGACY_KEY: LEGACY_KEY,
    clampPercent: clampPercent,
    clampMultiplier: clampMultiplier,
    percentToMultiplier: percentToMultiplier,
    multiplierToPercent: multiplierToPercent,
    originKey: originKey,
    decideApplication: decideApplication,
    migrateLegacy: migrateLegacy,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TJVolumeCore = api;
})(typeof self !== "undefined" ? self : this);
