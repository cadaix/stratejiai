import { Candle } from "./binance";

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

export interface HeikinAshiCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function calculateHeikinAshi(candles: Candle[]): HeikinAshiCandle[] {
  const haCandles: HeikinAshiCandle[] = [];
  if (candles.length === 0) return haCandles;

  // First candle initialization
  let prevOpen = (candles[0].open + candles[0].close) / 2;
  let prevClose = (candles[0].open + candles[0].high + candles[0].low + candles[0].close) / 4;
  let prevHigh = Math.max(candles[0].high, prevOpen, prevClose);
  let prevLow = Math.min(candles[0].low, prevOpen, prevClose);

  haCandles.push({
    time: candles[0].time,
    open: prevOpen,
    high: prevHigh,
    low: prevLow,
    close: prevClose,
    volume: candles[0].volume,
  });

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const close = (c.open + c.high + c.low + c.close) / 4;
    const open = (prevOpen + prevClose) / 2;
    const high = Math.max(c.high, open, close);
    const low = Math.min(c.low, open, close);

    haCandles.push({
      time: c.time,
      open,
      high,
      low,
      close,
      volume: c.volume,
    });

    prevOpen = open;
    prevClose = close;
  }

  return haCandles;
}

export interface IchimokuResult {
  tenkanSen: number[];
  kijunSen: number[];
  senkouSpanA: number[];
  senkouSpanB: number[];
  chikouSpan: number[];
}

export function calculateIchimoku(
  highs: number[],
  lows: number[],
  closes: number[],
  tenkanPeriod: number = 9,
  kijunPeriod: number = 26,
  senkouBPeriod: number = 52,
  displacement: number = 26
): IchimokuResult {
  const len = closes.length;
  const tenkanSen: number[] = Array(len).fill(NaN);
  const kijunSen: number[] = Array(len).fill(NaN);
  const senkouSpanA: number[] = Array(len).fill(NaN);
  const senkouSpanB: number[] = Array(len).fill(NaN);
  const chikouSpan: number[] = Array(len).fill(NaN);

  const getPeriodHighLow = (startIdx: number, period: number) => {
    let maxHigh = -Infinity;
    let minLow = Infinity;
    const searchStart = Math.max(0, startIdx - period + 1);
    for (let i = searchStart; i <= startIdx; i++) {
      if (highs[i] > maxHigh) maxHigh = highs[i];
      if (lows[i] < minLow) minLow = lows[i];
    }
    return { maxHigh, minLow };
  };

  for (let i = 0; i < len; i++) {
    // Tenkan-sen
    if (i >= tenkanPeriod - 1) {
      const { maxHigh, minLow } = getPeriodHighLow(i, tenkanPeriod);
      tenkanSen[i] = (maxHigh + minLow) / 2;
    }

    // Kijun-sen
    if (i >= kijunPeriod - 1) {
      const { maxHigh, minLow } = getPeriodHighLow(i, kijunPeriod);
      kijunSen[i] = (maxHigh + minLow) / 2;
    }

    // Senkou Span A (plotted displacement periods forward)
    const targetIdx = i + displacement;
    if (targetIdx < len && !isNaN(tenkanSen[i]) && !isNaN(kijunSen[i])) {
      senkouSpanA[targetIdx] = (tenkanSen[i] + kijunSen[i]) / 2;
    }

    // Senkou Span B (plotted displacement periods forward)
    if (i >= senkouBPeriod - 1 && targetIdx < len) {
      const { maxHigh, minLow } = getPeriodHighLow(i, senkouBPeriod);
      senkouSpanB[targetIdx] = (maxHigh + minLow) / 2;
    }

    // Chikou Span (lagging close, plotted displacement periods behind)
    const lagIdx = i - displacement;
    if (lagIdx >= 0) {
      chikouSpan[lagIdx] = closes[i];
    }
  }

  return { tenkanSen, kijunSen, senkouSpanA, senkouSpanB, chikouSpan };
}
