interface DataItem {
  label: string;
  value: number;
  percentage: number;
}

interface DataTableProps {
  title: string;
  data: DataItem[];
  type: 'url' | 'text';
}

export default function DataTable({ title, data, type }: DataTableProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        <span className="text-xs text-gray-400 font-medium">İstek</span>
      </div>

      <div className="space-y-3">
        {data.map((item, index) => (
          <div key={index} className="relative flex justify-between items-center p-2 rounded-lg text-sm group overflow-hidden">
            {/* Umami İlerleme Efekti Çubuğu */}
            <div
              style={{ width: `${item.percentage}%` }}
              className="absolute left-0 top-0 bottom-0 bg-blue-50/60 group-hover:bg-blue-50 transition-colors z-0"
            ></div>

            <span className={`z-10 font-medium truncate pr-4 ${type === 'url' ? 'text-blue-600 font-mono text-xs' : 'text-gray-700'}`}>
              {item.label}
            </span>
            <span className="z-10 font-semibold text-gray-900 bg-white/80 px-2 py-0.5 rounded border border-gray-100 shadow-sm text-xs">
              {item.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}