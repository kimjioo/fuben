import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "炸鸡团 · 黑本记录册",
  description: "为炸鸡团黑本统计设计的独立副本掉落录入网页。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
