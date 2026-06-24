"use client";

import { useEffect, useState } from "react";
import { Play, RotateCcw, TrendingUp, TrendingDown, Info, ShieldCheck, Send, CheckCircle, AlertCircle, Lock } from "lucide-react";
import { BacktestResult } from "../utils/backtester";

interface SignalPanelProps {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  results: BacktestResult[];
  onRefresh: () => void;
  isLoading: boolean;
  lastUpdated: Date | null;
}

export default function SignalPanel({
  symbol,
  timeframe,
  currentPrice,
  results,
  onRefresh,
  isLoading,
  lastUpdated,
}: SignalPanelProps) {
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes in seconds
  const [tgStatus, setTgStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [tgResponse, setTgResponse] = useState<string | null>(null);
  const [cronSecret, setCronSecret] = useState("YOUR_CRON_SECRET_HERE");

  const handleTelegramTest = async (testMode: boolean) => {
    setTgStatus("loading");
    setTgResponse(null);
    try {
      const url = `/api/cron-alert?${testMode ? "test=true&" : ""}secret=${encodeURIComponent(cronSecret)}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (res.ok) {
        setTgStatus("success");
        setTgResponse(testMode 
          ? "Başarılı! Telegram botuna test mesajı gönderildi." 
          : "Başarılı! Güncel rapor Telegram botuna gönderildi."
        );
      } else {
        setTgStatus("error");
        setTgResponse(data.error || "Bilinmeyen bir hata oluştu.");
      }
    } catch (err) {
      setTgStatus("error");
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setTgResponse("API isteği başarısız oldu: " + errorMessage);
    }
  };

  useEffect(() => {
    // Reset timer when refresh completes
    if (!isLoading) {
      const timer = setTimeout(() => {
        setTimeLeft(15 * 60);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isLoading, results]);

  useEffect(() => {
    if (timeLeft <= 0) {
      onRefresh();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onRefresh]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Find best performing strategy (highest net profit)
  const bestStrategy = results.length > 0 
    ? [...results].sort((a, b) => b.netProfit - a.netProfit)[0]
    : null;

  const signal = bestStrategy ? bestStrategy.currentSignal : "NEUTRAL";

  const getSignalClass = (sig: string) => {
    if (sig === "BUY") return "signal-buy";
    if (sig === "SELL") return "signal-sell";
    return "signal-neutral";
  };

  const getSignalLabel = (sig: string) => {
    if (sig === "BUY") return "AL (BUY)";
    if (sig === "SELL") return "SAT (SELL)";
    return "NÖTR (NEUTRAL)";
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: symbol.toLowerCase().includes("btc") ? 2 : 4,
    }).format(val);
  };

  const timeFrameLabels: { [key: string]: string } = {
    "15m": "15 Dakika",
    "1h": "1 Saat",
    "4h": "4 Saat",
    "1d": "Günlük",
    "1w": "Haftalık",
    "1M": "Aylık",
    "1y": "Yıllık (Simüle)",
    "5y": "5 Yıllık (Günlük)",
  };

  return (
    <div className="flex-column">
      {/* Active Signal Panel */}
      <div className="glass-panel" style={{ position: "relative", overflow: "hidden" }}>
        {/* Glow effect matching the signal */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background:
              signal === "BUY"
                ? "var(--color-buy)"
                : signal === "SELL"
                ? "var(--color-sell)"
                : "var(--color-neutral)",
            boxShadow: `0 2px 20px ${
              signal === "BUY"
                ? "var(--color-buy)"
                : signal === "SELL"
                ? "var(--color-sell)"
                : "var(--color-neutral)"
            }`,
          }}
        />

        <div className="flex-column" style={{ gap: "1.25rem" }}>
          <div className="flex-row-between">
            <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 500 }}>
              {symbol} &bull; {timeFrameLabels[timeframe] || timeframe}
            </span>
            <div className="timer-badge">
              <div className="pulse-dot" />
              <span>{formatTime(timeLeft)}</span>
            </div>
          </div>

          <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
            <h2 style={{ fontSize: "1.1rem", color: "var(--text-secondary)", fontWeight: 500, marginBottom: "0.25rem" }}>
              Aktif Fiyat
            </h2>
            <div style={{ fontSize: "2.25rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
              {currentPrice > 0 ? formatCurrency(currentPrice) : "Yükleniyor..."}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
            <div
              className={`signal-badge ${getSignalClass(signal)}`}
              style={{
                width: "100%",
                padding: "1rem",
                fontSize: "1.4rem",
                borderRadius: "var(--border-radius-md)",
                boxShadow:
                  signal === "BUY"
                    ? "0 4px 20px rgba(16, 185, 129, 0.15)"
                    : signal === "SELL"
                    ? "0 4px 20px rgba(239, 68, 68, 0.15)"
                    : "0 4px 20px rgba(245, 158, 11, 0.15)",
                textAlign: "center",
              }}
            >
              {signal === "BUY" && <TrendingUp style={{ marginRight: "0.5rem" }} />}
              {signal === "SELL" && <TrendingDown style={{ marginRight: "0.5rem" }} />}
              <span>{getSignalLabel(signal)}</span>
            </div>
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
                textAlign: "center",
                marginTop: "0.25rem",
              }}
            >
              Sinyal en yüksek karlı indikatöre göre belirlenmiştir.
            </p>
          </div>

          <hr style={{ border: "0", borderTop: "1px solid var(--border-color)" }} />

          {bestStrategy && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                padding: "0.75rem",
                background: "rgba(255,255,255,0.02)",
                borderRadius: "var(--border-radius-sm)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--color-buy)" }}>
                <ShieldCheck size={18} />
                <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>En İyi Başarım Gösteren</span>
              </div>
              <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{bestStrategy.strategyName}</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                <span>Backtest Getirisi:</span>
                <span style={{ color: bestStrategy.netProfit >= 0 ? "var(--color-buy)" : "var(--color-sell)", fontWeight: 600 }}>
                  %{bestStrategy.netProfit >= 0 ? "+" : ""}{bestStrategy.netProfit}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                <span>Başarı Oranı:</span>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>%{bestStrategy.winRate}</span>
              </div>
            </div>
          )}

          {/* Stop Loss / Take Profit */}
          {bestStrategy && bestStrategy.currentSignal !== "NEUTRAL" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                padding: "0.75rem",
                background: "rgba(255,255,255,0.02)",
                borderRadius: "var(--border-radius-sm)",
                border: "1px solid var(--border-color)",
              }}
            >
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                🎯 ATR Tabanlı Seviyeler
              </span>
              {bestStrategy.stopLoss && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Stop Loss:</span>
                  <span style={{ fontWeight: 700, color: "var(--color-sell)" }}>
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(bestStrategy.stopLoss)}
                  </span>
                </div>
              )}
              {bestStrategy.takeProfit && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Take Profit:</span>
                  <span style={{ fontWeight: 700, color: "var(--color-buy)" }}>
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(bestStrategy.takeProfit)}
                  </span>
                </div>
              )}
              {bestStrategy.atr && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem" }}>
                  <span style={{ color: "var(--text-muted)" }}>ATR (14):</span>
                  <span style={{ color: "var(--text-muted)" }}>
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(bestStrategy.atr)}
                  </span>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="btn btn-secondary"
              style={{ flex: 1, padding: "0.5rem" }}
            >
              <RotateCcw size={16} className={isLoading ? "spin-animation" : ""} />
              <span>Yenile</span>
            </button>
          </div>

          {lastUpdated && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.25rem", fontSize: "0.7rem", color: "var(--text-muted)" }}>
              <Info size={12} />
              <span>Son Güncelleme: {lastUpdated.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Indicator Breakdown Panel */}
      <div className="glass-panel">
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>İndikatör Dağılımı</span>
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {results.map((res) => (
            <div
              key={res.strategyName}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.6rem 0.75rem",
                borderRadius: "var(--border-radius-sm)",
                background: "rgba(255, 255, 255, 0.01)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, marginRight: "0.5rem" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, wordBreak: "break-word", whiteSpace: "normal" }}>
                  {res.strategyName}
                </span>
                <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)", wordBreak: "break-word", whiteSpace: "normal" }}>
                  {Object.entries(res.indicatorValues)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(", ")}
                </span>
              </div>
              <span
                className={`signal-badge ${getSignalClass(res.currentSignal)}`}
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
              >
                {res.currentSignal}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Telegram Bot Control Panel */}
      <div className="glass-panel" style={{ marginTop: "1rem" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Send size={18} style={{ color: "var(--accent-primary)" }} />
          <span>Telegram Bot Kontrolü</span>
        </h3>
        
        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "1rem", lineHeight: "1.4" }}>
          Bot bağlantısını test edin veya manuel olarak anlık piyasa yorumu ve sinyal raporu gönderin.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {/* Cron Secret Input */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 500, display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <Lock size={12} />
              <span>Cron Şifresi (CRON_SECRET)</span>
            </label>
            <input
              type="text"
              value={cronSecret}
              onChange={(e) => setCronSecret(e.target.value)}
              placeholder="Şifreyi girin..."
              style={{
                background: "rgba(0, 0, 0, 0.2)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--border-radius-sm)",
                padding: "0.45rem 0.75rem",
                color: "var(--text-primary)",
                fontSize: "0.85rem",
                fontFamily: "var(--font-sans)",
                width: "100%",
                outline: "none"
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => handleTelegramTest(true)}
              disabled={tgStatus === "loading" || isLoading}
              className="btn btn-secondary"
              style={{ flex: 1, padding: "0.5rem", fontSize: "0.8rem" }}
            >
              <span>Test Gönder</span>
            </button>
            <button
              onClick={() => handleTelegramTest(false)}
              disabled={tgStatus === "loading" || isLoading}
              className="btn btn-primary"
              style={{ flex: 1, padding: "0.5rem", fontSize: "0.8rem" }}
            >
              <span>Rapor Gönder</span>
            </button>
          </div>

          {/* Response Status */}
          {tgStatus !== "idle" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
                padding: "0.6rem 0.75rem",
                borderRadius: "var(--border-radius-sm)",
                background: tgStatus === "success" 
                  ? "rgba(16, 185, 129, 0.05)" 
                  : tgStatus === "error" 
                  ? "rgba(239, 68, 68, 0.05)" 
                  : "rgba(255, 255, 255, 0.02)",
                border: `1px solid ${
                  tgStatus === "success" 
                    ? "rgba(16, 185, 129, 0.15)" 
                    : tgStatus === "error" 
                    ? "rgba(239, 68, 68, 0.15)" 
                    : "var(--border-color)"
                }`,
                fontSize: "0.8rem"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                {tgStatus === "loading" && (
                  <div className="pulse-dot" style={{ background: "var(--accent-primary)", boxShadow: "0 0 8px var(--accent-primary)" }} />
                )}
                {tgStatus === "success" && (
                  <CheckCircle size={14} style={{ color: "var(--color-buy)" }} />
                )}
                {tgStatus === "error" && (
                  <AlertCircle size={14} style={{ color: "var(--color-sell)" }} />
                )}
                <span style={{ 
                  fontWeight: 600, 
                  color: tgStatus === "success" 
                    ? "var(--color-buy)" 
                    : tgStatus === "error" 
                    ? "var(--color-sell)" 
                    : "var(--text-primary)" 
                }}>
                  {tgStatus === "loading" && "İstek gönderiliyor..."}
                  {tgStatus === "success" && "Başarılı"}
                  {tgStatus === "error" && "Hata Oluştu"}
                </span>
              </div>
              {tgResponse && (
                <div style={{ 
                  color: tgStatus === "error" ? "var(--color-sell)" : "var(--text-secondary)", 
                  fontSize: "0.75rem",
                  wordBreak: "break-all",
                  whiteSpace: "pre-wrap",
                  fontFamily: tgStatus === "error" ? "monospace" : "inherit"
                }}>
                  {tgResponse}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
