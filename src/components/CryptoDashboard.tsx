"use client";

import { useEffect, useState, useCallback } from "react";
import { Coins, AlertTriangle, Cpu } from "lucide-react";
import { fetchCandles, Candle } from "../utils/binance";
import { runBacktest, BacktestResult } from "../utils/backtester";
import TradingChart from "./TradingChart";
import SignalPanel from "./SignalPanel";
import BacktestPanel from "./BacktestPanel";
import InvestmentSimulator from "./InvestmentSimulator";

const SYMBOLS = [
  "BTC/USDT",
  "ETH/USDT",
  "BNB/USDT",
  "SOL/USDT",
  "ADA/USDT",
  "XRP/USDT",
  "DOGE/USDT",
];
const TIMEFRAMES = ["15m", "1h", "4h", "1d", "1w", "1M", "1y"];

export default function CryptoDashboard() {
  const [selectedSymbol, setSelectedSymbol] = useState("BTC/USDT");
  const [selectedTimeframe, setSelectedTimeframe] = useState("15m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [backtestResults, setBacktestResults] = useState<BacktestResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCandles(selectedSymbol, selectedTimeframe, 500);
      if (data.length === 0) {
        throw new Error("Veri bulunamadı. Lütfen daha sonra tekrar deneyin.");
      }

      setCandles(data);

      const results = runBacktest(data);
      setBacktestResults(results);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Binance veri akışında bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedSymbol, selectedTimeframe]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;

  const bestStrategy =
    backtestResults.length > 0
      ? [...backtestResults].sort((a, b) => b.netProfit - a.netProfit)[0]
      : null;
  const trades = bestStrategy ? bestStrategy.tradeHistory : [];

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <Cpu className="logo-icon" size={28} />
          <h1>Selahattin Serkan Bayar</h1>
        </div>
        <div className="header-status">
          {/* Symbol Selectors */}
          <div className="tabs-container">
            {SYMBOLS.map((sym) => (
              <button
                key={sym}
                className={`tab-btn ${selectedSymbol === sym ? "active" : ""}`}
                onClick={() => setSelectedSymbol(sym)}
              >
                {sym.replace("/USDT", "")}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Timeframe Selector Panel */}
      <div className="glass-panel" style={{ padding: "0.75rem 1.5rem" }}>
        <div className="flex-row-between" style={{ flexWrap: "wrap", gap: "1rem" }}>
          <span style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-secondary)" }}>
            Zaman Dilimi:
          </span>
          <div className="tabs-container">
            {TIMEFRAMES.map((tf) => {
              const labelMap: { [key: string]: string } = {
                "15m": "15dk",
                "1h": "1sa",
                "4h": "4sa",
                "1d": "Gün",
                "1w": "Haf",
                "1M": "Ay",
                "1y": "Yıl (Sim.)",
              };
              return (
                <button
                  key={tf}
                  className={`tab-btn ${selectedTimeframe === tf ? "active" : ""}`}
                  onClick={() => setSelectedTimeframe(tf)}
                >
                  {labelMap[tf] || tf}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div
          className="glass-panel"
          style={{
            borderColor: "var(--color-sell)",
            background: "rgba(239, 68, 68, 0.05)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <AlertTriangle color="var(--color-sell)" />
          <span style={{ color: "var(--color-sell)", fontWeight: 500 }}>{error}</span>
        </div>
      )}

      {/* Dashboard Main Grid */}
      <div className="dashboard-grid">
        {/* Left Side: Signal Info */}
        <SignalPanel
          symbol={selectedSymbol}
          timeframe={selectedTimeframe}
          currentPrice={currentPrice}
          results={backtestResults}
          onRefresh={loadData}
          isLoading={isLoading}
          lastUpdated={lastUpdated}
        />

        {/* Right Side: Chart & Performance Metrics */}
        <div className="flex-column" style={{ gap: "1.5rem" }}>
          {/* Chart Section */}
          <div className="glass-panel" style={{ padding: "1rem" }}>
            <div className="flex-row-between" style={{ marginBottom: "1rem", padding: "0 0.5rem" }}>
              <h3
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <Coins size={20} style={{ color: "var(--accent-primary)" }} />
                <span>Teknik Analiz Grafiği</span>
              </h3>
              {bestStrategy && (
                <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                  Sinyaller:{" "}
                  <strong style={{ color: "var(--text-primary)" }}>
                    {bestStrategy.strategyName}
                  </strong>
                </span>
              )}
            </div>

            <div className="chart-container-wrapper">
              {isLoading ? (
                <div
                  style={{
                    display: "flex",
                    width: "100%",
                    height: "100%",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-secondary)",
                  }}
                >
                  Veriler yükleniyor...
                </div>
              ) : (
                <TradingChart
                  data={candles}
                  trades={trades}
                  symbol={selectedSymbol}
                  timeframe={selectedTimeframe}
                />
              )}
            </div>
          </div>

          {/* Backtest Section */}
          {!isLoading && <BacktestPanel results={backtestResults} />}

          {/* Investment Simulator */}
          {!isLoading && backtestResults.length > 0 && (
            <InvestmentSimulator results={backtestResults} symbol={selectedSymbol} />
          )}
        </div>
      </div>
    </div>
  );
}
