import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "@/App";
import { GitHubAuthProvider } from "@/hooks/useGitHubAuth";
import { ThemeProvider } from "@/hooks/use-theme";
import { ToastContextProvider } from "@/hooks/use-toast";
import "@/index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 15_000,
      retry: 1,
    },
  },
});

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element #root not found");
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ThemeProvider>
      <GitHubAuthProvider>
        <QueryClientProvider client={queryClient}>
          <ToastContextProvider>
            <App />
          </ToastContextProvider>
        </QueryClientProvider>
      </GitHubAuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
