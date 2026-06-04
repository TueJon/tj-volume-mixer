import React, { useCallback, useEffect, useState } from "react";
import {
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  Typography,
  Box,
  CircularProgress,
} from "@mui/material";
import "./popup.css";
import Header from "./Header";
import VolumeSlider from "./components/VolumeSlider";

const Core = (typeof window !== "undefined" && window.TJVolumeCore) || {
  STORAGE_KEY: "siteVolumes",
  LEGACY_KEY: "volumes",
  DEFAULT_PERCENT: 100,
  originKey: () => null,
  migrateLegacy: () => ({}),
  percentToMultiplier: (p) => p / 100,
  multiplierToPercent: (m) => Math.round(m * 100),
};

// Persistence key for a tab: its origin (http/https) or a session-only tab key.
function keyForTab(tab) {
  const origin = tab.url ? Core.originKey(tab.url) : null;
  return origin || `tab:${tab.id}`;
}
function isPersistent(key) {
  return key.indexOf("://") !== -1;
}

export default function Popup() {
  const [tabs, setTabs] = useState([]);
  const [loading, setLoading] = useState(true);
  // multipliers keyed by origin (persisted) or `tab:<id>` (session only)
  const [volumes, setVolumes] = useState({});
  const [muteStates, setMuteStates] = useState({});

  // Detect tabs that have media and load persisted per-site volumes.
  useEffect(() => {
    let cancelled = false;
    chrome.storage.local.get([Core.STORAGE_KEY, Core.LEGACY_KEY], (stored) => {
      const persisted = Core.migrateLegacy(stored || {});
      chrome.tabs.query({}, (allTabs) => {
        const checks = allTabs.map(
          (tab) =>
            new Promise((resolve) => {
              if (tab.audible) return resolve({ tab, hasMedia: true });
              chrome.scripting.executeScript(
                {
                  target: { tabId: tab.id, allFrames: true },
                  func: () => {
                    const m = document.querySelectorAll("audio, video");
                    for (const el of m) {
                      if ((el.currentSrc && el.currentSrc.trim()) || (el.src && el.src.trim())) return true;
                    }
                    return false;
                  },
                },
                (results) => {
                  if (chrome.runtime.lastError || !results) return resolve({ tab, hasMedia: false });
                  const hasMedia = results.some((r) => r && r.result);
                  resolve({ tab, hasMedia });
                }
              );
            })
        );
        Promise.all(checks).then((res) => {
          if (cancelled) return;
          const mediaTabs = res.filter((r) => r.hasMedia).map((r) => r.tab);
          const vol = { ...persisted };
          const mutes = {};
          mediaTabs.forEach((tab) => {
            mutes[tab.id] = tab.mutedInfo ? tab.mutedInfo.muted : false;
          });
          setVolumes(vol);
          setMuteStates(mutes);
          setTabs(mediaTabs);
          setLoading(false);
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const percentForTab = useCallback(
    (tab) => {
      const key = keyForTab(tab);
      const m = volumes[key];
      return m === undefined ? Core.DEFAULT_PERCENT : Core.multiplierToPercent(m);
    },
    [volumes]
  );

  // Live preview while dragging — message all frames' content scripts.
  const handleLive = useCallback((tabId, percent) => {
    chrome.tabs.sendMessage(tabId, { action: "tjvm:preview", multiplier: Core.percentToMultiplier(percent) }, () => {
      void chrome.runtime.lastError; // tab may have no content script (e.g. chrome://)
    });
  }, []);

  // Commit — persist per origin (http/https) and reflect in state.
  const handleCommit = useCallback(
    (tabId, percent) => {
      const multiplier = Core.percentToMultiplier(percent);
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) return;
        const key = keyForTab(tab);
        if (isPersistent(key)) {
          chrome.storage.local.get(Core.STORAGE_KEY, (res) => {
            const map = (res && res[Core.STORAGE_KEY]) || {};
            map[key] = multiplier;
            chrome.storage.local.set({ [Core.STORAGE_KEY]: map });
          });
        } else {
          // non-http(s): can't persist; keep applying for this session only
          handleLive(tabId, percent);
        }
        setVolumes((prev) => ({ ...prev, [key]: multiplier }));
      });
    },
    [handleLive]
  );

  const handleReset = useCallback(
    (tabId) => {
      handleLive(tabId, Core.DEFAULT_PERCENT);
      handleCommit(tabId, Core.DEFAULT_PERCENT);
    },
    [handleLive, handleCommit]
  );

  const handleToggleMute = useCallback((tabId) => {
    setMuteStates((prev) => {
      const next = !prev[tabId];
      chrome.tabs.update(tabId, { muted: next });
      return { ...prev, [tabId]: next };
    });
  }, []);

  return (
    <Box sx={{ minWidth: 340, maxWidth: 420 }}>
      <Header />
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : tabs.length === 0 ? (
        <Box sx={{ px: 2, py: 4, textAlign: "center" }}>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            No tab is playing audio.
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.55 }}>
            Start media in a tab, then reopen this popup.
          </Typography>
        </Box>
      ) : (
        <div className="list-container">
          <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {tabs.map((tab) => {
              const key = keyForTab(tab);
              return (
                <ListItem key={tab.id} className="list-item" disablePadding sx={{ flexDirection: "column", alignItems: "stretch", py: 0.5 }}>
                  <Box display="flex" alignItems="center" gap={1} sx={{ minWidth: 0, mb: 0.5 }}>
                    <ListItemAvatar sx={{ minWidth: 28 }}>
                      <Avatar sx={{ width: 22, height: 22 }} variant="rounded" src={tab.favIconUrl || undefined}>
                        {(tab.title || tab.url || "?").slice(0, 1)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={tab.title || tab.url}
                      secondary={isPersistent(key) ? new URL(tab.url).host : "this session only"}
                      primaryTypographyProps={{
                        noWrap: true,
                        sx: { fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis" },
                      }}
                      secondaryTypographyProps={{ noWrap: true, sx: { fontSize: "0.7rem", opacity: 0.55 } }}
                    />
                  </Box>
                  <VolumeSlider
                    tabId={tab.id}
                    value={percentForTab(tab)}
                    isMuted={muteStates[tab.id]}
                    onLiveChange={handleLive}
                    onCommitChange={handleCommit}
                    onToggleMute={handleToggleMute}
                    onReset={handleReset}
                  />
                </ListItem>
              );
            })}
          </List>
        </div>
      )}
      <Box sx={{ p: 1, textAlign: "center", opacity: 0.6 }}>
        <Typography variant="caption">
          v{chrome.runtime.getManifest ? chrome.runtime.getManifest().version : ""} · drag past 100% to boost
        </Typography>
      </Box>
    </Box>
  );
}
