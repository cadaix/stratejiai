"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  LineStyle,
  CandlestickSeries,
  LineSeries,
  createSeriesMarkers,
} from "lightweight-charts";
import { Candle } from "../utils/binance";
import { Trade } from "../utils/backtester";
import { calculateEMA, calculateBollingerBands } from "../utils/indicators";

interface TradingChartProps {
  data: Candle[];
  trades: Trade[];
  symbol: string;
  timeframe: string;
}

type OverlayKey = "ema" | "bb";

export default function TradingChart({ data, trades, symbol, timeframe }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [activeOverlays, setActiveOverlays] = useState<Set<OverlayKey>>(new Set(["ema", "bb"]));

  const toggleOverlay = (key: OverlayKey) => {
    setActiveOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const container = chartContainerRef.current;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "#0c101d" },
        textColor: "#94a3b8",
        fontFamily: "var(--font-sans)",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.02)" },
        horzLines: { color: "rgba(255, 255, 255, 0.02)" },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: "rgba(99, 102, 241, 0.4)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#151c30",
        },
        horzLine: {
          color: "rgba(99, 102, 241, 0.4)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#151c30",
        },
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.06)",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.06)",
        autoScale: true,
      },
      width: container.clientWidth,
      height: container.clientHeight,
    });

    // V5 API: addSeries(SeriesType, options)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    const sortedData = [...data].sort((a, b) => a.time - b.time);

    const chartData = sortedData.map((c) => ({
      time: c.time as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candlestickSeries.setData(chartData);

    const prices = sortedData.map((c) => c.close);
    const times = sortedData.map((c) => c.time);

    // EMA Overlays
    if (activeOverlays.has("ema")) {
      const ema9 = calculateEMA(prices, 9);
      const ema21 = calculateEMA(prices, 21);

      const ema9Series = chart.addSeries(LineSeries, {
        color: "#f59e0b",
        lineWidth: 1,
        title: "EMA 9",
        priceLineVisible: false,
        lastValueVisible: true,
      });

      const ema21Series = chart.addSeries(LineSeries, {
        color: "#6366f1",
        lineWidth: 1,
        title: "EMA 21",
        priceLineVisible: false,
        lastValueVisible: true,
      });

      const ema9Data = times
        .map((t, i) => ({ time: t as any, value: ema9[i] }))
        .filter((d) => !isNaN(d.value));

      const ema21Data = times
        .map((t, i) => ({ time: t as any, value: ema21[i] }))
        .filter((d) => !isNaN(d.value));

      ema9Series.setData(ema9Data);
      ema21Series.setData(ema21Data);
    }

    // Bollinger Bands Overlays
    if (activeOverlays.has("bb")) {
      const { upper, middle, lower } = calculateBollingerBands(prices, 20, 2);

      const bbUpperSeries = chart.addSeries(LineSeries, {
        color: "rgba(99, 102, 241, 0.55)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: "BB Upper",
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const bbMiddleSeries = chart.addSeries(LineSeries, {
        color: "rgba(99, 102, 241, 0.3)",
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        title: "BB Mid",
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const bbLowerSeries = chart.addSeries(LineSeries, {
        color: "rgba(99, 102, 241, 0.55)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        title: "BB Lower",
        priceLineVisible: false,
        lastValueVisible: false,
      });

      const bbUpperData = times
        .map((t, i) => ({ time: t as any, value: upper[i] }))
        .filter((d) => !isNaN(d.value));

      const bbMiddleData = times
        .map((t, i) => ({ time: t as any, value: middle[i] }))
        .filter((d) => !isNaN(d.value));

      const bbLowerData = times
        .map((t, i) => ({ time: t as any, value: lower[i] }))
        .filter((d) => !isNaN(d.value));

      bbUpperSeries.setData(bbUpperData);
      bbMiddleSeries.setData(bbMiddleData);
      bbLowerSeries.setData(bbLowerData);
    }

    // Trade markers
    const validTimes = new Set(chartData.map((d) => d.time));

    const markers = trades
      .filter((t) => validTimes.has(t.time as any))
      .map((t) => ({
        time: t.time as any,
        position: (t.type === "BUY" ? "belowBar" : "aboveBar") as "belowBar" | "aboveBar",
        color: t.type === "BUY" ? "#10b981" : "#ef4444",
        shape: (t.type === "BUY" ? "arrowUp" : "arrowDown") as "arrowUp" | "arrowDown",
        text: t.type === "BUY" ? "AL" : "SAT",
        size: 1.2,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number));

    // V5 API: createSeriesMarkers instead of series.setMarkers
    if (markers.length > 0) {
      createSeriesMarkers(candlestickSeries, markers);
    }
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !entries[0].contentRect) return;
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [data, trades, symbol, timeframe, activeOverlays]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Overlay Toggle Controls */}
      <div
        style={{
          position: "absolute",
          top: "8px",
          left: "8px",
          zIndex: 10,
          display: "flex",
          gap: "6px",
        }}
      >
        <button
          onClick={() => toggleOverlay("ema")}
          style={{
            padding: "3px 10px",
            fontSize: "0.7rem",
            fontWeight: 600,
            borderRadius: "6px",
            border: `1px solid ${activeOverlays.has("ema") ? "rgba(245, 158, 11, 0.5)" : "rgba(255,255,255,0.1)"}`,
            background: activeOverlays.has("ema") ? "rgba(245, 158, 11, 0.15)" : "rgba(0,0,0,0.4)",
            color: activeOverlays.has("ema") ? "#f59e0b" : "#94a3b8",
            cursor: "pointer",
            backdropFilter: "blur(8px)",
            fontFamily: "var(--font-sans)",
            transition: "all 0.15s ease",
          }}
        >
          EMA 9/21
        </button>
        <button
          onClick={() => toggleOverlay("bb")}
          style={{
            padding: "3px 10px",
            fontSize: "0.7rem",
            fontWeight: 600,
            borderRadius: "6px",
            border: `1px solid ${activeOverlays.has("bb") ? "rgba(99, 102, 241, 0.5)" : "rgba(255,255,255,0.1)"}`,
            background: activeOverlays.has("bb") ? "rgba(99, 102, 241, 0.15)" : "rgba(0,0,0,0.4)",
            color: activeOverlays.has("bb") ? "#6366f1" : "#94a3b8",
            cursor: "pointer",
            backdropFilter: "blur(8px)",
            fontFamily: "var(--font-sans)",
            transition: "all 0.15s ease",
          }}
        >
          Bollinger
        </button>
      </div>
      <div ref={chartContainerRef} className="tv-chart" />
    </div>
  );
}
