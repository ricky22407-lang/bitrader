# AI Trader

AI Trader is a React-based autonomous trading agent powered by Google Gemini 2.0 Flash. It runs entirely in your browser, simulating a professional trading desk environment where AI agents (Scout, Analyst, Risk Officer) collaborate to make trading decisions.

## Features

- **Live Market Monitor**: Real-time candlestick charts powered by Binance WebSocket.
- **AI Council Strategy**: A multi-agent system where Gemini acts as both Analyst and Chairman, with optional Grok integration for Risk Assessment.
- **Autonomous Execution**:
    - **Scout (Flash)**: Continuously scans for volatility and patterns (low cost).
    - **Council (Flash/Pro)**: Convenes only when the Scout detects opportunities (high intelligence).
- **Risk Management**: Auto-calculated Stop Loss, Take Profit, and Dynamic Trailing Stops based on ATR (Volatility).
- **Simulation & Real Money**: Start in simulation mode to test strategies, then switch to Real Money (requires Binance API keys).
- **Persistent State**: Keeps track of your portfolio and trade history using IndexedDB.

## Deployment

This project is optimized for [Vercel](https://vercel.com). Since it runs in the browser, you just need to keep the tab open for the bot to trade.

### Prerequisites

1.  A Google Gemini API Key. Get one at [Google AI Studio](https://aistudio.google.com/).
2.  (Optional) Binance API Keys for Real Money trading.

### Setup

1.  Clone the repo.
2.  Copy `.env.example` to `.env` and add your keys:
    ```bash
    VITE_GEMINI_API_KEY=your_gemini_key
    # Optional for Real Trading
    VITE_BINANCE_API_KEY=your_binance_key
    VITE_BINANCE_SECRET_KEY=your_binance_secret
    ```
3.  Install dependencies:
    ```bash
    npm install
    ```
4.  Start:
    ```bash
    npm run dev
    ```

## How it Works

1.  **The Loop**: The app connects to Binance WS to get live prices.
2.  **The Scout**: Every few seconds (configurable), Gemini Flash scans the technical indicators (RSI, MACD, Patterns).
3.  **The Council**: If the Scout finds an opportunity, the full AI Council is summoned to analyze higher timeframes (15m, 1h) and debate the best course of action.
4.  **Execution**: Trades are executed directly via Binance API (if configured) or simulated in the browser.

*Note: For 24/7 operation, ensure your computer does not sleep and the browser tab remains active.*