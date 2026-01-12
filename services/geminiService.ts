import { GoogleGenAI } from "@google/genai";
import { BotConfig, GeneratedContent } from "../types";

const SYSTEM_INSTRUCTION = `
You are an expert Python developer for the Taiwan/Hong Kong market, specializing in Binance trading bots.
Your role is to generate production-ready Python code where:
1.  **Code Logic**: Uses standard English for variable names, functions, classes, and libraries (ccxt, pandas).
2.  **Human Text**: ALL comments, docstrings, print statements, logging messages, and error descriptions MUST be in **Traditional Chinese (繁體中文)**.
3.  **Tone**: Professional, clear, and technical.
`;

export const generateBotStructure = async (config: BotConfig): Promise<GeneratedContent> => {
  // Directly use process.env.API_KEY as per coding guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Task: Create a complete, executable Python script for a Binance Crypto Trading Bot.

    Context:
    - 策略 (Strategy): ${config.strategy}
    - 風險 (Risk): ${config.riskLevel}
    - 交易對 (Pairs): ${config.pairs.join(", ")}
    - 功能 (Features): ${config.includeWebsockets ? "WebSocket 即時數據流" : "REST API 輪詢"}, ${config.includeLogging ? "詳細日誌記錄 (Logging)" : "基本 Print 輸出"}.

    STRICT LOCALIZATION REQUIREMENTS (繁體中文):
    1.  **Runtime Output**: 
        -   EVERY \`print()\`, \`logging.info()\`, \`logging.error()\`, and \`Exception\` message must be in Traditional Chinese.
        -   Example: \`logging.info("成功連線至幣安交易所 (Binance)")\`
        -   Example: \`raise ValueError("錯誤: 無法讀取 .env 設定檔")\`
        -   DO NOT print English sentences like "Order placed". Use "訂單已發送".

    2.  **Documentation**:
        -   Class and function docstrings (""") must be in Traditional Chinese.
        -   Inline comments (#) must be in Traditional Chinese.

    3.  **Code Standards**:
        -   Keep class names (BinanceTrader), function names (fetch_balance), and variables (price, symbol) in **English**.
        -   Use 'ccxt' or 'python-binance'.
        -   Include secure API key handling via 'os.getenv' and 'dotenv'.

    Output Format:
    -   Return structured XML-like markers.
    -   ---PYTHON_START--- (The Python Code) ---PYTHON_END---
    -   ---SUMMARY_START--- (A brief 繁體中文階段報告 phase report) ---SUMMARY_END---

    Start generating now.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2, 
      }
    });

    const text = response.text || "";
    
    // Parse the custom markers
    const codeMatch = text.match(/---PYTHON_START---([\s\S]*?)---PYTHON_END---/);
    const summaryMatch = text.match(/---SUMMARY_START---([\s\S]*?)---SUMMARY_END---/);

    const code = codeMatch ? codeMatch[1].trim() : text; 
    const summary = summaryMatch ? summaryMatch[1].trim() : "無法產生摘要。";

    return { code, summary };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};