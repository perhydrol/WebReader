import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App as KonstaApp } from "konsta/react";
import "./styles/konsta.css";
import "./index.css";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

const updateSW = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent("webreader-update-available", {
      detail: () => updateSW(true),
    }));
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <KonstaApp theme="ios" safeAreas={false}><App /></KonstaApp>
    </AppErrorBoundary>
  </StrictMode>,
);
