"use client";

import { useState } from "react";
import { Activity, Clock } from "lucide-react";
import { LeverageBacktestResult } from "../utils/backtester";

interface LeverageBacktestPanelProps {
  results: LeverageBacktestResult[];
  symbol: string;
}

export default function LeverageBacktestPanel({ results, symbol }: LeverageBacktestPanelProps) {
  const [activeTab, setActiveTab] = useState<string>("all");

  const timeframeLabels: { [key: string]: string } = {
    "15m": "15 Dakika",
    "1h": "1 Saat",
    "4h": "4 Saat",
    "1d": "Günlük",
    "1w": "Haftalık",
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(val);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("tr-TR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const allTrades = results.flatMap((r) => r.tradeHistory.map((t) => ({ ...t, timeframe: r.timeframe })));
  const sortedTrades = [...allTrades].sort((a, b) => b.exitTime - a.exitTime);

  const filteredTrades = activeTab === "all" 
    ? sortedTrades 
    : sortedTrades.filter((t) => t.timeframe === activeTab);

  return (
    <div className="glass-panel" style={{ marginTop: "1.5rem" }}>
      <h3
        style={{
          fontSize: "1.10rem",
          fontWeight: 600,
          marginBottom: "1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <Activity size={20} style={{ color: "var(--accent-primary)" }} />
        <span>Kaldıraçlı Bot Simülatörü (10x Kaldıraç, 100$ Marjin)</span>
      </h3>

      <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "1.25rem", lineHeight: "1.4" }}>
        Yapay zeka modelimizin ürettiği sinyallere göre <strong>10,000$ Demo Bakiye</strong> ile her zaman dilimi için bağımsız <strong>10x kaldıraçlı (100$ Marjin)</strong> işlemler açılır. ATR tabanlı dinamik Stop Loss ve Kar durumunda otomatik İz Süren Stop (Trailing Stop) uygulanır.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {results.map((res) => {
          const pos = res.currentPosition;
          const isPosActive = pos.isActive;
          const pnlColor = res.netProfit >= 0 ? "var(--color-buy)" : "var(--color-sell)";
          
          return (
            <div
              key={res.timeframe}
              style={{
                padding: "1rem",
                borderRadius: "var(--border-radius-md)",
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--border-color)",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>
                  {timeframeLabels[res.timeframe] || res.timeframe}
                </span>
                {isPosActive ? (
                  <span
                    className={`signal-badge ${pos.type === "LONG" ? "signal-buy" : "signal-sell"}`}
                    style={{ fontSize: "0.68rem", padding: "0.15rem 0.4rem" }}
                  >
                    {pos.type === "LONG" ? "LONG" : "SHORT"}
                  </span>
                ) : (
                  <span
                    className="signal-badge signal-neutral"
                    style={{ fontSize: "0.68rem", padding: "0.15rem 0.4rem", opacity: 0.6 }}
                  >
                    FLAT
                  </span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", margin: "0.25rem 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Bakiye:</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(res.finalBalance)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Net Kâr:</span>
                  <span style={{ fontWeight: 700, color: pnlColor }}>
                    %{res.netProfit >= 0 ? "+" : ""}{res.netProfit}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Başarı:</span>
                  <span style={{ color: "var(--text-primary)" }}>%{res.winRate} ({res.totalTrades} İşlem)</span>
                </div>
              </div>

              {isPosActive && (
                <div
                  style={{
                    marginTop: "0.25rem",
                    padding: "0.5rem",
                    borderRadius: "var(--border-radius-sm)",
                    background: pos.unrealizedPnl >= 0 ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
                    border: `1px solid ${pos.unrealizedPnl >= 0 ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"}`,
                    fontSize: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.15rem" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Giriş Fiyatı:</span>
                    <span style={{ fontWeight: 500 }}>{formatCurrency(pos.entryPrice)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>PnL:</span>
                    <span style={{ fontWeight: 700, color: pos.unrealizedPnl >= 0 ? "var(--color-buy)" : "var(--color-sell)" }}>
                      {pos.unrealizedPnl >= 0 ? "+" : ""}{formatCurrency(pos.unrealizedPnl)} ({pos.unrealizedPnlPercent >= 0 ? "+" : ""}{pos.unrealizedPnlPercent}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <h4 style={{ fontSize: "0.95rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <Clock size={16} style={{ color: "var(--text-secondary)" }} />
            <span>Kaldıraçlı İşlem Geçmişi</span>
          </h4>

          <div className="tabs-container" style={{ padding: "2px" }}>
            <button
              className={`tab-btn ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
              style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}
            >
              Tümü
            </button>
            {results.map((r) => (
              <button
                key={r.timeframe}
                className={`tab-btn ${activeTab === r.timeframe ? "active" : ""}`}
                onClick={() => setActiveTab(r.timeframe)}
                style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}
              >
                {r.timeframe}
              </button>
            ))}
          </div>
        </div>

        <div style={{ maxHeight: "250px", overflowY: "auto", overflowX: "auto" }}>
          <table className="custom-table" style={{ marginTop: 0 }}>
            <thead>
              <tr>
                <th>Zaman</th>
                <th>Dilim</th>
                <th>Yön</th>
                <th style={{ textAlign: "right" }}>Giriş Fiyatı</th>
                <th style={{ textAlign: "right" }}>Çıkış Fiyatı</th>
                <th style={{ textAlign: "right" }}>PnL ($)</th>
                <th>Kapanış Nedeni</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    Henüz simüle edilmiş kaldıraçlı işlem bulunmuyor.
                  </td>
                </tr>
              ) : (
                filteredTrades.map((trade, idx) => {
                  const isLong = trade.type === "LONG";
                  const isWin = trade.pnl >= 0;
                  const reasonLabelMap: { [key: string]: string } = {
                    STOP_LOSS: "Stop Loss 🛑",
                    TRAILING_STOP: "İz Süren Stop 🛡️",
                    SIGNAL_REVERSE: "Sinyal Dönüşü 🔄",
                    LIQUIDATION: "Likidasyon 🔥",
                  };
                  return (
                    <tr key={idx}>
                      <td style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>
                        {formatDate(trade.exitTime)}
                      </td>
                      <td style={{ fontWeight: 600, fontSize: "0.8rem" }}>
                        {trade.timeframe}
                      </td>
                      <td>
                        <span
                          className={`signal-badge ${isLong ? "signal-buy" : "signal-sell"}`}
                          style={{ padding: "0.1rem 0.4rem", fontSize: "0.7rem", minWidth: "48px", display: "inline-block", textAlign: "center" }}
                        >
                          {isLong ? "LONG" : "SHORT"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontSize: "0.8rem" }}>{formatCurrency(trade.entryPrice)}</td>
                      <td style={{ textAlign: "right", fontSize: "0.8rem" }}>{formatCurrency(trade.exitPrice)}</td>
                      <td
                        style={{
                          textAlign: "right",
                          fontWeight: 700,
                          fontSize: "0.8rem",
                          color: isWin ? "var(--color-buy)" : "var(--color-sell)",
                        }}
                      >
                        {isWin ? "+" : ""}{formatCurrency(trade.pnl)}
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        {reasonLabelMap[trade.exitReason] || trade.exitReason}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
