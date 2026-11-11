import "./config/tokens.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { exposeDemoApi } from "./services/demoApi";
import { queryClient } from "./services/query";

const root = document.getElementById("root");
if (!root) throw new Error("Missing Plume Light root element");

exposeDemoApi();
createRoot(root).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
