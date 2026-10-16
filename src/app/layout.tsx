import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEWTORK 경영 대시보드",
  description: "뉴토크코리아 사내 경영 대시보드",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
