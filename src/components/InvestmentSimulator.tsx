"use client";

import { useState, useMemo } from "react";
import { Calculator, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { BacktestResult } from "../utils/backtester";

interface InvestmentSimulatorProps {
  results: BacktestResult[];
  symbol: string;
}

export default function InvestmentSimulator({ results, symbol }: InvestmentSimulatorProps) {
  const [investment, setInvestment] = useState<string>("1000");

  const investmentAmount = parseFloat(investment) || 0;

  const simulations = useMemo(() => {
    return results.map((res) => {
      const finalValue = investmentAmount * (1 + res.netProfit / 100);
      const profit = finalValue - investmentAmount;
      return {
        strategyName: res.strategyName,
        netProfit: res.netProfit,
        finalValue: Math.round(finalValue * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        currentSignal: res.currentSignal,
      };
    });
  }, [results, investmentAmount]);

  const sortedSims = [...simulations].sort((a, b) => b.netProfit - a.netProfit);
  const bestSim = sortedSims[0];

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(val);

  const presets = [500, 1000, 5000, 10000];

  return (
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
        <Calculator size={20} style={{ color: "var(--accent-primary)" }} />
        <span>Yatırım Simülatörü</span>
      </h3>

      {/* Input Section */}
      <div style={{ marginBottom: "1.25rem" }}>
        <label
          style={{
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
            fontWeight: 500,
            display: "block",
            marginBottom: "0.5rem",
          }}
        >
          Yatırım Miktarı (USD)
        </label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <div
            style={{
              position: "relative",
              flex: 1,
              minWidth: "160px",
            }}
          >
            <DollarSign
              size={16}
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-secondary)",
              }}
            />
            <input
              type="number"
              value={investment}
              onChange={(e) => setInvestment(e.target.value)}
              min="0"
              step="100"
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem 0.6rem 2.25rem",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--border-radius-sm)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-sans)",
                fontSize: "0.95rem",
                fontWeight: 600,
                outline: "none",
                transition: "border-color 0.15s ease",
              }}
              onFocus={(e) =>
                (e.target.style.borderColor = "var(--accent-primary)")
              }
              onBlur={(e) =>
                (e.target.style.borderColor = "var(--border-color)")
              }
            />
          </div>
          {/* Quick Presets */}
          {presets.map((preset) => (
            <button
              key={preset}
              onClick={() => setInvestment(String(preset))}
              className="btn btn-secondary"
              style={{
                padding: "0.5rem 0.75rem",
                fontSize: "0.8rem",
                borderColor:
                  investmentAmount === preset
                    ? "var(--accent-primary)"
                    : "var(--border-color)",
                background:
                  investmentAmount === preset
                    ? "rgba(99, 102, 241, 0.1)"
                    : undefined,
                color:
                  investmentAmount === preset
                    ? "var(--accent-primary)"
                    : undefined,
              }}
            >
              ${preset >= 1000 ? `${preset / 1000}K` : preset}
            </button>
          ))}
        </div>
      </div>

      {/* Best Result Highlight */}
      {bestSim && investmentAmount > 0 && (
        <div
          style={{
            padding: "1rem",
            borderRadius: "var(--border-radius-md)",
            background:
              bestSim.profit >= 0
                ? "rgba(16, 185, 129, 0.07)"
                : "rgba(239, 68, 68, 0.07)",
            border: `1px solid ${
              bestSim.profit >= 0
                ? "rgba(16, 185, 129, 0.25)"
                : "rgba(239, 68, 68, 0.25)"
            }`,
            marginBottom: "1rem",
          }}
        >
          <div
            style={{
              fontSize: "0.78rem",
              color: "var(--text-secondary)",
              marginBottom: "0.4rem",
              fontWeight: 500,
            }}
          >
            En İyi Strateji ({bestSim.strategyName}) ile
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                Başlangıç
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                {formatCurrency(investmentAmount)}
              </div>
            </div>
            <div style={{ fontSize: "1.5rem", color: "var(--text-muted)" }}>→</div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                Sonuç
              </div>
              <div
                style={{
                  fontSize: "1.3rem",
                  fontWeight: 700,
                  color:
                    bestSim.profit >= 0 ? "var(--color-buy)" : "var(--color-sell)",
                }}
              >
                {formatCurrency(bestSim.finalValue)}
              </div>
              <div
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color:
                    bestSim.profit >= 0 ? "var(--color-buy)" : "var(--color-sell)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "4px",
                }}
              >
                {bestSim.profit >= 0 ? (
                  <TrendingUp size={14} />
                ) : (
                  <TrendingDown size={14} />
                )}
                {bestSim.profit >= 0 ? "+" : ""}
                {formatCurrency(bestSim.profit)} (%{bestSim.netProfit >= 0 ? "+" : ""}{bestSim.netProfit})
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Strategy Comparison */}
      <div style={{ overflowX: "auto" }}>
        <table className="custom-table" style={{ marginTop: 0 }}>
          <thead>
            <tr>
              <th>Strateji</th>
              <th style={{ textAlign: "right" }}>Getiri</th>
              <th style={{ textAlign: "right" }}>Sonuç Değeri</th>
              <th style={{ textAlign: "right" }}>Kâr / Zarar</th>
            </tr>
          </thead>
          <tbody>
            {sortedSims.map((sim, idx) => (
              <tr key={sim.strategyName}>
                <td>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                      {sim.strategyName}
                    </span>
                    {idx === 0 && (
                      <span
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--color-buy)",
                          fontWeight: 500,
                        }}
                      >
                        • En İyi
                      </span>
                    )}
                  </div>
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    color:
                      sim.netProfit >= 0 ? "var(--color-buy)" : "var(--color-sell)",
                  }}
                >
                  %{sim.netProfit >= 0 ? "+" : ""}
                  {sim.netProfit}
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 600,
                  }}
                >
                  {investmentAmount > 0 ? formatCurrency(sim.finalValue) : "—"}
                </td>
                <td
                  style={{
                    textAlign: "right",
                    fontWeight: 700,
                    color:
                      sim.profit >= 0 ? "var(--color-buy)" : "var(--color-sell)",
                  }}
                >
                  {investmentAmount > 0
                    ? `${sim.profit >= 0 ? "+" : ""}${formatCurrency(sim.profit)}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p
        style={{
          fontSize: "0.7rem",
          color: "var(--text-muted)",
          marginTop: "0.75rem",
          textAlign: "center",
        }}
      >
        ⚠️ Bu simülasyon geçmiş veri analizine dayanmaktadır. Gelecekteki getirileri garanti etmez.
      </p>
    </div>
  );
}
