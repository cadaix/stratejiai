"use client";

import { useEffect, useState, useCallback } from "react";
import { Coins, AlertTriangle, Cpu, Activity, Award, Zap, TrendingUp } from "lucide-react";
import { fetchCandles, Candle } from "../utils/binance";
import { runBacktest, BacktestResult, runLeverageBacktest, LeverageBacktestResult } from "../utils/backtester";
import TradingChart from "./TradingChart";
import SignalPanel from "./SignalPanel";
import BacktestPanel from "./BacktestPanel";
import InvestmentSimulator from "./InvestmentSimulator";
import LeverageBacktestPanel from "./LeverageBacktestPanel";

const SYMBOLS = [
  "BTC/USDT",
  "SOL/USDT",
  "PAXG/USDT",
];
const TIMEFRAMES = ["15m", "1h", "4h", "1d", "1w", "1M", "1y", "5y"];

export default function CryptoDashboard() {
  const [selectedSymbol, setSelectedSymbol] = useState("BTC/USDT");
  const [selectedTimeframe, setSelectedTimeframe] = useState("15m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [backtestResults, setBacktestResults] = useState<BacktestResult[]>([]);
  const [leverageResults, setLeverageResults] = useState<LeverageBacktestResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState("signals");

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);


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

      // Load all 5 leverage timeframes in parallel
      const leverageTimeframes = ["15m", "1h", "4h", "1d", "1w"];
      const levPromises = leverageTimeframes.map(async (tf) => {
        const limit = tf === "1d" ? 1000 : (tf === "1w" ? 300 : 500);
        const tfCandles = await fetchCandles(selectedSymbol, tf, limit);
        return runLeverageBacktest(tf, tfCandles, 10000, 100, 10);
      });

      const levResults = await Promise.all(levPromises);
      setLeverageResults(levResults);

      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : "Binance veri akışında bir hata oluştu.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSymbol, selectedTimeframe]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;

  const bestStrategy =
    backtestResults.length > 0
      ? [...backtestResults].sort((a, b) => b.netProfit - a.netProfit)[0]
      : null;
  const trades = bestStrategy ? bestStrategy.tradeHistory : [];

  if (mounted && isMobile) {
    return (
      <div className="mobile-app-layout">
        {/* Top App Header */}
        <header className="mobile-header">
          <div className="mobile-header-brand">
            <Cpu className="logo-icon" size={22} />
            <h1>Trade Hub AI</h1>
          </div>
          {/* Compact Asset Selector */}
          <div className="mobile-header-actions">
            <div className="tabs-container" style={{ padding: "2px" }}>
              {SYMBOLS.map((sym) => (
                <button
                  key={sym}
                  className={`tab-btn ${selectedSymbol === sym ? "active" : ""}`}
                  style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
                  onClick={() => setSelectedSymbol(sym)}
                >
                  {sym === "PAXG/USDT" ? "ONS" : sym.replace("/USDT", "")}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Timeframe Swiper Sub-Header */}
        <div className="mobile-timeframe-bar">
          <div className="tabs-container" style={{ width: "100%", overflowX: "auto", display: "flex", gap: "2px", padding: "2px" }}>
            {TIMEFRAMES.map((tf) => {
              const labelMap: { [key: string]: string } = {
                "15m": "15dk",
                "1h": "1sa",
                "4h": "4sa",
                "1d": "Gün",
                "1w": "Haf",
                "1M": "Ay",
                "1y": "Yıl",
                "5y": "5Y",
              };
              return (
                <button
                  key={tf}
                  className={`tab-btn ${selectedTimeframe === tf ? "active" : ""}`}
                  style={{ padding: "0.35rem 0.5rem", fontSize: "0.75rem", flex: 1, minWidth: "40px", textAlign: "center" }}
                  onClick={() => setSelectedTimeframe(tf)}
                >
                  {labelMap[tf] || tf}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Content View */}
        <main className="mobile-content-area">
          {error && (
            <div
              className="glass-panel"
              style={{
                borderColor: "var(--color-sell)",
                background: "rgba(239, 68, 68, 0.05)",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.75rem",
                borderRadius: "var(--border-radius-md)",
              }}
            >
              <AlertTriangle color="var(--color-sell)" size={18} />
              <span style={{ color: "var(--color-sell)", fontWeight: 500, fontSize: "0.8rem" }}>{error}</span>
            </div>
          )}

          {isLoading ? (
            <div
              style={{
                display: "flex",
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
                minHeight: "350px",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <div
                className="spin-animation"
                style={{
                  width: "36px",
                  height: "36px",
                  border: "3px solid rgba(99, 102, 241, 0.1)",
                  borderTopColor: "var(--accent-primary)",
                  borderRadius: "50%",
                }}
              />
              <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>Binance verileri çekiliyor...</span>
            </div>
          ) : (
            <>
              {activeTab === "signals" && (
                <SignalPanel
                  symbol={selectedSymbol}
                  timeframe={selectedTimeframe}
                  currentPrice={currentPrice}
                  results={backtestResults}
                  onRefresh={loadData}
                  isLoading={isLoading}
                  lastUpdated={lastUpdated}
                />
              )}

              {activeTab === "chart" && (
                <div className="glass-panel" style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div className="chart-header-row" style={{ padding: "0 0.25rem" }}>
                    <h3
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                      }}
                    >
                      <Coins size={16} style={{ color: "var(--accent-primary)" }} />
                      <span>Teknik Analiz Grafiği</span>
                    </h3>
                    {bestStrategy && (
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                        Sinyaller: <strong style={{ color: "var(--text-primary)" }}>{bestStrategy.strategyName}</strong>
                      </span>
                    )}
                  </div>

                  <div className="chart-container-wrapper" style={{ height: "calc(100vh - 270px)", minHeight: "350px" }}>
                    <TradingChart
                      data={candles}
                      trades={trades}
                      symbol={selectedSymbol}
                      timeframe={selectedTimeframe}
                    />
                  </div>
                </div>
              )}

              {activeTab === "backtest" && (
                <BacktestPanel results={backtestResults} />
              )}

              {activeTab === "simulator" && backtestResults.length > 0 && (
                <InvestmentSimulator results={backtestResults} symbol={selectedSymbol} />
              )}

              {activeTab === "leverage" && leverageResults.length > 0 && (
                <LeverageBacktestPanel results={leverageResults} symbol={selectedSymbol} />
              )}
            </>
          )}
        </main>

        {/* Fixed Bottom Navigation */}
        <nav className="mobile-bottom-nav">
          <button
            className={`mobile-nav-item ${activeTab === "signals" ? "active" : ""}`}
            onClick={() => setActiveTab("signals")}
          >
            <div className="mobile-nav-icon">
              <Activity size={20} />
            </div>
            <span className="mobile-nav-label">Sinyaller</span>
          </button>

          <button
            className={`mobile-nav-item ${activeTab === "chart" ? "active" : ""}`}
            onClick={() => setActiveTab("chart")}
          >
            <div className="mobile-nav-icon">
              <TrendingUp size={20} />
            </div>
            <span className="mobile-nav-label">Grafik</span>
          </button>

          <button
            className={`mobile-nav-item ${activeTab === "backtest" ? "active" : ""}`}
            onClick={() => setActiveTab("backtest")}
          >
            <div className="mobile-nav-icon">
              <Award size={20} />
            </div>
            <span className="mobile-nav-label">Sıralama</span>
          </button>

          <button
            className={`mobile-nav-item ${activeTab === "simulator" ? "active" : ""}`}
            onClick={() => setActiveTab("simulator")}
          >
            <div className="mobile-nav-icon">
              <Coins size={20} />
            </div>
            <span className="mobile-nav-label">Simülatör</span>
          </button>

          <button
            className={`mobile-nav-item ${activeTab === "leverage" ? "active" : ""}`}
            onClick={() => setActiveTab("leverage")}
          >
            <div className="mobile-nav-icon">
              <Zap size={20} />
            </div>
            <span className="mobile-nav-label">Kaldıraç</span>
          </button>
        </nav>
      </div>
    );
  }

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
                {sym === "PAXG/USDT" ? "ONS (Altın)" : sym.replace("/USDT", "")}
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
                "5y": "5 Yıl (Gün)",
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
            <div className="chart-header-row" style={{ marginBottom: "1rem", padding: "0 0.5rem" }}>
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

          {/* Leverage Simulator */}
          {!isLoading && leverageResults.length > 0 && (
            <LeverageBacktestPanel results={leverageResults} symbol={selectedSymbol} />
          )}
        </div>
      </div>
    </div>
  );
}
