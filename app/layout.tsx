import type { Metadata } from "next";
import Script from "next/script";
import "katex/dist/katex.min.css";
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
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          data-algoquest-turnstile="true"
        />
        {children}
      </body>
    </html>
  );
}
