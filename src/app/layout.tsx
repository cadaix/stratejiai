import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trade Hub AI - Kripto Sinyal & Backtest Paneli",
  description: "BTC ve SOL fiyatlarını indikatörler ile geriye dönük test (backtest) edip, en iyi çalışan stratejiye göre al-sat sinyalleri üreten gerçek zamanlı kripto takip paneli.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
  }: Readonly<{
    children: React.ReactNode;
  }>) {
  return (
    <html lang="tr">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}

