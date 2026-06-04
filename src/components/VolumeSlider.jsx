import React, { useEffect, useRef, useState } from "react";
import { Slider, IconButton, Typography, Box, Tooltip } from "@mui/material";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

const MAX = (typeof window !== "undefined" && window.TJVolumeCore && window.TJVolumeCore.MAX_PERCENT) || 600;
const DEFAULT = (typeof window !== "undefined" && window.TJVolumeCore && window.TJVolumeCore.DEFAULT_PERCENT) || 100;

// Controlled slider: `value` is the source of truth (percent, 0..MAX). Local
// drag state stays in sync with external updates via useEffect.
const VolumeSlider = React.memo(function VolumeSlider({
  tabId,
  value,
  isMuted,
  onLiveChange,
  onCommitChange,
  onToggleMute,
  onReset,
}) {
  const [local, setLocal] = useState(value);
  const dragging = useRef(false);

  // Reflect external changes (storage reload, other tab) unless actively dragging.
  useEffect(() => {
    if (!dragging.current) setLocal(value);
  }, [value]);

  const handleChange = (_e, v) => {
    dragging.current = true;
    setLocal(v);
    onLiveChange(tabId, v);
  };

  const handleCommit = (_e, v) => {
    dragging.current = false;
    setLocal(v);
    onCommitChange(tabId, v);
  };

  const boosted = local > 100;

  return (
    <Box display="flex" alignItems="center" gap={1} width="100%">
      <Tooltip title={isMuted ? "Unmute tab" : "Mute tab"}>
        <IconButton size="small" color={isMuted ? "default" : "primary"} onClick={() => onToggleMute(tabId)}>
          {isMuted ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      <Slider
        value={local}
        valueLabelDisplay="auto"
        valueLabelFormat={(v) => `${v}%`}
        step={5}
        min={0}
        max={MAX}
        marks={[{ value: 100 }]}
        onChange={handleChange}
        onChangeCommitted={handleCommit}
        sx={{ flex: 1, color: boosted ? "warning.main" : "primary.main" }}
      />
      <Typography
        variant="caption"
        sx={{
          width: 40,
          textAlign: "right",
          color: boosted ? "warning.main" : "text.secondary",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {Math.round(local)}%
      </Typography>
      <Tooltip title={`Reset to ${DEFAULT}%`}>
        <span>
          <IconButton size="small" onClick={() => onReset(tabId)} disabled={Math.round(local) === DEFAULT}>
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
});

export default VolumeSlider;
