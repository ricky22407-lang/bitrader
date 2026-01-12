export interface BotConfig {
  exchanges: string[];
  pairs: string[];
  strategy: StrategyType;
  riskLevel: RiskLevel;
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

export enum RiskLevel {
  LOW = '低風險 (保守)',
  MEDIUM = '中等風險 (平衡)',
  HIGH = '高風險 (積極)'
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