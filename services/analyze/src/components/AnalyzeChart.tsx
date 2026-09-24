export default function AnalyzeChart() {
  const chartData = [
    { hour: '00:00', views: 40 }, { hour: '03:00', views: 15 },
    { hour: '06:00', views: 25 }, { hour: '09:00', views: 75 },
    { hour: '12:00', views: 95 }, { hour: '15:00', views: 80 },
    { hour: '18:00', views: 60 }, { hour: '21:00', views: 50 },
  ];

  return (
    <div className="w-full">
      <div className="flex items-end justify-between h-48 pt-4 px-2 border-b border-slate-100 dark:border-zinc-800 gap-2">
        {chartData.map((item, index) => (
          <div key={index} className="flex-1 flex flex-col items-center group relative h-full justify-end">
            <div className="absolute -top-8 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
              {item.views * 12} Görüntüleme
            </div>
            <div
              style={{ height: `${item.views}%` }}
              className="w-full bg-blue-500/10 hover:bg-blue-500 rounded-t-sm transition-all cursor-pointer border-t-2 border-blue-500"
            ></div>
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center mt-2 px-1 text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
        {chartData.map((item, index) => (
          <span key={index} className="flex-1 text-center">{item.hour}</span>
        ))}
      </div>
    </div>
  );
}