import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartDataPoint } from '../types';

const generateMockData = (): ChartDataPoint[] => {
  const data: ChartDataPoint[] = [];
  let value = 10000;
  let btc = 10000;
  for (let i = 0; i < 24; i++) {
    const change = (Math.random() - 0.45) * 200; // Slight upward bias
    value += change;
    btc += (Math.random() - 0.5) * 300;
    data.push({
      time: `${i}:00`,
      value: Math.round(value),
      btc: Math.round(btc),
    });
  }
  return data;
};

const data = generateMockData();

const SimulatedChart: React.FC = () => {
  return (
    <div className="h-full flex flex-col">
       <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-300">市場模擬回測 (BTC/USDT)</h3>
          <span className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/20">+2.4% (24H)</span>
       </div>
      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
              itemStyle={{ color: '#3b82f6' }}
            />
            <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SimulatedChart;