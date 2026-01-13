import { Ticker, TechnicalIndicators, CandlestickPatterns } from "../types";
import { RSI, MACD, BollingerBands, SMA, EMA, ATR, bullish, bearish, doji, morningstar, eveningstar } from 'technicalindicators';

// Manual implementation for single-candle patterns that might be missing in exports
const isHammer = (open: number, high: number, low: number, close: number): boolean => {
  const body = Math.abs(close - open);
  const lowerWick = Math.min(open, close) - low;
  const upperWick = high - Math.max(open, close);
  // Hammer: Lower wick >= 2 * body, Upper wick <= body (small)
  return lowerWick >= 2 * body && upperWick <= body;
};

const isShootingStar = (open: number, high: number, low: number, close: number): boolean => {
  const body = Math.abs(close - open);
  const lowerWick = Math.min(open, close) - low;
  const upperWick = high - Math.max(open, close);
  // Shooting Star: Upper wick >= 2 * body, Lower wick <= body (small)
  return upperWick >= 2 * body && lowerWick <= body;
};

const detectPatterns = (open: number[], high: number[], low: number[], close: number[]): CandlestickPatterns => {
  // technicalindicators lib expects input as object {open: [], ...}
  const input = { open, high, low, close };
  
  // For manual checks, use the last candle
  const idx = close.length - 1;
  const lastOpen = open[idx];
  const lastHigh = high[idx];
  const lastLow = low[idx];
  const lastClose = close[idx];
  
  // Note: 'technicalindicators' functions might return boolean or have specific behavior.
  // We assume they return boolean here based on common usage.
  
  return {
    bullishEngulfing: bullish(input),
    bearishEngulfing: bearish(input),
    doji: doji(input),
    hammer: isHammer(lastOpen, lastHigh, lastLow, lastClose),
    shootingStar: isShootingStar(lastOpen, lastHigh, lastLow, lastClose),
    morningStar: morningstar(input),
    eveningStar: eveningstar(input)
  };
};

export const calculateIndicators = (tickers: Ticker[]): TechnicalIndicators => {
  const closes = tickers.map(t => t.close);
  const opens = tickers.map(t => t.open);
  const highs = tickers.map(t => t.high);
  const lows = tickers.map(t => t.low);

  // RSI
  const rsiValues = RSI.calculate({
    values: closes,
    period: 14
  });
  const rsi = rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : 50;

  // MACD
  const macdValues = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });
  const macd = macdValues.length > 0 ? macdValues[macdValues.length - 1] : {};

  // Bollinger Bands
  const bbValues = BollingerBands.calculate({
    period: 20,
    values: closes,
    stdDev: 2
  });
  const bollinger = bbValues.length > 0 ? bbValues[bbValues.length - 1] : {};

  // SMA / EMA
  const sma20 = SMA.calculate({ period: 20, values: closes });
  const ema50 = EMA.calculate({ period: 50, values: closes });
  const ema200 = EMA.calculate({ period: 200, values: closes });

  // ATR (Volatility)
  const atrValues = ATR.calculate({
    period: 14,
    high: highs,
    low: lows,
    close: closes
  });
  const atr = atrValues.length > 0 ? atrValues[atrValues.length - 1] : 0;

  // Pattern Recognition
  // We use the last 5 candles for pattern detection to be safe
  const patterns = detectPatterns(
    opens.slice(-5), 
    highs.slice(-5), 
    lows.slice(-5), 
    closes.slice(-5)
  );

  return {
    rsi,
    macd,
    bollinger,
    sma20: sma20.length > 0 ? sma20[sma20.length - 1] : 0,
    ema50: ema50.length > 0 ? ema50[ema50.length - 1] : 0,
    ema200: ema200.length > 0 ? ema200[ema200.length - 1] : 0,
    atr,
    patterns
  };
};