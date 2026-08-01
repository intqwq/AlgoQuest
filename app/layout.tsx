import type { Metadata } from "next";
import Script from "next/script";
import "katex/dist/katex.min.css";
import { LearningSystemDock } from "@/components/learning-system-dock";
import "./globals.css";
import "./turnstile-fix.css";

export const metadata: Metadata = {
  title: "AlgoQuest // Learn. Code. Conquer.",
  description:
    "A branching competitive-programming adventure from first output to advanced algorithms.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

const authenticatedQuestCatalogBridge = `
(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!raw.includes("/api/v1/quests")) return originalFetch(input, init);
    const token = window.localStorage.getItem("algoquest.session-token");
    if (!token) return originalFetch(input, init);
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    if (!headers.has("authorization")) headers.set("authorization", "Bearer " + token);
    return originalFetch(input, { ...init, headers });
  };
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://challenges.cloudflare.com" />
      </head>
      <body>
        <Script id="algoquest-authenticated-quest-catalog" strategy="beforeInteractive">
          {authenticatedQuestCatalogBridge}
        </Script>
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          data-algoquest-turnstile="true"
        />
        {children}
        <LearningSystemDock />
      </body>
    </html>
  );
}
