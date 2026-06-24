import { NextResponse } from "next/server";
import { fetchCandles } from "@/utils/binance";
import { runBacktest } from "@/utils/backtester";

const SYMBOLS = ["BTC/USDT", "SOL/USDT"];
const TIMEFRAMES = ["1h", "1d", "1w"];

function buildCommentary(timeframeLabel: string, price: number, ind: any): string {
  if (!ind) {
    return `• *${timeframeLabel}:* Fiyat: $${price.toLocaleString("en-US", { minimumFractionDigits: 2 })}, Teknik veriler yüklenemedi.`;
  }

  const rsi = ind.RSI || 50;
  const emaFast = ind.EMA_Hizli_Deger || price;
  const emaSlow = ind.EMA_Yavas_Deger || price;
  const bbUpper = ind.BB_Ust_Deger || price;
  const bbLower = ind.BB_Alt_Deger || price;
  const macdHist = ind.MACD_Histogram || 0;
  const haClose = ind.HA_Close || price;
  const haOpen = ind.HA_Open || price;
  const tenkan = ind.Tenkan_Deger || price;
  const kijun = ind.Kijun_Deger || price;
  const spanA = ind.SenkouA_Deger || price;
  const spanB = ind.SenkouB_Deger || price;

  const trend = emaFast > emaSlow ? "Yükseliş (Boğa) 🟢" : "Düşüş (Ayı) 🔴";
  
  let rsiText = "";
  if (rsi > 70) rsiText = "Aşırı Alım ⚠️";
  else if (rsi < 30) rsiText = "Aşırı Satım 📉";
  else rsiText = `Nötr (${Math.round(rsi)})`;

  let bbText = "Dengeli";
  if (price >= bbUpper) bbText = "Üst Band (Aşırı Değerli) ⚠️";
  else if (price <= bbLower) bbText = "Alt Band (Aşırı Satılmış) 📉";

  const macdText = macdHist > 0 ? "Alıcı İvmeli 📈" : "Satıcı İvmeli 📉";
  const haText = haClose > haOpen ? "Alıcı Ağırlıklı 🟢" : "Satıcı Ağırlıklı 🔴";

  let ichiText = "Kararsız 🟡";
  if (price > spanA && price > spanB) ichiText = "Boğa Bölgesi (Bulut Üstü) 🟢";
  else if (price < spanA && price < spanB) ichiText = "Ayı Bölgesi (Bulut Altı) 🔴";

  return `• *${timeframeLabel}:* Fiyat: $${price.toLocaleString("en-US", { minimumFractionDigits: 2 })}, Trend: ${trend}, RSI: ${rsiText}, BB: ${bbText}, MACD: ${macdText}, Heiken Ashi: ${haText}, Ichimoku: ${ichiText}`;
}

export async function GET(request: Request) {
  // Verify authorization header from Vercel Cron or secret query parameter
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get("secret");

  const authHeader = request.headers.get("authorization");
  const isHeaderAuthorized = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isQueryAuthorized = process.env.CRON_SECRET && querySecret === process.env.CRON_SECRET;

  // Bypass authorization check in development mode to ease local testing
  const isDevelopment = process.env.NODE_ENV === "development";

  if (!isDevelopment && process.env.CRON_SECRET && !isHeaderAuthorized && !isQueryAuthorized) {
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

  const timeframeLabels: { [key: string]: string } = {
    "1h": "Saatlik (1sa)",
    "1d": "Günlük (1g)",
    "1w": "Haftalık (1h)",
  };

  const processedSymbols = Array.from(new Set(SYMBOLS));
  let reportMessage = `*🤖 Trade Hub AI Piyasa Yorum Raporu*\n`;
  reportMessage += `📅 Tarih/Saat: ${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}\n\n`;

  const signalsSent: any[] = [];

  for (const symbol of processedSymbols) {
    reportMessage += `*🪙 ${symbol} Analizi*\n`;
    const activeSignals: string[] = [];

    for (const timeframe of TIMEFRAMES) {
      try {
        const limit = timeframe === "1d" ? 1000 : (timeframe === "1w" ? 300 : 500);
        const candles = await fetchCandles(symbol, timeframe, limit);
        if (candles.length === 0) {
          reportMessage += `• *${timeframeLabels[timeframe]}:* Veri alınamadı.\n`;
          continue;
        }

        const backtestResults = runBacktest(candles);
        if (backtestResults.length === 0) {
          reportMessage += `• *${timeframeLabels[timeframe]}:* Yapay zeka modeli eğitilemedi.\n`;
          continue;
        }

        const aiModel = backtestResults[0];
        const currentPrice = candles[candles.length - 1].close;
        const ind = aiModel.indicatorValues;

        // Build commentary text
        const commentary = buildCommentary(timeframeLabels[timeframe], currentPrice, ind);
        reportMessage += `${commentary}\n`;

        // If there's an active BUY or SELL signal, record it
        if (aiModel.currentSignal === "BUY" || aiModel.currentSignal === "SELL") {
          const signalEmoji = aiModel.currentSignal === "BUY" ? "🟢 AL (BUY)" : "🔴 SAT (SELL)";
          let signalDesc = `  - *${timeframeLabels[timeframe]}*: ${signalEmoji} (Başarım: %${aiModel.winRate}, Getiri: %${aiModel.netProfit})`;
          if (aiModel.stopLoss) signalDesc += `\n    - Önerilen Stop Loss: $${aiModel.stopLoss.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
          if (aiModel.takeProfit) signalDesc += `\n    - Önerilen Take Profit: $${aiModel.takeProfit.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
          if (ind.IzSurenStop_ATR) signalDesc += `\n    - İz Süren Stop: ${ind.IzSurenStop_ATR}x ATR`;
          
          activeSignals.push(signalDesc);
          signalsSent.push({ symbol, timeframe, signal: aiModel.currentSignal });
        }
      } catch (err: any) {
        console.error(`Error processing alert for ${symbol} on ${timeframe}:`, err);
        reportMessage += `• *${timeframeLabels[timeframe]}:* Analiz sırasında hata oluştu.\n`;
      }
    }

    reportMessage += `\n🚨 *${symbol} Aktif Sinyaller:*\n`;
    if (activeSignals.length > 0) {
      reportMessage += activeSignals.join("\n") + "\n";
    } else {
      reportMessage += `  - Aktif bir al/sat sinyali bulunmuyor. (Nötr)\n`;
    }
    reportMessage += `\n--------------------------------------------\n\n`;
  }

  // Send the consolidated report message using Telegram Bot API
  try {
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: reportMessage,
        parse_mode: "Markdown",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to send consolidated report to Telegram: ${errorText}`);
      return NextResponse.json({ status: "Failed", error: `Telegram API error: ${errorText}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error("Error sending message to Telegram:", err);
    return NextResponse.json({ status: "Failed", error: err.message }, { status: 500 });
  }

  return NextResponse.json({ status: "Success", signalsSent });
}
