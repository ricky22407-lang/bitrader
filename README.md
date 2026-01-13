# AI Crypto Bot Forge

AI Crypto Bot Forge is a React-based web application that allows users to configure, simulate, and generate Python-based algorithmic trading bots for Binance. It leverages the Google Gemini API for market analysis simulation and code generation.

## Features

- **Bot Configuration**: Customize pairs, strategies, risk settings, and more.
- **Market Simulation**: Visualize real-time price ticks and AI-driven trade signals.
- **Code Generation**: instantly generate a production-ready Python trading bot (`bot.py`) based on your configuration.
- **Security**: No API keys are stored or processed on the client for the generated bot. Keys for the web simulation are handled via environment variables.

## Deployment on Vercel

This project is optimized for deployment on [Vercel](https://vercel.com).

### Prerequisites

1.  A Vercel account.
2.  A Google Gemini API Key. Get one at [Google AI Studio](https://aistudio.google.com/).

### Steps

1.  **Push to GitHub**: Push this repository to your GitHub account.
2.  **Import to Vercel**:
    *   Go to your Vercel Dashboard.
    *   Click **"Add New..."** -> **"Project"**.
    *   Import your GitHub repository.
3.  **Configure Environment Variables**:
    *   In the "Environment Variables" section of the Vercel project settings:
    *   Add `VITE_GEMINI_API_KEY` and set it to your Gemini API Key.
4.  **Deploy**: Click **"Deploy"**.

### Local Development

1.  Clone the repo.
2.  Copy `.env.example` to `.env`:
    ```bash
    cp .env.example .env
    ```
3.  Edit `.env` and add your `VITE_GEMINI_API_KEY`.
4.  Install dependencies:
    ```bash
    npm install
    ```
5.  Start the development server:
    ```bash
    npm run dev
    ```

## Usage

1.  Open the web app.
2.  Adjust the bot settings in the left panel.
3.  Watch the simulation in the center dashboard.
4.  Click **"生成 Python 機器人代碼"**.
5.  Download the code, configure your `config.json` locally with your Binance keys, and run it!