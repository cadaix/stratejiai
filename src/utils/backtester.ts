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

// Helper function to test a strategy with dynamic criteria
function testStrategy(
  candles: Candle[],
  evaluate: (i: number) => "BUY" | "SELL" | "NEUTRAL",
  initialBalance: number = 10000,
  feePercent: number = 0.1
) {
  const feeFactor = feePercent / 100;
  let balance = initialBalance;
  let position = 0;
  let inPosition = false;
  let buyPrice = 0;
  const tradeHistory: Trade[] = [];
  let winningTrades = 0;
  let losingTrades = 0;

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const decision = evaluate(i);

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

  // Prepend the best AI strategy to the list
  if (bestAIResult) {
    results.unshift(bestAIResult);
  }

  return results;
}
