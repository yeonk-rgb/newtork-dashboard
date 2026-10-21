import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Pretendard (OFL-1.1, npm pretendard 정확히 고정) — 외부 CDN 없이 이 서버에서 제공
const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  weight: "45 920",
  display: "swap",
  variable: "--font-pretendard",
});

export const metadata: Metadata = {
  title: "NEWTORK 경영 대시보드",
  description: "뉴토크코리아 사내 경영 대시보드",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
