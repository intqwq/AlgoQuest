import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
