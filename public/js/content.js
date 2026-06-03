// TJ Volume Mixer — content script.
// Runs in every frame (manifest all_frames). Applies the saved per-origin
// volume/boost to all media elements and keeps them in sync with the popup.
(function () {
  "use strict";

  var Core = typeof TJVolumeCore !== "undefined" ? TJVolumeCore : self.TJVolumeCore;
  if (!Core) {
    console.error("[TJ Volume Mixer] core helpers missing — content script aborting");
    return;
  }

  var SAVE_DEBOUNCE_MS = 250;
  var DEBUG = false;

  var origin = Core.originKey(location.href);
  var multiplier = 1; // 1 = 100%
  var applying = false; // guard against our own volumechange events
  var saveTimer = null;

  var audioCtx = null;
  var gainNodes = new WeakMap(); // mediaEl -> { source, gain }

  function log() {
    if (DEBUG) console.log.apply(console, ["[TJ Volume Mixer]"].concat([].slice.call(arguments)));
  }

  function isMedia(el) {
    return el && (el.tagName === "AUDIO" || el.tagName === "VIDEO");
  }

  function ensureCtx() {
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      try {
        audioCtx = new Ctx();
      } catch (e) {
        log("AudioContext unavailable", e);
        return null;
      }
    }
    if (audioCtx.state === "suspended") audioCtx.resume().catch(function () {});
    return audioCtx;
  }

  // Lazily route an element through a GainNode. Returns the gain node or null
  // (when Web Audio is unavailable, the element is already wired, or the media
  // is cross-origin and would be tainted — caller falls back to el.volume).
  function getGain(el) {
    var existing = gainNodes.get(el);
    if (existing) return existing.gain;
    var ctx = ensureCtx();
    if (!ctx) return null;
    try {
      var source = ctx.createMediaElementSource(el);
      var gain = ctx.createGain();
      source.connect(gain);
      gain.connect(ctx.destination);
      gainNodes.set(el, { source: source, gain: gain });
      el.volume = 1; // gain governs level from now on
      log("gain node attached");
      return gain;
    } catch (e) {
      log("createMediaElementSource failed:", e && e.name);
      return null;
    }
  }

  function attachListener(el) {
    if (el.dataset.tjvmListener) return;
    el.dataset.tjvmListener = "1";
    el.addEventListener("volumechange", onVolumeChange);
  }

  function applyToElement(el) {
    var plan = Core.decideApplication(multiplier, gainNodes.has(el));
    applying = true;
    try {
      if (plan.method === "gain") {
        var g = getGain(el);
        if (g) g.gain.value = plan.value;
        else el.volume = Math.min(plan.value, 1); // boost impossible -> cap at 100%
      } else {
        el.volume = plan.value;
      }
    } catch (e) {
      log("apply error", e);
    }
    applying = false;
    attachListener(el);
  }

  function applyAll() {
    var media = document.querySelectorAll("audio, video");
    for (var i = 0; i < media.length; i++) applyToElement(media[i]);
  }

  // Track manual volume changes made on the page itself (e.g. YouTube slider),
  // but only while we're NOT routing through a gain node (gain decouples
  // el.volume from the audible level, so it's no longer a reliable signal).
  function onVolumeChange(e) {
    if (applying || gainNodes.has(e.target)) return;
    var v = e.target.volume;
    if (Math.abs(v - multiplier) < 0.01) return;
    multiplier = v;
    save();
  }

  function save() {
    if (!origin) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      chrome.storage.local.get(Core.STORAGE_KEY, function (res) {
        var map = (res && res[Core.STORAGE_KEY]) || {};
        map[origin] = multiplier;
        var payload = {};
        payload[Core.STORAGE_KEY] = map;
        chrome.storage.local.set(payload);
      });
    }, SAVE_DEBOUNCE_MS);
  }

  function load(done) {
    chrome.storage.local.get([Core.STORAGE_KEY, Core.LEGACY_KEY], function (res) {
      var map = Core.migrateLegacy(res || {});
      if (origin && map[origin] !== undefined) multiplier = map[origin];
      if (done) done();
    });
  }

  // Persisted updates from the popup commit or another same-origin tab.
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local" || !changes[Core.STORAGE_KEY]) return;
    var nv = changes[Core.STORAGE_KEY].newValue || {};
    if (origin && nv[origin] !== undefined && nv[origin] !== multiplier) {
      multiplier = nv[origin];
      applyAll();
    }
  });

  // Live preview while the popup slider is being dragged (not yet persisted).
  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg && msg.action === "tjvm:preview" && typeof msg.multiplier === "number") {
      multiplier = msg.multiplier;
      applyAll();
    }
  });

  // Catch media elements added after load.
  var observer = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var added = mutations[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var node = added[j];
        if (node.nodeType !== 1) continue;
        if (isMedia(node)) applyToElement(node);
        if (node.querySelectorAll) {
          var kids = node.querySelectorAll("audio, video");
          for (var k = 0; k < kids.length; k++) applyToElement(kids[k]);
        }
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener(
    "loadedmetadata",
    function (e) {
      if (isMedia(e.target)) applyToElement(e.target);
    },
    true
  );
  document.addEventListener(
    "canplay",
    function (e) {
      if (isMedia(e.target)) applyToElement(e.target);
    },
    true
  );

  // SPA navigation: re-load settings if the origin changes.
  function onNavigate() {
    var next = Core.originKey(location.href);
    if (next !== origin) {
      origin = next;
      multiplier = 1;
      load(applyAll);
    }
  }
  window.addEventListener("popstate", onNavigate);
  var _push = history.pushState;
  history.pushState = function () {
    _push.apply(this, arguments);
    onNavigate();
  };
  var _replace = history.replaceState;
  history.replaceState = function () {
    _replace.apply(this, arguments);
    onNavigate();
  };

  // Autoplay policy: a suspended AudioContext resumes on the first user gesture.
  ["click", "keydown", "touchstart"].forEach(function (ev) {
    window.addEventListener(
      ev,
      function () {
        if (audioCtx && audioCtx.state === "suspended") audioCtx.resume().catch(function () {});
      },
      { once: true, capture: true }
    );
  });

  load(applyAll);
  log("content script ready; origin =", origin);
})();
