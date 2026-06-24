import { NextResponse } from "next/server";
import { fetchCandles } from "@/utils/binance";
import { runBacktest } from "@/utils/backtester";

const SYMBOLS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"];
const TIMEFRAMES = ["1d", "4h", "1h"];

export async function GET(request: Request) {
  // Verify authorization header from Vercel Cron or secret query parameter
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get("secret");

  const authHeader = request.headers.get("authorization");
  const isHeaderAuthorized = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isQueryAuthorized = process.env.CRON_SECRET && querySecret === process.env.CRON_SECRET;

  if (process.env.CRON_SECRET && !isHeaderAuthorized && !isQueryAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables must be configured." },
      { status: 500 }
    );
  }

  const isTest = searchParams.get("test") === "true";
  if (isTest) {
    try {
      const testMessage = `*🤖 Trade Hub AI Test Mesajı*\n\nTelegram bot bağlantınız başarıyla kurulmuştur! Sinyaller oluştuğunda bu kanal üzerinden bilgilendirileceksiniz.`;
      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const response = await fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: testMessage,
          parse_mode: "Markdown",
        }),
      });

      if (response.ok) {
        return NextResponse.json({ status: "Success", message: "Test message sent to Telegram successfully!" });
      } else {
        const errorText = await response.text();
        return NextResponse.json({ status: "Failed", error: `Telegram API error: ${errorText}` }, { status: 400 });
      }
    } catch (err: any) {
      return NextResponse.json({ status: "Failed", error: err.message }, { status: 500 });
    }
  }

  const sentAlerts: any[] = [];
  const processedSymbols = Array.from(new Set(SYMBOLS));

  for (const symbol of processedSymbols) {
    for (const timeframe of TIMEFRAMES) {
      try {
        // Fetch historical data (e.g. 5-year daily backtest limit for 1d, or standard 500 for shorter timeframes)
        const limit = timeframe === "1d" ? 1000 : 500;
        const candles = await fetchCandles(symbol, timeframe, limit);

        if (candles.length === 0) continue;

        // Run backtest & AI parameters optimization
        const backtestResults = runBacktest(candles);
        if (backtestResults.length === 0) continue;

        // Pre-eminent strategy is always results[0] -> 🧠 AI Trained Deep-Max Model
        const aiModel = backtestResults[0];

        // Alert only when the AI model emits a strong BUY or SELL signal
        if (aiModel.currentSignal === "BUY" || aiModel.currentSignal === "SELL") {
          const currentPrice = candles[candles.length - 1].close;
          const signalEmoji = aiModel.currentSignal === "BUY" ? "🟢 AL (BUY)" : "🔴 SAT (SELL)";
          
          let message = `*🔔 Trade Hub AI Sinyal Uyarısı*\n\n`;
          message += `*Coin:* ${symbol}\n`;
          message += `*Zaman Dilimi:* ${timeframe}\n`;
          message += `*Güncel Fiyat:* $${currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n`;
          message += `*Yapay Zeka Sinyali:* ${signalEmoji}\n\n`;
          message += `*🧠 Eğitilmiş Model İstatistikleri (5 Yıl):*\n`;
          message += `- Başarı Oranı: %${aiModel.winRate}\n`;
          message += `- Geriye Dönük Kar: %${aiModel.netProfit}\n`;
          if (aiModel.stopLoss) message += `- Önerilen Stop Loss: $${aiModel.stopLoss.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n`;
          if (aiModel.takeProfit) message += `- Önerilen Take Profit: $${aiModel.takeProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n`;
          
          // Add trailing stop details if active
          if (aiModel.indicatorValues && aiModel.indicatorValues.IzSurenStop_ATR) {
            message += `- İz Süren Stop Katsayısı: ${aiModel.indicatorValues.IzSurenStop_ATR}x ATR\n`;
          }

          // Send message using Telegram Bot API
          const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
          const response = await fetch(telegramUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: message,
              parse_mode: "Markdown",
            }),
          });

          if (response.ok) {
            sentAlerts.push({ symbol, timeframe, signal: aiModel.currentSignal });
          }
        }
      } catch (err: any) {
        console.error(`Error processing alert for ${symbol} on ${timeframe}:`, err);
      }
    }
  }

  return NextResponse.json({ status: "Success", sentAlerts });
}
