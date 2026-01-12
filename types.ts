export interface BotConfig {
  binanceApiKey: string;
  binanceSecretKey: string;
  geminiApiKey: string;
  exchanges: string[];
  pairs: string[];
  strategy: StrategyType;
  riskPercentage: number;
  includeLogging: boolean;
  includeWebsockets: boolean;
  enableTelegram: boolean;
  gridLevels: number;
}

export enum StrategyType {
  MOMENTUM = '動能/趨勢跟蹤 (Momentum)',
  MEAN_REVERSION = '均值回歸 (Mean Reversion)',
  AI_PREDICTION = 'AI/ML 預測模型 (AI Prediction)'
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