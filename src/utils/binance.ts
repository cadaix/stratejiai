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
  const fetchInterval = isYearly ? "1M" : interval;
  // If yearly, we need more history to construct yearly candles (e.g. 1000 months is ~83 years, but Binance max is ~1000 anyway)
  const fetchLimit = isYearly ? 1000 : limit;

  const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${fetchInterval}&limit=${fetchLimit}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Binance API error: ${res.statusText}`);
    }

    const data = await res.json();
    
    const candles: Candle[] = data.map((item: any) => ({
      time: Math.floor(Number(item[0]) / 1000), // convert ms to seconds
      open: Number(item[1]),
      high: Number(item[2]),
      low: Number(item[3]),
      close: Number(item[4]),
      volume: Number(item[5]),
    }));

    if (isYearly) {
      return aggregateToYearly(candles);
    }

    return candles;
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
