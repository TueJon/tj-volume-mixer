import React from "react";
import ReactDOM from "react-dom/client";
import Popup from "./Popup";
import "./index.css";
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: "dark",
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <Popup />
    </ThemeProvider>
  </React.StrictMode>
);
