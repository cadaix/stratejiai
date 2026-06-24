"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  LineStyle,
  CandlestickSeries,
  createSeriesMarkers,
  Time,
} from "lightweight-charts";
import { Candle } from "../utils/binance";
import { Trade } from "../utils/backtester";

interface TradingChartProps {
  data: Candle[];
  trades: Trade[];
  symbol: string;
  timeframe: string;
}

export default function TradingChart({ data, trades, symbol, timeframe }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

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

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    const sortedData = [...data].sort((a, b) => a.time - b.time);

    const chartData = sortedData.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candlestickSeries.setData(chartData);

    // Trade markers
    const validTimes = new Set(chartData.map((d) => d.time));

    const markers = trades
      .filter((t) => validTimes.has(t.time as Time))
      .map((t) => ({
        time: t.time as Time,
        position: (t.type === "BUY" ? "belowBar" : "aboveBar") as "belowBar" | "aboveBar",
        color: t.type === "BUY" ? "#10b981" : "#ef4444",
        shape: (t.type === "BUY" ? "arrowUp" : "arrowDown") as "arrowUp" | "arrowDown",
        text: t.type === "BUY" ? "AL" : "SAT",
        size: 1.2,
      }))
      .sort((a, b) => (a.time as unknown as number) - (b.time as unknown as number));

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
  }, [data, trades, symbol, timeframe]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={chartContainerRef} className="tv-chart" />
    </div>
  );
}
