import { Ticker, Order, Position, AccountState } from "../types";

// Simulation State
let currentPrice = 42000;
let balance = 10000; // USDT
let position: Position = { symbol: 'BTC/USDT', amount: 0, entryPrice: 0, unrealizedPnL: 0, side: 'NONE' };
let orders: Order[] = [];
let tradeHistory: number[] = []; // Store PnL of closed trades

// Generate a random market tick (Simulation)
export const simulateTick = (lastClose: number): Ticker => {
  const volatility = 0.002; // 0.2% volatility per tick
  const change = lastClose * (Math.random() - 0.5) * volatility;
  const newPrice = lastClose + change;
  
  currentPrice = newPrice;
  updatePositionPnL();

  return {
    time: Date.now() / 1000,
    open: lastClose,
    high: Math.max(lastClose, newPrice) + (Math.random() * 10),
    low: Math.min(lastClose, newPrice) - (Math.random() * 10),
    close: newPrice,
    volume: Math.random() * 50
  };
};

// Check limit orders against current price
export const checkOrders = (): Order[] => {
  const filledOrders: Order[] = [];
  orders = orders.filter(order => {
    let filled = false;
    if (order.side === 'BUY' && currentPrice <= order.price) filled = true;
    if (order.side === 'SELL' && currentPrice >= order.price) filled = true;

    if (filled) {
      order.status = 'FILLED';
      executeTrade(order);
      filledOrders.push(order);
      return false; // Remove from open orders
    }
    return true; // Keep in open orders
  });
  return filledOrders;
};

// Internal trade execution logic
const executeTrade = (order: Order) => {
  const cost = order.price * order.amount;
  const fee = cost * 0.001; // 0.1% fee

  if (order.side === 'BUY') {
    if (balance >= cost + fee) {
      balance -= (cost + fee);
      // Update position (Simplified weighted average)
      const totalCost = (position.amount * position.entryPrice) + cost;
      const newAmount = position.amount + order.amount;
      position = {
        symbol: order.symbol,
        amount: newAmount,
        entryPrice: totalCost / newAmount,
        side: 'LONG',
        unrealizedPnL: 0
      };
    }
  } else if (order.side === 'SELL') {
    if (position.amount >= order.amount) {
      balance += (cost - fee);
      // Calculate Realized PnL
      const pnl = (order.price - position.entryPrice) * order.amount - fee;
      tradeHistory.push(pnl);
      
      const newAmount = position.amount - order.amount;
      position.amount = newAmount;
      if (newAmount < 0.0001) {
        position.side = 'NONE';
        position.entryPrice = 0;
      }
    }
  }
};

const updatePositionPnL = () => {
  if (position.side === 'LONG') {
    position.unrealizedPnL = (currentPrice - position.entryPrice) * position.amount;
  }
};

// --- API Methods exposed to Bot ---

export const getAccountState = (): AccountState => {
  const equity = balance + position.unrealizedPnL;
  const wins = tradeHistory.filter(p => p > 0).length;
  const winRate = tradeHistory.length > 0 ? (wins / tradeHistory.length) * 100 : 0;
  const dailyPnL = tradeHistory.reduce((a, b) => a + b, 0) + position.unrealizedPnL;

  return { balance, equity, dailyPnL, winRate };
};

export const getPosition = () => position;
export const getOpenOrders = () => orders;

export const placeOrder = (order: Omit<Order, 'id' | 'status' | 'timestamp'>): Order => {
  const newOrder: Order = {
    ...order,
    id: Math.random().toString(36).substr(2, 9),
    status: 'OPEN',
    timestamp: Date.now()
  };

  if (newOrder.type === 'MARKET') {
    newOrder.price = currentPrice; // Execute immediately at current price
    newOrder.status = 'FILLED';
    executeTrade(newOrder);
  } else {
    orders.push(newOrder);
  }
  
  return newOrder;
};

export const cancelOrder = (id: string) => {
  orders = orders.filter(o => o.id !== id);
};
