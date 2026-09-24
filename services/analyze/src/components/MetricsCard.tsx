import { ReactNode } from 'react';

interface MetricsCardProps {
  title: string;
  value: string;
  change: string;
  icon: ReactNode;
}

export default function MetricsCard({ title, value, change, icon }: MetricsCardProps) {
  const isPositive = !change.startsWith('-');

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:border-gray-300 transition-all">
      <div className="flex justify-between items-center mb-3 text-gray-400">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</span>
        <div className="p-1.5 bg-gray-50 rounded-lg text-gray-600">{icon}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900 tracking-tight">{value}</span>
        <span className={`text-xs font-semibold ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
          {change}
        </span>
      </div>
    </div>
  );
}