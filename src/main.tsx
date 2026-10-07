import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import { DemoSessionProvider } from "./auth/DemoSessionProvider";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <DemoSessionProvider>
        <App />
      </DemoSessionProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
