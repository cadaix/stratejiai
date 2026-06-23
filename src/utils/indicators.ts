export function calculateSMA(prices: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += prices[i - j];
      }
      sma.push(sum / period);
    }
  }
  return sma;
}

export function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  if (prices.length === 0) return [];
  const k = 2 / (period + 1);
  
  // First value is SMA
  let smaSum = 0;
  const initialPeriod = Math.min(period, prices.length);
  for (let i = 0; i < initialPeriod; i++) {
    smaSum += prices[i];
  }
  const firstEMA = smaSum / initialPeriod;

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      ema.push(NaN);
    } else if (i === period - 1) {
      ema.push(firstEMA);
    } else {
      const currentEMA = prices[i] * k + ema[i - 1] * (1 - k);
      ema.push(currentEMA);
    }
  }
  return ema;
}

export function calculateRSI(prices: number[], period: number = 14): number[] {
  const rsi: number[] = Array(prices.length).fill(NaN);
  if (prices.length <= period) return rsi;

  let gains = 0;
  let losses = 0;

  // First change
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return rsi;
}

export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macdLine: number[]; signalLine: number[]; histogram: number[] } {
  const macdLine: number[] = Array(prices.length).fill(NaN);
  const signalLine: number[] = Array(prices.length).fill(NaN);
  const histogram: number[] = Array(prices.length).fill(NaN);

  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);

  for (let i = 0; i < prices.length; i++) {
    if (!isNaN(fastEMA[i]) && !isNaN(slowEMA[i])) {
      macdLine[i] = fastEMA[i] - slowEMA[i];
    }
  }

  const firstValidIdx = macdLine.findIndex((val) => !isNaN(val));
  if (firstValidIdx !== -1) {
    const validMACD = macdLine.slice(firstValidIdx);
    const validSignal = calculateEMA(validMACD, signalPeriod);
    
    for (let i = 0; i < validSignal.length; i++) {
      const idx = firstValidIdx + i;
      signalLine[idx] = validSignal[i];
      if (!isNaN(macdLine[idx]) && !isNaN(validSignal[i])) {
        histogram[idx] = macdLine[idx] - validSignal[i];
      }
    }
  }

  return { macdLine, signalLine, histogram };
}

export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  multiplier: number = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  const upper: number[] = Array(prices.length).fill(NaN);
  const middle = calculateSMA(prices, period);
  const lower: number[] = Array(prices.length).fill(NaN);

  for (let i = 0; i < prices.length; i++) {
    if (i >= period - 1) {
      const mean = middle[i];
      let varianceSum = 0;
      for (let j = 0; j < period; j++) {
        varianceSum += Math.pow(prices[i - j] - mean, 2);
      }
      const stdDev = Math.sqrt(varianceSum / period);
      upper[i] = mean + multiplier * stdDev;
      lower[i] = mean - multiplier * stdDev;
    }
  }

  return { upper, middle, lower };
}

export function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number[] {
  const atr: number[] = Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return atr;

  const trueRanges: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    trueRanges.push(Math.max(hl, hc, lc));
  }

  // First ATR = simple average of first `period` true ranges
  let sumTR = 0;
  for (let i = 0; i < period; i++) sumTR += trueRanges[i];
  let prevATR = sumTR / period;
  atr[period] = prevATR;

  for (let i = period; i < trueRanges.length; i++) {
    const currentATR = (prevATR * (period - 1) + trueRanges[i]) / period;
    atr[i + 1] = currentATR;
    prevATR = currentATR;
  }

  return atr;
}
