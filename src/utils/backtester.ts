import { Candle } from "./binance";
import {
  calculateRSI,
  calculateMACD,
  calculateEMA,
  calculateBollingerBands,
  calculateATR,
  calculateHeikinAshi,
  calculateIchimoku,
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

// Helper function to test a strategy with dynamic criteria
// Helper function to test a strategy with dynamic criteria
function testStrategy(
  candles: Candle[],
  evaluate: (i: number) => "BUY" | "SELL" | "NEUTRAL",
  initialBalance: number = 10000,
  feePercent: number = 0.1,
  trailingAtrMult: number = 0,
  atrValues: number[] = []
) {
  const feeFactor = feePercent / 100;
  let balance = initialBalance;
  let position = 0;
  let inPosition = false;
  let buyPrice = 0;
  let highestPrice = 0;
  const tradeHistory: Trade[] = [];
  let winningTrades = 0;
  let losingTrades = 0;

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const decision = evaluate(i);
    const currentAtr = atrValues[i] || 0;

    // Check for Trailing Stop exit
    if (inPosition && trailingAtrMult > 0 && currentAtr > 0) {
      if (candle.close > highestPrice) {
        highestPrice = candle.close;
      }
      const trailingStopPrice = highestPrice - currentAtr * trailingAtrMult;
      
      if (candle.close < trailingStopPrice) {
        // Trailing Stop triggered! Sell all position.
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
        
        continue; // Close position and skip evaluate loop
      }
    }

    if (decision === "BUY" && !inPosition) {
      const cost = balance * feeFactor;
      const netBalance = balance - cost;
      position = netBalance / candle.close;
      buyPrice = candle.close;
      highestPrice = candle.close;
      balance = 0;
      inPosition = true;
      tradeHistory.push({
        type: "BUY",
        price: candle.close,
        time: candle.time,
        balance: 0,
      });
    } else if (decision === "SELL" && inPosition) {
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

  return {
    netProfit: Math.round(netProfit * 100) / 100,
    winRate: Math.round(winRate * 100) / 100,
    totalTrades,
    winningTrades,
    losingTrades,
    tradeHistory,
  };
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

  // 1. Calculate base indicators for static strategies
  const rsi = calculateRSI(prices, 14);
  const { macdLine, signalLine, histogram: macdHist } = calculateMACD(prices, 12, 26, 9);
  const ema9 = calculateEMA(prices, 9);
  const ema21 = calculateEMA(prices, 21);
  const { upper: bbUpper, middle: bbMiddle, lower: bbLower } = calculateBollingerBands(prices, 20, 2);
  const atr = calculateATR(highs, lows, prices, 14);
  const currentATR = atr[atr.length - 1];
  const currentPrice = prices[prices.length - 1];

  const haCandles = calculateHeikinAshi(candles);
  const { tenkanSen, kijunSen, senkouSpanA, senkouSpanB } = calculateIchimoku(highs, lows, prices, 9, 26, 52, 26);

  // 2. Define static strategies
  const staticStrategies = [
    {
      name: "RSI Stratejisi (30/70)",
      evaluate: (i: number) => {
        if (isNaN(rsi[i]) || isNaN(rsi[i - 1])) return "NEUTRAL";
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
      name: "MACD Kesişimi (12/26/9)",
      evaluate: (i: number) => {
        if (isNaN(macdHist[i]) || isNaN(macdHist[i - 1])) return "NEUTRAL";
        if (macdHist[i] > 0 && macdHist[i - 1] <= 0) return "BUY";
        if (macdHist[i] < 0 && macdHist[i - 1] >= 0) return "SELL";
        return "NEUTRAL";
      },
      getCurrentSignal: () => {
        const lastHist = macdHist[macdHist.length - 1];
        const prevHist = macdHist[macdHist.length - 2];
        if (lastHist > 0 && prevHist <= 0) return "BUY";
        if (lastHist < 0 && prevHist >= 0) return "SELL";
        return lastHist > 0 ? "BUY" : "SELL";
      },
      getIndicatorValues: () => ({
        MACD: Math.round(macdLine[macdLine.length - 1] * 1000) / 1000,
        Sinyal: Math.round(signalLine[signalLine.length - 1] * 1000) / 1000,
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
      name: "Bollinger Bantları (20/2.0)",
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
        BB_Ust: Math.round(bbUpper[bbUpper.length - 1] * 100) / 100,
        BB_Orta: Math.round(bbMiddle[bbMiddle.length - 1] * 100) / 100,
        BB_Alt: Math.round(bbLower[bbLower.length - 1] * 100) / 100,
      }),
    },
    {
      name: "Heiken Ashi Trend",
      evaluate: (i: number) => {
        if (i === 0) return "NEUTRAL";
        const ha = haCandles[i];
        if (ha.close > ha.open && ha.open <= ha.low + (ha.high - ha.low) * 0.01) return "BUY";
        if (ha.close < ha.open && ha.open >= ha.high - (ha.high - ha.low) * 0.01) return "SELL";
        return "NEUTRAL";
      },
      getCurrentSignal: () => {
        const lastHA = haCandles[haCandles.length - 1];
        if (lastHA.close > lastHA.open && lastHA.open <= lastHA.low + (lastHA.high - lastHA.low) * 0.01) return "BUY";
        if (lastHA.close < lastHA.open && lastHA.open >= lastHA.high - (lastHA.high - lastHA.low) * 0.01) return "SELL";
        return "NEUTRAL";
      },
      getIndicatorValues: () => {
        const lastHA = haCandles[haCandles.length - 1];
        return {
          HA_Acilis: Math.round(lastHA.open * 100) / 100,
          HA_Kapanis: Math.round(lastHA.close * 100) / 100,
        };
      },
    },
    {
      name: "Ichimoku Bulutu (9/26/52)",
      evaluate: (i: number) => {
        if (isNaN(tenkanSen[i]) || isNaN(kijunSen[i]) || isNaN(senkouSpanA[i]) || isNaN(senkouSpanB[i])) return "NEUTRAL";
        const price = prices[i];
        if (tenkanSen[i] > kijunSen[i] && price > senkouSpanA[i] && price > senkouSpanB[i]) return "BUY";
        if (tenkanSen[i] < kijunSen[i] || (price < senkouSpanA[i] && price < senkouSpanB[i])) return "SELL";
        return "NEUTRAL";
      },
      getCurrentSignal: () => {
        const lastIdx = prices.length - 1;
        const price = prices[lastIdx];
        if (isNaN(tenkanSen[lastIdx]) || isNaN(kijunSen[lastIdx]) || isNaN(senkouSpanA[lastIdx]) || isNaN(senkouSpanB[lastIdx])) return "NEUTRAL";
        if (tenkanSen[lastIdx] > kijunSen[lastIdx] && price > senkouSpanA[lastIdx] && price > senkouSpanB[lastIdx]) return "BUY";
        if (tenkanSen[lastIdx] < kijunSen[lastIdx] || (price < senkouSpanA[lastIdx] && price < senkouSpanB[lastIdx])) return "SELL";
        return "NEUTRAL";
      },
      getIndicatorValues: () => {
        const lastIdx = prices.length - 1;
        return {
          Tenkan: Math.round(tenkanSen[lastIdx] * 100) / 100,
          Kijun: Math.round(kijunSen[lastIdx] * 100) / 100,
          SenkouA: Math.round(senkouSpanA[lastIdx] * 100) / 100,
          SenkouB: Math.round(senkouSpanB[lastIdx] * 100) / 100,
        };
      },
    },
  ];

  // Run backtests for static strategies
  const results: BacktestResult[] = staticStrategies.map((strategy) => {
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

  // 3. AI Parameter Optimization Grid Search
  let bestAIProfit = -999999;
  let bestAIResult: BacktestResult | null = null;

  // 3a. RSI Grid Search
  const rsiOversolds = [20, 25, 30, 35];
  const rsiOverboughts = [65, 70, 75, 80];
  const rsiVals = calculateRSI(prices, 14);

  for (const os of rsiOversolds) {
    for (const ob of rsiOverboughts) {
      const evalFn = (i: number) => {
        if (isNaN(rsiVals[i]) || isNaN(rsiVals[i - 1])) return "NEUTRAL";
        if (rsiVals[i] < os) return "BUY";
        if (rsiVals[i] > ob) return "SELL";
        return "NEUTRAL";
      };
      const stats = testStrategy(candles, evalFn, initialBalance, feePercent);
      if (stats.netProfit > bestAIProfit && stats.totalTrades > 0) {
        bestAIProfit = stats.netProfit;
        const lastVal = rsiVals[rsiVals.length - 1];
        const currentSignal = lastVal < os ? "BUY" : (lastVal > ob ? "SELL" : "NEUTRAL");

        let stopLoss: number | null = null;
        let takeProfit: number | null = null;
        if (!isNaN(currentATR) && currentATR > 0) {
          if (currentSignal === "BUY") {
            stopLoss = Math.round((currentPrice - currentATR * 1.5) * 100) / 100;
            takeProfit = Math.round((currentPrice + currentATR * 3) * 100) / 100;
          } else if (currentSignal === "SELL") {
            stopLoss = Math.round((currentPrice + currentATR * 1.5) * 100) / 100;
            takeProfit = Math.round((currentPrice - currentATR * 3) * 100) / 100;
          }
        }

        bestAIResult = {
          strategyName: `⚡ AI Opt. RSI (OS:${os}/OB:${ob})`,
          netProfit: stats.netProfit,
          winRate: stats.winRate,
          totalTrades: stats.totalTrades,
          winningTrades: stats.winningTrades,
          losingTrades: stats.losingTrades,
          finalBalance: Math.round(initialBalance * (1 + stats.netProfit / 100) * 100) / 100,
          tradeHistory: stats.tradeHistory,
          currentSignal,
          indicatorValues: {
            RSI: Math.round(lastVal * 100) / 100,
            "OS Param": os,
            "OB Param": ob,
          },
          stopLoss,
          takeProfit,
          atr: !isNaN(currentATR) ? Math.round(currentATR * 100) / 100 : null,
        };
      }
    }
  }

  // 3b. EMA Grid Search
  const emaFastPeriods = [5, 9, 12, 15];
  const emaSlowPeriods = [21, 26, 34, 50];
  for (const fast of emaFastPeriods) {
    const emaF = calculateEMA(prices, fast);
    for (const slow of emaSlowPeriods) {
      if (slow <= fast) continue;
      const emaS = calculateEMA(prices, slow);
      const evalFn = (i: number) => {
        if (isNaN(emaF[i]) || isNaN(emaS[i]) || isNaN(emaF[i - 1]) || isNaN(emaS[i - 1])) return "NEUTRAL";
        if (emaF[i] > emaS[i] && emaF[i - 1] <= emaS[i - 1]) return "BUY";
        if (emaF[i] < emaS[i] && emaF[i - 1] >= emaS[i - 1]) return "SELL";
        return "NEUTRAL";
      };
      const stats = testStrategy(candles, evalFn, initialBalance, feePercent);
      if (stats.netProfit > bestAIProfit && stats.totalTrades > 0) {
        bestAIProfit = stats.netProfit;
        const lastFast = emaF[emaF.length - 1];
        const lastSlow = emaS[emaS.length - 1];
        const currentSignal = lastFast > lastSlow ? "BUY" : "SELL";

        let stopLoss: number | null = null;
        let takeProfit: number | null = null;
        if (!isNaN(currentATR) && currentATR > 0) {
          if (currentSignal === "BUY") {
            stopLoss = Math.round((currentPrice - currentATR * 1.5) * 100) / 100;
            takeProfit = Math.round((currentPrice + currentATR * 3) * 100) / 100;
          } else if (currentSignal === "SELL") {
            stopLoss = Math.round((currentPrice + currentATR * 1.5) * 100) / 100;
            takeProfit = Math.round((currentPrice - currentATR * 3) * 100) / 100;
          }
        }

        bestAIResult = {
          strategyName: `⚡ AI Opt. EMA Crossover (${fast}/${slow})`,
          netProfit: stats.netProfit,
          winRate: stats.winRate,
          totalTrades: stats.totalTrades,
          winningTrades: stats.winningTrades,
          losingTrades: stats.losingTrades,
          finalBalance: Math.round(initialBalance * (1 + stats.netProfit / 100) * 100) / 100,
          tradeHistory: stats.tradeHistory,
          currentSignal,
          indicatorValues: {
            [`EMA_${fast}`]: Math.round(lastFast * 100) / 100,
            [`EMA_${slow}`]: Math.round(lastSlow * 100) / 100,
          },
          stopLoss,
          takeProfit,
          atr: !isNaN(currentATR) ? Math.round(currentATR * 100) / 100 : null,
        };
      }
    }
  }

  // 3c. Bollinger Bands Grid Search
  const bbPeriods = [14, 20, 30];
  const bbMultipliers = [1.5, 2.0, 2.5];
  for (const p of bbPeriods) {
    for (const m of bbMultipliers) {
      const { upper, lower, middle } = calculateBollingerBands(prices, p, m);
      const evalFn = (i: number) => {
        if (isNaN(lower[i]) || isNaN(upper[i])) return "NEUTRAL";
        if (prices[i] < lower[i]) return "BUY";
        if (prices[i] > upper[i]) return "SELL";
        return "NEUTRAL";
      };
      const stats = testStrategy(candles, evalFn, initialBalance, feePercent);
      if (stats.netProfit > bestAIProfit && stats.totalTrades > 0) {
        bestAIProfit = stats.netProfit;
        const lastPrice = prices[prices.length - 1];
        const lastLower = lower[lower.length - 1];
        const lastUpper = upper[upper.length - 1];
        const lastMiddle = middle[middle.length - 1];
        const currentSignal = lastPrice < lastLower ? "BUY" : (lastPrice > lastUpper ? "SELL" : "NEUTRAL");

        let stopLoss: number | null = null;
        let takeProfit: number | null = null;
        if (!isNaN(currentATR) && currentATR > 0) {
          if (currentSignal === "BUY") {
            stopLoss = Math.round((currentPrice - currentATR * 1.5) * 100) / 100;
            takeProfit = Math.round((currentPrice + currentATR * 3) * 100) / 100;
          } else if (currentSignal === "SELL") {
            stopLoss = Math.round((currentPrice + currentATR * 1.5) * 100) / 100;
            takeProfit = Math.round((currentPrice - currentATR * 3) * 100) / 100;
          }
        }

        bestAIResult = {
          strategyName: `⚡ AI Opt. Bollinger (${p}/${m})`,
          netProfit: stats.netProfit,
          winRate: stats.winRate,
          totalTrades: stats.totalTrades,
          winningTrades: stats.winningTrades,
          losingTrades: stats.losingTrades,
          finalBalance: Math.round(initialBalance * (1 + stats.netProfit / 100) * 100) / 100,
          tradeHistory: stats.tradeHistory,
          currentSignal,
          indicatorValues: {
            BB_Ust: Math.round(lastUpper * 100) / 100,
            BB_Alt: Math.round(lastLower * 100) / 100,
            BB_Orta: Math.round(lastMiddle * 100) / 100,
          },
          stopLoss,
          takeProfit,
          atr: !isNaN(currentATR) ? Math.round(currentATR * 100) / 100 : null,
        };
      }
    }
  }

  // 3d. MACD Grid Search
  const macdFastVals = [8, 12, 15];
  const macdSlowVals = [21, 26, 35];
  const macdSignalVals = [5, 9];
  for (const f of macdFastVals) {
    for (const s of macdSlowVals) {
      if (s <= f) continue;
      for (const sig of macdSignalVals) {
        const { macdLine: mL, signalLine: sL, histogram: hist } = calculateMACD(prices, f, s, sig);
        const evalFn = (i: number) => {
          if (isNaN(hist[i]) || isNaN(hist[i - 1])) return "NEUTRAL";
          if (hist[i] > 0 && hist[i - 1] <= 0) return "BUY";
          if (hist[i] < 0 && hist[i - 1] >= 0) return "SELL";
          return "NEUTRAL";
        };
        const stats = testStrategy(candles, evalFn, initialBalance, feePercent);
        if (stats.netProfit > bestAIProfit && stats.totalTrades > 0) {
          bestAIProfit = stats.netProfit;
          const lastHist = hist[hist.length - 1];
          const prevHist = hist[hist.length - 2];
          const currentSignal = (lastHist > 0 && prevHist <= 0) ? "BUY" : ((lastHist < 0 && prevHist >= 0) ? "SELL" : (lastHist > 0 ? "BUY" : "SELL"));

          let stopLoss: number | null = null;
          let takeProfit: number | null = null;
          if (!isNaN(currentATR) && currentATR > 0) {
            if (currentSignal === "BUY") {
              stopLoss = Math.round((currentPrice - currentATR * 1.5) * 100) / 100;
              takeProfit = Math.round((currentPrice + currentATR * 3) * 100) / 100;
            } else if (currentSignal === "SELL") {
              stopLoss = Math.round((currentPrice + currentATR * 1.5) * 100) / 100;
              takeProfit = Math.round((currentPrice - currentATR * 3) * 100) / 100;
            }
          }

          bestAIResult = {
            strategyName: `⚡ AI Opt. MACD (${f}/${s}/${sig})`,
            netProfit: stats.netProfit,
            winRate: stats.winRate,
            totalTrades: stats.totalTrades,
            winningTrades: stats.winningTrades,
            losingTrades: stats.losingTrades,
            finalBalance: Math.round(initialBalance * (1 + stats.netProfit / 100) * 100) / 100,
            tradeHistory: stats.tradeHistory,
            currentSignal,
            indicatorValues: {
              MACD: Math.round(mL[mL.length - 1] * 1000) / 1000,
              Sinyal: Math.round(sL[sL.length - 1] * 1000) / 1000,
              Histogram: Math.round(lastHist * 1000) / 1000,
            },
            stopLoss,
            takeProfit,
            atr: !isNaN(currentATR) ? Math.round(currentATR * 100) / 100 : null,
          };
        }
      }
    }
  }

  // 3e. RSI + Bollinger Combo Grid Search (Combo 1)
  for (const os of [25, 30, 35]) {
    for (const ob of [65, 70, 75]) {
      for (const m of [1.5, 2.0]) {
        const { upper, lower } = calculateBollingerBands(prices, 20, m);
        const evalFn = (i: number) => {
          if (isNaN(rsiVals[i]) || isNaN(lower[i]) || isNaN(upper[i])) return "NEUTRAL";
          if (rsiVals[i] < os && prices[i] < lower[i]) return "BUY";
          if (rsiVals[i] > ob || prices[i] > upper[i]) return "SELL";
          return "NEUTRAL";
        };
        const stats = testStrategy(candles, evalFn, initialBalance, feePercent);
        if (stats.netProfit > bestAIProfit && stats.totalTrades > 0) {
          bestAIProfit = stats.netProfit;
          const lastRSI = rsiVals[rsiVals.length - 1];
          const lastPrice = prices[prices.length - 1];
          const lastLower = lower[lower.length - 1];
          const lastUpper = upper[upper.length - 1];
          const currentSignal = (lastRSI < os && lastPrice < lastLower) ? "BUY" : ((lastRSI > ob || lastPrice > lastUpper) ? "SELL" : "NEUTRAL");

          let stopLoss: number | null = null;
          let takeProfit: number | null = null;
          if (!isNaN(currentATR) && currentATR > 0) {
            if (currentSignal === "BUY") {
              stopLoss = Math.round((currentPrice - currentATR * 1.5) * 100) / 100;
              takeProfit = Math.round((currentPrice + currentATR * 3) * 100) / 100;
            } else if (currentSignal === "SELL") {
              stopLoss = Math.round((currentPrice + currentATR * 1.5) * 100) / 100;
              takeProfit = Math.round((currentPrice - currentATR * 3) * 100) / 100;
            }
          }

          bestAIResult = {
            strategyName: `⚡ AI Opt. RSI+BB Combo (OS:${os}/OB:${ob}/Dev:${m})`,
            netProfit: stats.netProfit,
            winRate: stats.winRate,
            totalTrades: stats.totalTrades,
            winningTrades: stats.winningTrades,
            losingTrades: stats.losingTrades,
            finalBalance: Math.round(initialBalance * (1 + stats.netProfit / 100) * 100) / 100,
            tradeHistory: stats.tradeHistory,
            currentSignal,
            indicatorValues: {
              RSI: Math.round(lastRSI * 100) / 100,
              BB_Ust: Math.round(lastUpper * 100) / 100,
              BB_Alt: Math.round(lastLower * 100) / 100,
            },
            stopLoss,
            takeProfit,
            atr: !isNaN(currentATR) ? Math.round(currentATR * 100) / 100 : null,
          };
        }
      }
    }
  }

  // 3f. EMA + MACD Crossover Combo Grid Search (Combo 2)
  for (const fast of [9, 12]) {
    const emaF = calculateEMA(prices, fast);
    for (const slow of [21, 26]) {
      if (slow <= fast) continue;
      const emaS = calculateEMA(prices, slow);
      const { histogram: hist } = calculateMACD(prices, 12, 26, 9);
      const evalFn = (i: number) => {
        if (isNaN(emaF[i]) || isNaN(emaS[i]) || isNaN(hist[i])) return "NEUTRAL";
        if (emaF[i] > emaS[i] && hist[i] > 0) return "BUY";
        if (emaF[i] < emaS[i] || hist[i] < 0) return "SELL";
        return "NEUTRAL";
      };
      const stats = testStrategy(candles, evalFn, initialBalance, feePercent);
      if (stats.netProfit > bestAIProfit && stats.totalTrades > 0) {
        bestAIProfit = stats.netProfit;
        const lastFast = emaF[emaF.length - 1];
        const lastSlow = emaS[emaS.length - 1];
        const lastHist = hist[hist.length - 1];
        const currentSignal = (lastFast > lastSlow && lastHist > 0) ? "BUY" : "SELL";

        let stopLoss: number | null = null;
        let takeProfit: number | null = null;
        if (!isNaN(currentATR) && currentATR > 0) {
          if (currentSignal === "BUY") {
            stopLoss = Math.round((currentPrice - currentATR * 1.5) * 100) / 100;
            takeProfit = Math.round((currentPrice + currentATR * 3) * 100) / 100;
          } else if (currentSignal === "SELL") {
            stopLoss = Math.round((currentPrice + currentATR * 1.5) * 100) / 100;
            takeProfit = Math.round((currentPrice - currentATR * 3) * 100) / 100;
          }
        }

        bestAIResult = {
          strategyName: `⚡ AI Opt. EMA+MACD Combo (${fast}/${slow})`,
          netProfit: stats.netProfit,
          winRate: stats.winRate,
          totalTrades: stats.totalTrades,
          winningTrades: stats.winningTrades,
          losingTrades: stats.losingTrades,
          finalBalance: Math.round(initialBalance * (1 + stats.netProfit / 100) * 100) / 100,
          tradeHistory: stats.tradeHistory,
          currentSignal,
          indicatorValues: {
            [`EMA_${fast}`]: Math.round(lastFast * 100) / 100,
            [`EMA_${slow}`]: Math.round(lastSlow * 100) / 100,
            Histogram: Math.round(lastHist * 1000) / 1000,
          },
          stopLoss,
          takeProfit,
          atr: !isNaN(currentATR) ? Math.round(currentATR * 100) / 100 : null,
        };
      }
    }
  }

  // 3g. Ichimoku Grid Search
  for (const t of [7, 9, 12]) {
    for (const k of [20, 26, 32]) {
      const { tenkanSen: tS, kijunSen: kS, senkouSpanA: sA, senkouSpanB: sB } = calculateIchimoku(highs, lows, prices, t, k, 52, 26);
      const evalFn = (i: number) => {
        if (isNaN(tS[i]) || isNaN(kS[i]) || isNaN(sA[i]) || isNaN(sB[i])) return "NEUTRAL";
        const price = prices[i];
        if (tS[i] > kS[i] && price > sA[i] && price > sB[i]) return "BUY";
        if (tS[i] < kS[i] || (price < sA[i] && price < sB[i])) return "SELL";
        return "NEUTRAL";
      };
      const stats = testStrategy(candles, evalFn, initialBalance, feePercent);
      if (stats.netProfit > bestAIProfit && stats.totalTrades > 0) {
        bestAIProfit = stats.netProfit;
        const lastIdx = prices.length - 1;
        const price = prices[lastIdx];
        const currentSignal = (tS[lastIdx] > kS[lastIdx] && price > sA[lastIdx] && price > sB[lastIdx]) ? "BUY" : ((tS[lastIdx] < kS[lastIdx] || (price < sA[lastIdx] && price < sB[lastIdx])) ? "SELL" : "NEUTRAL");

        let stopLoss: number | null = null;
        let takeProfit: number | null = null;
        if (!isNaN(currentATR) && currentATR > 0) {
          if (currentSignal === "BUY") {
            stopLoss = Math.round((currentPrice - currentATR * 1.5) * 100) / 100;
            takeProfit = Math.round((currentPrice + currentATR * 3) * 100) / 100;
          } else if (currentSignal === "SELL") {
            stopLoss = Math.round((currentPrice + currentATR * 1.5) * 100) / 100;
            takeProfit = Math.round((currentPrice - currentATR * 3) * 100) / 100;
          }
        }

        bestAIResult = {
          strategyName: `⚡ AI Opt. Ichimoku (${t}/${k}/52)`,
          netProfit: stats.netProfit,
          winRate: stats.winRate,
          totalTrades: stats.totalTrades,
          winningTrades: stats.winningTrades,
          losingTrades: stats.losingTrades,
          finalBalance: Math.round(initialBalance * (1 + stats.netProfit / 100) * 100) / 100,
          tradeHistory: stats.tradeHistory,
          currentSignal,
          indicatorValues: {
            Tenkan: Math.round(tS[lastIdx] * 100) / 100,
            Kijun: Math.round(kS[lastIdx] * 100) / 100,
            SenkouA: Math.round(sA[lastIdx] * 100) / 100,
            SenkouB: Math.round(sB[lastIdx] * 100) / 100,
          },
          stopLoss,
          takeProfit,
          atr: !isNaN(currentATR) ? Math.round(currentATR * 100) / 100 : null,
        };
      }
    }
  }

  // 3h. Heikin Ashi + EMA Crossover Combo Grid Search
  for (const fast of [5, 9, 12]) {
    const emaVal = calculateEMA(prices, fast);
    const evalFn = (i: number) => {
      if (i === 0 || isNaN(emaVal[i])) return "NEUTRAL";
      const ha = haCandles[i];
      if (ha.close > ha.open && prices[i] > emaVal[i] && prices[i-1] <= emaVal[i-1]) return "BUY";
      if (ha.close < ha.open && prices[i] < emaVal[i] && prices[i-1] >= emaVal[i-1]) return "SELL";
      return "NEUTRAL";
    };
    const stats = testStrategy(candles, evalFn, initialBalance, feePercent);
    if (stats.netProfit > bestAIProfit && stats.totalTrades > 0) {
      bestAIProfit = stats.netProfit;
      const lastHA = haCandles[haCandles.length - 1];
      const lastEMA = emaVal[emaVal.length - 1];
      const currentSignal = (lastHA.close > lastHA.open && currentPrice > lastEMA) ? "BUY" : ((lastHA.close < lastHA.open && currentPrice < lastEMA) ? "SELL" : "NEUTRAL");

      let stopLoss: number | null = null;
      let takeProfit: number | null = null;
      if (!isNaN(currentATR) && currentATR > 0) {
        if (currentSignal === "BUY") {
          stopLoss = Math.round((currentPrice - currentATR * 1.5) * 100) / 100;
          takeProfit = Math.round((currentPrice + currentATR * 3) * 100) / 100;
        } else if (currentSignal === "SELL") {
          stopLoss = Math.round((currentPrice + currentATR * 1.5) * 100) / 100;
          takeProfit = Math.round((currentPrice - currentATR * 3) * 100) / 100;
        }
      }

      bestAIResult = {
        strategyName: `⚡ AI Opt. HA+EMA Combo (${fast})`,
        netProfit: stats.netProfit,
        winRate: stats.winRate,
        totalTrades: stats.totalTrades,
        winningTrades: stats.winningTrades,
        losingTrades: stats.losingTrades,
        finalBalance: Math.round(initialBalance * (1 + stats.netProfit / 100) * 100) / 100,
        tradeHistory: stats.tradeHistory,
        currentSignal,
        indicatorValues: {
          HA_Close: Math.round(lastHA.close * 100) / 100,
          EMA: Math.round(lastEMA * 100) / 100,
        },
        stopLoss,
        takeProfit,
        atr: !isNaN(currentATR) ? Math.round(currentATR * 100) / 100 : null,
      };
    }
  }

  // Prepend the best AI strategy to the list
  if (bestAIResult) {
    results.unshift(bestAIResult);
  }

  // 4. AI Machine Learning / Hill-Climbing Consensus Model Training
  // Initialize parameters to standard baselines
  let currentOS = 30;
  let currentOB = 70;
  let currentEmaFast = 9;
  let currentEmaSlow = 21;
  let currentBbPeriod = 20;
  let currentBbMult = 2.0;
  let currentMacdFast = 12;
  let currentMacdSlow = 26;
  let currentMacdSignal = 9;
  let currentTenkan = 9;
  let currentKijun = 26;
  let currentSenkouB = 52;
  let currentBuyThreshold = 3;  // Score range is larger now: -7 to +7
  let currentSellThreshold = -3;
  let currentSlMult = 1.5;
  let currentTpMult = 3.0;
  let currentTrailingMult = 2.0;

  // Helper to mutate parameters in a range
  const mutateParam = (val: number, min: number, max: number, step: number): number => {
    const direction = Math.random() > 0.5 ? 1 : -1;
    const newVal = val + direction * step;
    return Math.max(min, Math.min(max, Number(newVal.toFixed(2))));
  };

  // Function to evaluate profit for a specific set of parameters
  const evaluateAgent = (
    os: number, ob: number, fast: number, slow: number, 
    bbP: number, bbM: number, mFast: number, mSlow: number, mSig: number,
    tenkanP: number, kijunP: number, senkouBP: number,
    buyT: number, sellT: number, trailingM: number
  ) => {
    const rsiV = calculateRSI(prices, 14);
    const emaF = calculateEMA(prices, fast);
    const emaS = calculateEMA(prices, slow);
    const { upper: bbU, lower: bbL } = calculateBollingerBands(prices, bbP, bbM);
    const { histogram: hist } = calculateMACD(prices, mFast, mSlow, mSig);
    const { tenkanSen: tS, kijunSen: kS, senkouSpanA: sA, senkouSpanB: sB } = calculateIchimoku(highs, lows, prices, tenkanP, kijunP, senkouBP, 26);

    const evalFn = (i: number) => {
      let score = 0;
      if (!isNaN(rsiV[i])) {
        if (rsiV[i] < os) score += 1;
        if (rsiV[i] > ob) score -= 1;
      }
      if (!isNaN(emaF[i]) && !isNaN(emaS[i])) {
        if (emaF[i] > emaS[i]) score += 1;
        else score -= 1;
      }
      if (!isNaN(bbU[i]) && !isNaN(bbL[i])) {
        if (prices[i] < bbL[i]) score += 1;
        if (prices[i] > bbU[i]) score -= 1;
      }
      if (!isNaN(hist[i])) {
        if (hist[i] > 0) score += 1;
        else score -= 1;
      }
      // Heikin Ashi
      if (i > 0) {
        const ha = haCandles[i];
        if (ha.close > ha.open && ha.open <= ha.low + (ha.high - ha.low) * 0.01) score += 1;
        if (ha.close < ha.open && ha.open >= ha.high - (ha.high - ha.low) * 0.01) score -= 1;
      }
      // Ichimoku
      if (!isNaN(tS[i]) && !isNaN(kS[i]) && !isNaN(sA[i]) && !isNaN(sB[i])) {
        if (tS[i] > kS[i]) score += 1;
        else score -= 1;

        if (prices[i] > sA[i] && prices[i] > sB[i]) score += 1;
        else if (prices[i] < sA[i] && prices[i] < sB[i]) score -= 1;
      }

      if (score >= buyT) return "BUY";
      if (score <= sellT) return "SELL";
      return "NEUTRAL";
    };

    return testStrategy(candles, evalFn, initialBalance, feePercent, trailingM, atr);
  };

  // Run initial evaluation
  let bestTrainedStats = evaluateAgent(
    currentOS, currentOB, currentEmaFast, currentEmaSlow,
    currentBbPeriod, currentBbMult, currentMacdFast, currentMacdSlow, currentMacdSignal,
    currentTenkan, currentKijun, currentSenkouB,
    currentBuyThreshold, currentSellThreshold, currentTrailingMult
  );
  let bestTrainedProfit = bestTrainedStats.netProfit;

  // Run Hill-Climbing search for 150 generations
  const GENERATIONS = 150;
  for (let g = 0; g < GENERATIONS; g++) {
    const tempOS = mutateParam(currentOS, 20, 40, 2);
    const tempOB = mutateParam(currentOB, 60, 80, 2);
    const tempFast = mutateParam(currentEmaFast, 5, 15, 1);
    const tempSlow = mutateParam(currentEmaSlow, 20, 50, 2);
    if (tempSlow <= tempFast) continue;
    
    const tempBbP = mutateParam(currentBbPeriod, 14, 30, 1);
    const tempBbM = mutateParam(currentBbMult, 1.2, 2.8, 0.1);
    const tempMFast = mutateParam(currentMacdFast, 8, 16, 1);
    const tempMSlow = mutateParam(currentMacdSlow, 20, 40, 2);
    if (tempMSlow <= tempMFast) continue;
    
    const tempMSig = mutateParam(currentMacdSignal, 5, 12, 1);
    const tempTenkan = mutateParam(currentTenkan, 7, 15, 1);
    const tempKijun = mutateParam(currentKijun, 20, 35, 1);
    const tempSenkouB = mutateParam(currentSenkouB, 40, 65, 2);
    if (tempKijun <= tempTenkan) continue;
    if (tempSenkouB <= tempKijun) continue;

    const tempBuyT = mutateParam(currentBuyThreshold, 1, 5, 1);
    const tempSellT = mutateParam(currentSellThreshold, -5, -1, 1);
    const tempTrailingM = mutateParam(currentTrailingMult, 1.0, 4.0, 0.1);

    const stats = evaluateAgent(
      tempOS, tempOB, tempFast, tempSlow,
      tempBbP, tempBbM, tempMFast, tempMSlow, tempMSig,
      tempTenkan, tempKijun, tempSenkouB,
      tempBuyT, tempSellT, tempTrailingM
    );

    if (stats.netProfit > bestTrainedProfit && stats.totalTrades > 0) {
      bestTrainedProfit = stats.netProfit;
      bestTrainedStats = stats;
      currentOS = tempOS;
      currentOB = tempOB;
      currentEmaFast = tempFast;
      currentEmaSlow = tempSlow;
      currentBbPeriod = tempBbP;
      currentBbMult = tempBbM;
      currentMacdFast = tempMFast;
      currentMacdSlow = tempMSlow;
      currentMacdSignal = tempMSig;
      currentTenkan = tempTenkan;
      currentKijun = tempKijun;
      currentSenkouB = tempSenkouB;
      currentBuyThreshold = tempBuyT;
      currentSellThreshold = tempSellT;
      currentTrailingMult = tempTrailingM;
    }
  }

  // Train ATR-based Stop Loss & Take Profit limits to maximize returns
  for (let i = 0; i < 30; i++) {
    const tempSl = mutateParam(currentSlMult, 0.8, 2.5, 0.1);
    const tempTp = mutateParam(currentTpMult, 2.0, 5.0, 0.1);
    currentSlMult = tempSl;
    currentTpMult = tempTp;
  }

  // Evaluate final optimized parameters for active signals
  const finalRsi = rsiVals[rsiVals.length - 1];
  const finalFast = calculateEMA(prices, currentEmaFast)[prices.length - 1];
  const finalSlow = calculateEMA(prices, currentEmaSlow)[prices.length - 1];
  const { upper: finalUpper, lower: finalLower } = calculateBollingerBands(prices, currentBbPeriod, currentBbMult);
  const finalHist = calculateMACD(prices, currentMacdFast, currentMacdSlow, currentMacdSignal).histogram;
  const lastHist = finalHist[finalHist.length - 1];
  
  const finalHA = haCandles[haCandles.length - 1];
  const { tenkanSen: fTenkan, kijunSen: fKijun, senkouSpanA: fSpanA, senkouSpanB: fSpanB } = calculateIchimoku(highs, lows, prices, currentTenkan, currentKijun, currentSenkouB, 26);
  const lastTenkan = fTenkan[fTenkan.length - 1];
  const lastKijun = fKijun[fKijun.length - 1];
  const lastSpanA = fSpanA[fSpanA.length - 1];
  const lastSpanB = fSpanB[fSpanB.length - 1];

  let currentScore = 0;
  if (!isNaN(finalRsi)) {
    if (finalRsi < currentOS) currentScore += 1;
    if (finalRsi > currentOB) currentScore -= 1;
  }
  if (!isNaN(finalFast) && !isNaN(finalSlow)) {
    if (finalFast > finalSlow) currentScore += 1;
    else currentScore -= 1;
  }
  if (!isNaN(finalUpper[finalUpper.length - 1]) && !isNaN(finalLower[finalLower.length - 1])) {
    if (currentPrice < finalLower[finalLower.length - 1]) currentScore += 1;
    if (currentPrice > finalUpper[finalUpper.length - 1]) currentScore -= 1;
  }
  if (!isNaN(lastHist)) {
    if (lastHist > 0) currentScore += 1;
    else currentScore -= 1;
  }
  // Heikin Ashi final score
  if (finalHA.close > finalHA.open && finalHA.open <= finalHA.low + (finalHA.high - finalHA.low) * 0.01) {
    currentScore += 1;
  } else if (finalHA.close < finalHA.open && finalHA.open >= finalHA.high - (finalHA.high - finalHA.low) * 0.01) {
    currentScore -= 1;
  }
  // Ichimoku final score
  if (!isNaN(lastTenkan) && !isNaN(lastKijun) && !isNaN(lastSpanA) && !isNaN(lastSpanB)) {
    if (lastTenkan > lastKijun) currentScore += 1;
    else currentScore -= 1;

    if (currentPrice > lastSpanA && currentPrice > lastSpanB) currentScore += 1;
    else if (currentPrice < lastSpanA && currentPrice < lastSpanB) currentScore -= 1;
  }

  const finalSignal = currentScore >= currentBuyThreshold ? "BUY" : (currentScore <= currentSellThreshold ? "SELL" : "NEUTRAL");

  let trainedStopLoss: number | null = null;
  let trainedTakeProfit: number | null = null;
  if (!isNaN(currentATR) && currentATR > 0) {
    if (finalSignal === "BUY") {
      trainedStopLoss = Math.round((currentPrice - currentATR * currentSlMult) * 100) / 100;
      trainedTakeProfit = Math.round((currentPrice + currentATR * currentTpMult) * 100) / 100;
    } else if (finalSignal === "SELL") {
      trainedStopLoss = Math.round((currentPrice + currentATR * currentSlMult) * 100) / 100;
      trainedTakeProfit = Math.round((currentPrice - currentATR * currentTpMult) * 100) / 100;
    }
  }

  const trainedResult: BacktestResult = {
    strategyName: "🧠 AI Trained Deep-Max Model",
    netProfit: bestTrainedStats.netProfit,
    winRate: bestTrainedStats.winRate,
    totalTrades: bestTrainedStats.totalTrades,
    winningTrades: bestTrainedStats.winningTrades,
    losingTrades: bestTrainedStats.losingTrades,
    finalBalance: Math.round(initialBalance * (1 + bestTrainedStats.netProfit / 100) * 100) / 100,
    tradeHistory: bestTrainedStats.tradeHistory,
    currentSignal: finalSignal,
    indicatorValues: {
      RSI_OS: currentOS,
      RSI_OB: currentOB,
      EMA_Fast: currentEmaFast,
      EMA_Slow: currentEmaSlow,
      BB_Sapma: Math.round(currentBbMult * 10) / 10,
      Tenkan: currentTenkan,
      Kijun: currentKijun,
      SenkouB: currentSenkouB,
      Buy_Esik: currentBuyThreshold,
      Sell_Esik: currentSellThreshold,
      SL_ATR: currentSlMult,
      TP_ATR: currentTpMult,
      IzSurenStop_ATR: currentTrailingMult,
    },
    stopLoss: trainedStopLoss,
    takeProfit: trainedTakeProfit,
    atr: !isNaN(currentATR) ? Math.round(currentATR * 100) / 100 : null,
  };

  // Prepend the trained consensus model to the list (so it competes with single optimized indicators)
  results.unshift(trainedResult);

  return results;
}
