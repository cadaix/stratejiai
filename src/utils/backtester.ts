import { Candle } from "./binance";
import {
  calculateRSI,
  calculateMACD,
  calculateEMA,
  calculateBollingerBands,
  calculateATR,
} from "./indicators";

export interface Trade {
  type: "BUY" | "SELL";
  price: number;
  time: number; // Unix timestamp
  balance: number;
}

export interface BacktestResult {
  strategyName: string;
  netProfit: number; // percentage
  winRate: number; // percentage
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  finalBalance: number;
  tradeHistory: Trade[];
  currentSignal: "BUY" | "SELL" | "NEUTRAL";
  indicatorValues: { [key: string]: number }; // current values
  stopLoss: number | null;    // suggested stop loss price
  takeProfit: number | null;  // suggested take profit price
  atr: number | null;         // current ATR value
}

export function runBacktest(
  candles: Candle[],
  initialBalance: number = 10000,
  feePercent: number = 0.1
): BacktestResult[] {
  if (candles.length < 50) {
    return [];
  }

  const prices = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const feeFactor = feePercent / 100;

  // 1. Calculate indicators
  const rsi = calculateRSI(prices, 14);
  const { macdLine, signalLine, histogram: macdHist } = calculateMACD(prices, 12, 26, 9);
  const ema9 = calculateEMA(prices, 9);
  const ema21 = calculateEMA(prices, 21);
  const { upper: bbUpper, middle: bbMiddle, lower: bbLower } = calculateBollingerBands(prices, 20, 2);
  const atr = calculateATR(highs, lows, prices, 14);
  const currentATR = atr[atr.length - 1];
  const currentPrice = prices[prices.length - 1];

  // 2. Define Strategies
  const strategies = [
    {
      name: "RSI Strategy (30/70)",
      evaluate: (i: number) => {
        if (isNaN(rsi[i]) || isNaN(rsi[i - 1])) return "NEUTRAL";
        // Buy when oversold, Sell when overbought
        if (rsi[i] < 30) return "BUY";
        if (rsi[i] > 70) return "SELL";
        return "NEUTRAL";
      },
      getCurrentSignal: () => {
        const lastVal = rsi[rsi.length - 1];
        if (lastVal < 30) return "BUY";
        if (lastVal > 70) return "SELL";
        return "NEUTRAL";
      },
      getIndicatorValues: () => ({
        RSI: Math.round(rsi[rsi.length - 1] * 100) / 100,
      }),
    },
    {
      name: "MACD Crossover",
      evaluate: (i: number) => {
        if (isNaN(macdHist[i]) || isNaN(macdHist[i - 1])) return "NEUTRAL";
        // Crossover signals
        if (macdHist[i] > 0 && macdHist[i - 1] <= 0) return "BUY";
        if (macdHist[i] < 0 && macdHist[i - 1] >= 0) return "SELL";
        return "NEUTRAL";
      },
      getCurrentSignal: () => {
        const lastHist = macdHist[macdHist.length - 1];
        const prevHist = macdHist[macdHist.length - 2];
        if (lastHist > 0 && prevHist <= 0) return "BUY";
        if (lastHist < 0 && prevHist >= 0) return "SELL";
        return lastHist > 0 ? "BUY" : "SELL"; // Trend-following signal
      },
      getIndicatorValues: () => ({
        MACD: Math.round(macdLine[macdLine.length - 1] * 1000) / 1000,
        Signal: Math.round(signalLine[signalLine.length - 1] * 1000) / 1000,
        Histogram: Math.round(macdHist[macdHist.length - 1] * 1000) / 1000,
      }),
    },
    {
      name: "EMA Golden Cross (9/21)",
      evaluate: (i: number) => {
        if (isNaN(ema9[i]) || isNaN(ema21[i]) || isNaN(ema9[i - 1]) || isNaN(ema21[i - 1])) return "NEUTRAL";
        if (ema9[i] > ema21[i] && ema9[i - 1] <= ema21[i - 1]) return "BUY";
        if (ema9[i] < ema21[i] && ema9[i - 1] >= ema21[i - 1]) return "SELL";
        return "NEUTRAL";
      },
      getCurrentSignal: () => {
        const lastEma9 = ema9[ema9.length - 1];
        const lastEma21 = ema21[ema21.length - 1];
        return lastEma9 > lastEma21 ? "BUY" : "SELL";
      },
      getIndicatorValues: () => ({
        EMA9: Math.round(ema9[ema9.length - 1] * 100) / 100,
        EMA21: Math.round(ema21[ema21.length - 1] * 100) / 100,
      }),
    },
    {
      name: "Bollinger Bands",
      evaluate: (i: number) => {
        if (isNaN(bbLower[i]) || isNaN(bbUpper[i])) return "NEUTRAL";
        if (prices[i] < bbLower[i]) return "BUY";
        if (prices[i] > bbUpper[i]) return "SELL";
        return "NEUTRAL";
      },
      getCurrentSignal: () => {
        const lastPrice = prices[prices.length - 1];
        const lastLower = bbLower[bbLower.length - 1];
        const lastUpper = bbUpper[bbUpper.length - 1];
        if (lastPrice < lastLower) return "BUY";
        if (lastPrice > lastUpper) return "SELL";
        return "NEUTRAL";
      },
      getIndicatorValues: () => ({
        BB_Upper: Math.round(bbUpper[bbUpper.length - 1] * 100) / 100,
        BB_Middle: Math.round(bbMiddle[bbMiddle.length - 1] * 100) / 100,
        BB_Lower: Math.round(bbLower[bbLower.length - 1] * 100) / 100,
      }),
    },
  ];

  // 3. Run backtest for each strategy
  const results: BacktestResult[] = strategies.map((strategy) => {
    let balance = initialBalance;
    let position = 0;
    let inPosition = false;
    let buyPrice = 0;
    const tradeHistory: Trade[] = [];
    let winningTrades = 0;
    let losingTrades = 0;

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const decision = strategy.evaluate(i);

      if (decision === "BUY" && !inPosition) {
        // Buy using all balance
        const cost = balance * feeFactor;
        const netBalance = balance - cost;
        position = netBalance / candle.close;
        buyPrice = candle.close;
        balance = 0;
        inPosition = true;

        tradeHistory.push({
          type: "BUY",
          price: candle.close,
          time: candle.time,
          balance: 0,
        });
      } else if (decision === "SELL" && inPosition) {
        // Sell all position
        const grossValue = position * candle.close;
        const fee = grossValue * feeFactor;
        balance = grossValue - fee;
        position = 0;
        inPosition = false;

        const tradeProfit = candle.close - buyPrice;
        if (tradeProfit > 0) {
          winningTrades++;
        } else {
          losingTrades++;
        }

        tradeHistory.push({
          type: "SELL",
          price: candle.close,
          time: candle.time,
          balance: balance,
        });
      }
    }

    // Force sell at the last candle close to calculate final balance if still holding
    if (inPosition) {
      const lastCandle = candles[candles.length - 1];
      const grossValue = position * lastCandle.close;
      const fee = grossValue * feeFactor;
      balance = grossValue - fee;

      const tradeProfit = lastCandle.close - buyPrice;
      if (tradeProfit > 0) {
        winningTrades++;
      } else {
        losingTrades++;
      }

      tradeHistory.push({
        type: "SELL",
        price: lastCandle.close,
        time: lastCandle.time,
        balance: balance,
      });
    }

    const totalTrades = winningTrades + losingTrades;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const netProfit = ((balance - initialBalance) / initialBalance) * 100;
    const signal = strategy.getCurrentSignal();

    // Calculate SL/TP based on ATR (1.5x ATR for SL, 3x ATR for TP)
    let stopLoss: number | null = null;
    let takeProfit: number | null = null;
    if (!isNaN(currentATR) && currentATR > 0) {
      if (signal === "BUY") {
        stopLoss = Math.round((currentPrice - currentATR * 1.5) * 100) / 100;
        takeProfit = Math.round((currentPrice + currentATR * 3) * 100) / 100;
      } else if (signal === "SELL") {
        stopLoss = Math.round((currentPrice + currentATR * 1.5) * 100) / 100;
        takeProfit = Math.round((currentPrice - currentATR * 3) * 100) / 100;
      }
    }

    return {
      strategyName: strategy.name,
      netProfit: Math.round(netProfit * 100) / 100,
      winRate: Math.round(winRate * 100) / 100,
      totalTrades,
      winningTrades,
      losingTrades,
      finalBalance: Math.round(balance * 100) / 100,
      tradeHistory,
      currentSignal: signal,
      indicatorValues: strategy.getIndicatorValues(),
      stopLoss,
      takeProfit,
      atr: !isNaN(currentATR) ? Math.round(currentATR * 100) / 100 : null,
    };
  });

  return results;
}
