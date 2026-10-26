export function App() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <header className="max-w-xl space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-xs dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
          純前端 · 零後端 · BYOK 自備金鑰
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
          MapCraft <span className="text-emerald-600 dark:text-emerald-400">地圖工坊</span>
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          AI drafts the map. You craft the learning.（AI 起稿，你來完成。）
        </p>
      </header>
    </div>
  );
}

export default App;
