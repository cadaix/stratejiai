import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trade Hub AI - Kripto Sinyal & Backtest Paneli",
  description: "BTC ve SOL fiyatlarını indikatörler ile geriye dönük test (backtest) edip, en iyi çalışan stratejiye göre al-sat sinyalleri üreten gerçek zamanlı kripto takip paneli.",
};

export default function RootLayout({
  children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
  return (
    <html lang="tr">
      <body>
        {children}
      </body>
    </html>
  );
}

