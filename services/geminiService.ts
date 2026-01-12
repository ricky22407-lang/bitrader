import { GoogleGenAI } from "@google/genai";
import { Ticker, StrategyType } from "../types";

export interface AIDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
}

export const analyzeMarket = async (
  apiKey: string,
  tickers: Ticker[], 
  strategy: StrategyType,
  currentPosition: 'LONG' | 'SHORT' | 'NONE'
): Promise<AIDecision> => {
  
  if (!apiKey) {
    return { action: 'HOLD', confidence: 0, reasoning: "未設定 Gemini API Key，跳過 AI 分析" };
  }

  const ai = new GoogleGenAI({ apiKey });

  // Format last 10 candles for the prompt
  const recentData = tickers.slice(-10).map(t => 
    `Time: ${new Date(t.time * 1000).toISOString().split('T')[1]}, Close: ${t.close}, Vol: ${t.volume}`
  ).join('\n');

  const systemInstruction = `
    You are an expert AI Crypto Trader. 
    Analyze the provided OHLCV data and current market context.
    
    Context:
    - Strategy: ${strategy}
    - Current Position: ${currentPosition}
    
    Output strictly valid JSON format:
    {
      "action": "BUY" | "SELL" | "HOLD",
      "confidence": number (0-100),
      "reasoning": "Short traditional chinese explanation (max 20 chars)"
    }
  `;

  const prompt = `Analyze these last 10 candles:\n${recentData}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        temperature: 0.2, // Low temp for logic
      }
    });

    const text = response.text || "{}";
    // Basic cleanup in case markdown blocks are returned (though MIME type should prevent this)
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr) as AIDecision;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return { action: 'HOLD', confidence: 0, reasoning: "AI 連線或解析錯誤" };
  }
};