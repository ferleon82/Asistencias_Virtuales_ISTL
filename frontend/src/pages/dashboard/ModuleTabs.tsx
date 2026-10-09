export interface ModuleTab {
  key: string;
  label: string;
}

interface ModuleTabsProps {
  moduleTabs: ModuleTab[];
  activeModuleTab: string;
  setActiveModuleTab: (key: string) => void;
}

export function ModuleTabs({ moduleTabs, activeModuleTab, setActiveModuleTab }: ModuleTabsProps) {
  return (
    <nav className="mb-6 rounded-lg border border-slate-200 bg-white p-2 shadow-sm" aria-label="Módulos del sistema">
      <div className="flex gap-2 overflow-x-auto">
        {moduleTabs.map((tab) => {
          const isActive = activeModuleTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveModuleTab(tab.key)}
              className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-brand-navy text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-brand-navy'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
