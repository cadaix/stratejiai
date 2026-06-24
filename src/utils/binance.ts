export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchCandles(
  symbol: string,
  interval: string,
  limit: number = 500
): Promise<Candle[]> {
  // Translate symbol to Binance format, e.g., BTC/USDT -> BTCUSDT
  const binanceSymbol = symbol.replace("/", "").toUpperCase();

  // If interval is yearly, fetch 1M and aggregate it
  const isYearly = interval === "1y";
  const isFiveYears = interval === "5y";
  const fetchInterval = isYearly ? "1M" : (isFiveYears ? "1d" : interval);
  
  // If yearly, we need 1000 candles to aggregate. If 5-year daily backtest, we need ~1825 candles.
  const targetLimit = isYearly ? 1000 : (isFiveYears ? 1825 : limit);

  let allCandles: Candle[] = [];
  let endTime: number | null = null;

  try {
    while (allCandles.length < targetLimit) {
      const currentBatchLimit = Math.min(1000, targetLimit - allCandles.length);
      let url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${fetchInterval}&limit=${currentBatchLimit}`;
      if (endTime !== null) {
        url += `&endTime=${endTime}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Binance API error: ${res.statusText}`);
      }

      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        break;
      }

      const candles: Candle[] = data.map((item: (string | number)[]) => ({
        time: Math.floor(Number(item[0]) / 1000), // convert ms to seconds
        open: Number(item[1]),
        high: Number(item[2]),
        low: Number(item[3]),
        close: Number(item[4]),
        volume: Number(item[5]),
      }));

      // Prepend the older candles to our list
      allCandles = [...candles, ...allCandles];

      const oldestTimeMs = Number(data[0][0]);
      if (endTime !== null && oldestTimeMs >= endTime) {
        break; // safety check to prevent infinite loop
      }
      endTime = oldestTimeMs - 1;

      // If we received fewer candles than we asked for, it means we reached the beginning of history
      if (data.length < currentBatchLimit) {
        break;
      }
    }

    // Deduplicate and sort
    const uniqueMap = new Map<number, Candle>();
    allCandles.forEach((c) => uniqueMap.set(c.time, c));
    const sortedCandles = Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);

    if (isYearly) {
      return aggregateToYearly(sortedCandles);
    }

    return sortedCandles;
  } catch (error) {
    console.error("Error fetching candles from Binance:", error);
    throw error;
  }
}

/**
 * Aggregates monthly candles into yearly candles.
 */
function aggregateToYearly(monthlyCandles: Candle[]): Candle[] {
  if (monthlyCandles.length === 0) return [];

  const yearlyGroups: { [year: number]: Candle[] } = {};

  monthlyCandles.forEach((candle) => {
    const year = new Date(candle.time * 1000).getUTCFullYear();
    if (!yearlyGroups[year]) {
      yearlyGroups[year] = [];
    }
    yearlyGroups[year].push(candle);
  });

  const yearlyCandles: Candle[] = [];

  const sortedYears = Object.keys(yearlyGroups)
    .map(Number)
    .sort((a, b) => a - b);

  sortedYears.forEach((year) => {
    const group = yearlyGroups[year];
    // Sort group by time ascending
    group.sort((a, b) => a.time - b.time);

    const openCandle = group[0];
    const closeCandle = group[group.length - 1];

    const highs = group.map((c) => c.high);
    const lows = group.map((c) => c.low);
    const totalVolume = group.reduce((sum, c) => sum + c.volume, 0);

    yearlyCandles.push({
      time: openCandle.time, // Use the timestamp of the first month of the year
      open: openCandle.open,
      high: Math.max(...highs),
      low: Math.min(...lows),
      close: closeCandle.close,
      volume: totalVolume,
    });
  });

  return yearlyCandles;
}
