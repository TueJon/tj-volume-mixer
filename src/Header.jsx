import { Box, Typography, Divider } from "@mui/material";

function Header() {
  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1.5, py: 1.25 }}>
        <img src="/logo/logo-128.png" alt="TJ Volume Mixer" height="34" style={{ borderRadius: "6px" }} />
        <Typography variant="h6" sx={{ fontSize: "1.05rem", fontWeight: 600 }}>
          Volume Mixer
        </Typography>
      </Box>
      <Divider />
    </>
  );
}

export default Header;
