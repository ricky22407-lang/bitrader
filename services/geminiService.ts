import { GoogleGenAI } from "@google/genai";
import { Ticker, StrategyType } from "../types";

export interface AIDecision {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
}

// Mock AI for Preview Mode
const mockAnalyzeMarket = (strategy: StrategyType): AIDecision => {
  const actions: ('BUY' | 'SELL' | 'HOLD')[] = ['BUY', 'SELL', 'HOLD'];
  // Bias slightly towards HOLD to simulate realistic market
  const rand = Math.random();
  const action = rand > 0.7 ? 'BUY' : rand > 0.4 ? 'SELL' : 'HOLD';
  
  return {
    action,
    confidence: Math.floor(Math.random() * 30) + 60, // 60-90% confidence
    reasoning: `[預覽模式] 模擬 ${strategy} 策略訊號生成 (無 API Key)`
  };
};

export const analyzeMarket = async (
  tickers: Ticker[], 
  strategy: StrategyType,
  currentPosition: 'LONG' | 'SHORT' | 'NONE'
): Promise<AIDecision> => {
  
  // Safely access env var
  const apiKey = import.meta.env?.VITE_GEMINI_API_KEY;

  // Use Mock Mode if no key is present (Preview Mode)
  if (!apiKey) {
    console.warn("VITE_GEMINI_API_KEY not found. Using Mock AI for preview.");
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));
    return mockAnalyzeMarket(strategy);
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
      model: 'gemini-2.0-flash',
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
    // Fallback to mock if API fails in preview, or return error
    return { action: 'HOLD', confidence: 0, reasoning: "AI 連線或解析錯誤" };
  }
};