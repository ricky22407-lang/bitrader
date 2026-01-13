
export interface BotConfig {
  symbol: string;
  initialBudget: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  minPulse: number; 
  maxPulse: number; 
  autoStart: boolean;
  tradingMode: 'SIMULATION' | 'REAL_MONEY'; 
}

export interface Ticker {
  symbol: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketSnapshot {
  symbol: string;
  price: number;
  rsi: number;
  atr: number;
  volume24h?: number;
  change24h?: number;
  score?: number;
}

export interface OrderBookStats {
  bidAskRatio: number; 
  imbalancePct: number; 
  dominantSide: 'BULLS' | 'BEARS' | 'NEUTRAL';
  wallPrice?: number; 
}

export interface MarketContext {
  tf1m: Ticker[];
  tf15m: Ticker[];
  tf1h: Ticker[];
  orderBook: OrderBookStats; 
}

export interface CandlestickPatterns {
  bullishEngulfing: boolean;
  bearishEngulfing: boolean;
  doji: boolean;
  hammer: boolean;
  shootingStar: boolean;
  morningStar: boolean;
  eveningStar: boolean;
}

export interface TechnicalIndicators {
  rsi: number;
  macd: {
    MACD?: number;
    signal?: number;
    histogram?: number;
  };
  bollinger: {
    upper?: number;
    middle?: number;
    lower?: number;
  };
  sma20: number;
  ema50: number;
  ema200: number; 
  atr: number;    
  patterns: CandlestickPatterns; 
}

export interface Trade {
  id: string;
  symbol: string;
  marketType: 'SPOT' | 'FUTURES'; // NEW
  side: 'BUY' | 'SELL'; // Futures: BUY=Long, SELL=Short
  price: number;
  amount: number; // Size in Coin
  cost: number; // USDT value (Margin for futures)
  leverage: number; // 1 for Spot
  timestamp: number;
  pnl?: number; 
  reason: string;
  strategyUsed: string;
}

export interface Position {
  id: string; // Unique ID for tracking
  symbol: string;
  marketType: 'SPOT' | 'FUTURES';
  side: 'LONG' | 'SHORT';
  amount: number; // Size in Coins
  entryPrice: number;
  currentPrice: number;
  leverage: number; // 1 for Spot
  liquidationPrice?: number; // Only for Futures
  marginUsed?: number; // Only for Futures
  unrealizedPnL: number;
  pnlPercentage: number;
  stopLoss?: number;
  takeProfit?: number;
  trailingStopTrigger?: number; 
  highestPriceSinceEntry?: number; 
  trailingStopPct?: number; 
}

export interface EquitySnapshot {
  time: number; 
  equity: number; 
  balance: number; 
}

export interface Portfolio {
  id?: number; 
  balance: number; // Available USDT (Cash)
  equity: number;  // Cash + Unrealized PnL
  spotPositions: Position[]; // NEW: Distinct Spot bucket
  futuresPositions: Position[]; // NEW: Distinct Futures bucket
  tradeHistory: Trade[];
  equityHistory: EquitySnapshot[]; 
  lastUpdated: number;
  circuitBreakerTriggered?: number; 
}

export interface DebateTurn {
  speaker: 'Gemini (Analyst)' | 'Grok (Risk)' | 'Chairman' | 'News Scraper';
  message: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface AnalysisReport {
  id: string;
  timestamp: number;
  type: 'POST_MORTEM' | 'STRATEGY_CHANGE';
  title: string;
  content: string;
  lessonsLearned?: string[];
}

export interface AIDecision {
  action: 'BUY' | 'SELL' | 'HOLD' | 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT';
  marketType: 'SPOT' | 'FUTURES';
  leverage: number;
  confidence: number; 
  reasoning: string;
  currentStrategy: string;
  suggestedAmountPct?: number;
  debateLogs: DebateTurn[];
  stopLossPrice?: number;
  takeProfitPrice?: number;
  report?: AnalysisReport;
  trailingStopPct?: number; 
}

export interface MarketScanResult {
  needsEscalation: boolean;
  selectedSymbol: string; 
  recommendedPath: 'SPOT' | 'FUTURES'; // NEW
  shortSummary: string;
  marketCondition: 'BORING' | 'VOLATILE' | 'OPPORTUNITY' | 'DANGER';
}

export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'INFO' | 'TRADE' | 'AI' | 'ERROR' | 'COUNCIL' | 'NEWS' | 'SCOUT'; 
  message: string;
  metadata?: any;
}

export interface UserSettings {
  binanceApiKey?: string;
  binanceSecretKey?: string;
  telegramBotToken?: string; // NEW
  telegramChatId?: string;   // NEW
}
