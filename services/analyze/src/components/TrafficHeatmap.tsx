export default function TrafficHeatmap() {
  const days = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cts", "Paz"];
  const hours = [1200, 1100, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100];

  return (
    <div className="bg-white dark:bg-[#1b1c21] border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm transition-colors duration-300">
      <div className="flex justify-between items-center mb-4 border-b border-slate-100 dark:border-zinc-800 pb-3">
        <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Ziyaretçi Yoğunluk Matrisi</h3>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-8 text-center text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
          <div></div>
          {days.map((day, idx) => (
            <div key={idx}>{day}</div>
          ))}
        </div>

        {hours.map((hour, hIdx) => (
          <div key={hIdx} className="grid grid-cols-8 items-center text-center">
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono text-left">{hour}</span>
            {days.map((_, dIdx) => {
              const isActive = dIdx === 2 && hIdx === 4;
              const isSemiActive = (dIdx === 2 && (hIdx === 3 || hIdx === 5)) || (dIdx === 1 && hIdx === 4);

              return (
                <div key={dIdx} className="flex justify-center">
                  <span
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      isActive
                        ? 'bg-blue-600 shadow-sm shadow-blue-500/50 scale-125'
                        : isSemiActive
                        ? 'bg-blue-400 dark:bg-blue-800/60'
                        : 'bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700'
                    }`}
                  ></span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}