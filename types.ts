export interface BotConfig {
  symbol: string;
  pairs: string[];
  timeframe: string;
  riskPercentage: number;
  gridLevels: number;
  strategy: StrategyType;
  isTestnet: boolean;
  enableTelegram: boolean;
  includeLogging: boolean;
  includeWebsockets: boolean;
}

export const StrategyType = {
  MOMENTUM: '動能趨勢 (Momentum)',
  MEAN_REVERSION: '均值回歸 (Mean Reversion)',
  AI_SCALPING: 'AI 極速剝頭皮 (AI Scalping)'
} as const;

export type StrategyType = typeof StrategyType[keyof typeof StrategyType];

export interface Ticker {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Position {
  symbol: string;
  amount: number;
  entryPrice: number;
  unrealizedPnL: number;
  side: 'LONG' | 'SHORT' | 'NONE';
}

export interface Order {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  price: number;
  amount: number;
  status: 'OPEN' | 'FILLED' | 'CANCELED';
  timestamp: number;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'TRADE' | 'AI';
  message: string;
  details?: string;
}

export interface AccountState {
  balance: number;
  equity: number;
  dailyPnL: number;
  winRate: number;
}

export interface GeneratedContent {
  code: string;
  summary: string;
}

export interface ChartDataPoint {
  time: string;
  value: number;
  btc: number;
}