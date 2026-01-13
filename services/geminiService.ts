
import { GoogleGenAI } from "@google/genai";
import { Ticker, AIDecision, Portfolio, TechnicalIndicators, AnalysisReport, MarketScanResult, MarketContext, MarketSnapshot } from "../types";
import { askGrok } from "./grokService";

const cleanAndParseJSON = (text: string): any => {
  try {
    let clean = text.replace(/```json/g, '').replace(/```/g, '');
    const firstOpen = clean.indexOf('{');
    const lastClose = clean.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1) {
        clean = clean.substring(firstOpen, lastClose + 1);
    }
    return JSON.parse(clean);
  } catch (e) {
    console.error("JSON Parse Failed on:", text);
    throw new Error("AI returned malformed JSON");
  }
};

const formatPatterns = (p: TechnicalIndicators['patterns']) => {
  const detected = Object.entries(p).filter(([key, val]) => val).map(([key]) => key);
  return detected.length > 0 ? detected.join(", ").toUpperCase() : "NONE";
};

// --- TIER 1: GLOBAL SCOUT ---
export const evaluateGlobalMarkets = async (
  candidates: MarketSnapshot[],
  portfolio: Portfolio,
  currentSymbol: string
): Promise<MarketScanResult> => {

  if (!process.env.API_KEY) return { needsEscalation: false, selectedSymbol: currentSymbol, recommendedPath: 'SPOT', shortSummary: "No API Key", marketCondition: 'BORING' };

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const validCandidates = candidates.filter(c => c.price > 0);

  // Determine active holding status text
  const holdingSpot = portfolio.spotPositions.length > 0;
  const holdingFut = portfolio.futuresPositions.length > 0;
  const status = `SPOT: ${holdingSpot ? portfolio.spotPositions[0].symbol : 'NONE'}, FUTURES: ${holdingFut ? portfolio.futuresPositions[0].symbol : 'NONE'}`;

  const prompt = `
    Role: Elite Crypto Scout.
    Task: Scan ${validCandidates.length} assets. Pick ONE best opportunity.
    Current Status: ${status}

    Data: ${JSON.stringify(validCandidates)}

    Rules:
    1. Opportunity Types:
       - 'SPOT': Strong Uptrend, breakout, accumulation.
       - 'FUTURES': High Volatility, Short Squeeze potential, or Bearish Reversal (Shorting).
    2. If we hold an asset, bias towards managing it, UNLESS another asset has a massive signal (switch).
    3. If Volatility is Low, set marketCondition = BORING.

    Output JSON:
    {
      "selectedSymbol": "BTCUSDT",
      "recommendedPath": "SPOT" | "FUTURES",
      "needsEscalation": boolean, 
      "marketCondition": "BORING" | "VOLATILE" | "OPPORTUNITY" | "DANGER",
      "shortSummary": "e.g. BTC breakout imminent, switch to Futures for leverage"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp', 
      contents: prompt,
      config: { responseMimeType: "application/json", temperature: 0.2 }
    });
    const res = cleanAndParseJSON(response.text || "{}");
    return { ...res, recommendedPath: res.recommendedPath || 'SPOT' };
  } catch (error) {
    return { needsEscalation: false, selectedSymbol: currentSymbol, recommendedPath: 'SPOT', shortSummary: "Scan Error", marketCondition: 'BORING' };
  }
};

// --- TIER 2: THE COUNCIL ---
export const conveneCouncil = async (
  tickers: Ticker[], 
  portfolio: Portfolio,
  indicators: TechnicalIndicators,
  config: { risk: 'LOW' | 'MEDIUM' | 'HIGH' },
  context: MarketContext, 
  recentHistory: { type: 'WIN' | 'LOSS', pnl: number, reason: string }[]
): Promise<AIDecision> => {
  
  const grokKey = process.env.VITE_GROK_API_KEY;
  if (!process.env.API_KEY) return { action: 'HOLD', marketType: 'SPOT', leverage: 1, confidence: 0, currentStrategy: "No Key", reasoning: "Error", debateLogs: [] };

  const currentPrice = tickers[tickers.length - 1].close;
  const currentSymbol = tickers[0].symbol;

  // --- ANALYSIS ---
  const marketSummary = {
    symbol: currentSymbol,
    price: currentPrice.toFixed(4),
    rsi: indicators.rsi.toFixed(2),
    atr: indicators.atr.toFixed(4),
    trend: currentPrice > indicators.ema50 ? "UP" : "DOWN",
    patterns: formatPatterns(indicators.patterns),
    liquidity: context.orderBook
  };

  let grokOpinion = "";
  if (grokKey) {
    grokOpinion = await askGrok("Risk Manager", `Asset: ${currentSymbol}. Price ${marketSummary.price}. Trend ${marketSummary.trend}. Assess Short/Long Risk.`, grokKey) || "Grok Silent.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Role: Chairman of Dual-Track Crypto Council (Spot & Futures).
    Asset: ${currentSymbol} | Risk Profile: ${config.risk}
    
    [Techs] Price:${marketSummary.price}, RSI:${marketSummary.rsi}, ATR:${marketSummary.atr}, Pat:${marketSummary.patterns}
    [Liquidity] ${marketSummary.liquidity.dominantSide}
    [Risk Officer] "${grokOpinion}"
    
    [Portfolio Status]
    Cash: ${portfolio.balance.toFixed(2)}
    Spot Holdings: ${portfolio.spotPositions.map(p => p.symbol).join(', ') || 'None'}
    Futures Holdings: ${portfolio.futuresPositions.map(p => `${p.symbol} (${p.side} ${p.leverage}x)`).join(', ') || 'None'}

    [Dual-Track Strategy Rules]
    1. **SPOT Path**: Use for Accumulation, Strong Uptrends, Safety. No Leverage.
       - Action: BUY / SELL / HOLD
    2. **FUTURES Path**: Use for Shorting (Bear market), Hedging, or High Confidence Breakouts.
       - Action: OPEN_LONG / OPEN_SHORT / CLOSE_LONG / CLOSE_SHORT / HOLD
       - Leverage: Max 2x for Mains (BTC/ETH), 1x for Alts. Cap at 3x.
    
    DECIDE:
    - If Bearish: Consider Spot SELL or Futures OPEN_SHORT.
    - If Bullish: Consider Spot BUY or Futures OPEN_LONG.
    - If Holding Spot & Bearish detected: Can SELL Spot OR Open Futures Short (Hedge).

    Output JSON:
    {
      "action": "BUY" | "SELL" | "OPEN_LONG" | "OPEN_SHORT" | "CLOSE_LONG" | "CLOSE_SHORT" | "HOLD",
      "marketType": "SPOT" | "FUTURES",
      "leverage": number, // 1 for Spot, 1-3 for Futures
      "confidence": number, // 0-100
      "reasoning": "...",
      "suggestedAmountPct": number, // 0.1 - 1.0
      "stopLoss": number,
      "takeProfit": number,
      "trailingStopPct": number
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp', 
      contents: prompt,
      config: { tools: [{ googleSearch: {} }], responseMimeType: "application/json", temperature: 0.5 }
    });

    const result = cleanAndParseJSON(response.text || "{}");
    
    // Safety Overrides
    if (result.marketType === 'SPOT') result.leverage = 1;
    if (result.leverage > 3) result.leverage = 3; 

    // Confidence Gate
    const threshold = config.risk === 'LOW' ? 85 : 70;
    if (result.confidence < threshold && result.action !== 'HOLD') {
        // If closing, allow lower confidence (fear is good). If opening, strict.
        if (!result.action.includes('CLOSE') && result.action !== 'SELL') {
             result.action = 'HOLD';
             result.reasoning += " [Confidence Low]";
        }
    }

    const debateLogs: any[] = [
        { speaker: 'Grok (Risk)', message: grokOpinion, sentiment: 'NEUTRAL' },
        { speaker: 'Chairman', message: `Proposed: ${result.action} on ${result.marketType} (${result.leverage}x)`, sentiment: 'NEUTRAL' }
    ];

    return {
      action: result.action,
      marketType: result.marketType || 'SPOT',
      leverage: result.leverage || 1,
      confidence: result.confidence,
      reasoning: result.reasoning,
      currentStrategy: "Dual-Track Adaptive",
      suggestedAmountPct: result.suggestedAmountPct || 0.5,
      debateLogs,
      stopLossPrice: result.stopLoss,
      takeProfitPrice: result.takeProfit,
      trailingStopPct: result.trailingStopPct
    };

  } catch (error) {
    console.error("Council Error:", error);
    return { action: 'HOLD', marketType: 'SPOT', leverage: 1, confidence: 0, currentStrategy: "Error", reasoning: "Fail", debateLogs: [] };
  }
};
