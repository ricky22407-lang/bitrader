import { GoogleGenAI } from "@google/genai";
import { BotConfig, GeneratedContent } from "../types";

const SYSTEM_INSTRUCTION = `
You are an expert Python Quantitative Developer specializing in Binance trading bots.
Your goal is to generate a PRODUCTION-READY, SINGLE-FILE Python script.
The code must be robust, modular, and extensively commented in TRADITIONAL CHINESE (繁體中文).
The architecture must use 'backtrader' for the engine (supporting both backtest and live modes via logic separation) and 'ccxt' for data fetching concepts.
`;

export const generateBotStructure = async (config: BotConfig): Promise<GeneratedContent> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Task: Write a complete, advanced Python Crypto Trading Bot script.
    
    Configuration:
    - Strategy: ${config.strategy}
    - Pairs: ${config.pairs.join(", ")}
    - Grid Levels: ${config.gridLevels}
    - Risk Per Trade: ${config.riskPercentage}%
    - Features: ${config.includeWebsockets ? "WebSocket" : "REST"}, ${config.enableTelegram ? "Telegram Notification" : "Console Log Only"}

    **CRITICAL: API KEY INJECTION**
    The user has provided specific API keys to be used in this script. 
    You MUST inject them directly into the 'Config' class variables as string literals.
    - Binance API Key: "${config.binanceApiKey || ''}"
    - Binance Secret: "${config.binanceSecretKey || ''}"
    - Gemini API Key: "${config.geminiApiKey || ''}"
    
    If the key is empty string, fall back to 'os.getenv(...)'.

    Requirements for the Python Code:
    1.  **Centralized Config Class**: 
        -   Define \`BINANCE_API_KEY\`, \`BINANCE_SECRET\`, and \`GEMINI_API_KEY\`.
        -   If the injected value is present, use it directly (e.g. \`BINANCE_API_KEY = "actual_key_here"\`).
        -   Otherwise use \`os.getenv\`.
        -   Define \`RISK_PER_TRADE = ${config.riskPercentage / 100}\`.
        -   Define \`GRID_LEVELS = ${config.gridLevels}\`.
    2.  **Notifier Class**: A unified class that logs to Console (logging library) AND sends Telegram messages (using \`requests\` to call Telegram API) if enabled.
    3.  **LLM Decision Engine Class**: A class structure to interact with Google Gemini API.
        -   Use the injected \`GEMINI_API_KEY\`.
        -   Include a method \`analyze_market(symbol, data)\`.
        -   Include a \`_mock_response()\` fallback method so the script runs even without an API key (returning random Bullish/Bearish signals for testing).
    4.  **Risk Manager Class**:
        -   Implement \`check_emergency_halt(current_equity)\` to stop trading if drawdown > 10%.
        -   Implement \`calculate_position_size\` based on risk percentage.
    5.  **Strategy Class (Backtrader)**:
        -   Implement \`next()\` logic.
        -   Integrate the **Grid Trading** logic (buy low, sell high within bands).
        -   Integrate **Trailing Stop-Loss**.
        -   Integrate **Auto-Compounding** (reinvest profits).
        -   Call the AI Engine for entry confirmation.
    6.  **Main Execution**:
        -   Graceful Shutdown (catch \`SIGINT\`).
        -   Setup Backtrader Cerebro.
        -   Generate mock data for the backtest so the user can run the script immediately.

    STRICT LOCALIZATION:
    -   ALL comments, log messages, and print outputs MUST be in Traditional Chinese (繁體中文).
    -   Example Log: "logging.info('✅ 訂單已成交: 買入 BTC/USDT')"

    Output Format:
    -   Wrap code in ---PYTHON_START--- and ---PYTHON_END--- markers.
    -   Provide a short Traditional Chinese summary wrapped in ---SUMMARY_START--- and ---SUMMARY_END---.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.25, 
      }
    });

    const text = response.text || "";
    
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