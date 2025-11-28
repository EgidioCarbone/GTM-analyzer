import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ContainerProvider } from "./context/ContainerContext";
import { LanguageProvider } from "./context/LanguageContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <ContainerProvider>
          <App />
        </ContainerProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>
);
