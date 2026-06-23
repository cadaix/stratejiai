"use client";

import { useState } from "react";
import { Award, Layers, ClipboardList, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
import { BacktestResult } from "../utils/backtester";

interface BacktestPanelProps {
  results: BacktestResult[];
}

export default function BacktestPanel({ results }: BacktestPanelProps) {
  const [showTrades, setShowTrades] = useState(false);

  const sortedResults = [...results].sort((a, b) => b.netProfit - a.netProfit);
  const bestStrategy = sortedResults[0];

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("tr-TR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val);
  };

  return (
    <div className="flex-column" style={{ gap: "1.5rem" }}>
      {/* Strategy Leaderboard */}
      <div className="glass-panel">
        <h3
          style={{
            fontSize: "1.1rem",
            fontWeight: 600,
            marginBottom: "1.25rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Award size={20} style={{ color: "var(--color-neutral)" }} />
          <span>İndikatör Performans Sıralaması (Backtest)</span>
        </h3>

        <div style={{ overflowX: "auto" }}>
          <table className="custom-table" style={{ marginTop: 0 }}>
            <thead>
              <tr>
                <th>Sıra</th>
                <th>Strateji / İndikatör</th>
                <th style={{ textAlign: "right" }}>Toplam İşlem</th>
                <th style={{ textAlign: "right" }}>Başarı Oranı</th>
                <th style={{ textAlign: "right" }}>Net Kar / Zarar</th>
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((res, index) => {
                const isBest = index === 0;
                return (
                  <tr key={res.strategyName} style={isBest ? { background: "rgba(99, 102, 241, 0.04)" } : {}}>
                    <td style={{ fontWeight: 700, padding: "1rem" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          background: isBest
                            ? "var(--color-neutral)"
                            : index === 1
                            ? "rgba(255,255,255,0.15)"
                            : "rgba(255,255,255,0.05)",
                          color: isBest ? "#000" : "var(--text-primary)",
                          fontSize: "0.8rem",
                        }}
                      >
                        {index + 1}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{res.strategyName}</span>
                        {isBest && (
                          <span style={{ fontSize: "0.7rem", color: "var(--color-buy)", fontWeight: 500 }}>
                            &bull; En İyi Algoritma (Seçildi)
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: "right", color: "var(--text-secondary)" }}>{res.totalTrades}</td>
                    <td style={{ textAlign: "right", color: "var(--text-secondary)", fontWeight: 500 }}>
                      %{res.winRate}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        color: res.netProfit >= 0 ? "var(--color-buy)" : "var(--color-sell)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.25rem" }}>
                        {res.netProfit >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        <span>%{res.netProfit >= 0 ? "+" : ""}{res.netProfit}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trade History Log */}
      {bestStrategy && bestStrategy.tradeHistory.length > 0 && (
        <div className="glass-panel">
          <div
            onClick={() => setShowTrades(!showTrades)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            <h3
              style={{
                fontSize: "1.1rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <ClipboardList size={20} style={{ color: "var(--accent-primary)" }} />
              <span>İşlem Geçmişi Günlüğü ({bestStrategy.strategyName})</span>
            </h3>
            <button className="btn btn-secondary btn-icon" style={{ borderRadius: "8px" }}>
              {showTrades ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>

          {showTrades && (
            <div style={{ marginTop: "1rem", maxHeight: "300px", overflowY: "auto", overflowX: "auto" }}>
              <table className="custom-table" style={{ marginTop: 0 }}>
                <thead>
                  <tr>
                    <th>Zaman</th>
                    <th>İşlem Tipi</th>
                    <th style={{ textAlign: "right" }}>İşlem Fiyatı</th>
                    <th style={{ textAlign: "right" }}>Bakiye (USDT)</th>
                  </tr>
                </thead>
                <tbody>
                  {[...bestStrategy.tradeHistory].reverse().map((trade, idx) => {
                    const isBuy = trade.type === "BUY";
                    return (
                      <tr key={idx}>
                        <td style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                          {formatDate(trade.time)}
                        </td>
                        <td>
                          <span
                            className={`signal-badge ${isBuy ? "signal-buy" : "signal-sell"}`}
                            style={{ padding: "0.15rem 0.5rem", fontSize: "0.75rem", minWidth: "50px" }}
                          >
                            {isBuy ? "AL" : "SAT"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{formatCurrency(trade.price)}</td>
                        <td style={{ textAlign: "right", color: "var(--text-secondary)" }}>
                          {trade.balance > 0 ? formatCurrency(trade.balance) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
