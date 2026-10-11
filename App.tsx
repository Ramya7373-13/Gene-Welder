import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/Tabs';
import ToastNotification, { ToastType } from './components/ToastNotification';
// Type-only import: ExportConfig is an interface, so it is erased at build time.
// Keeping it separate lets AnalyticsDashboard itself be lazy-loaded below.
import type { ExportConfig } from './components/Analytics/AnalyticsDashboard';
import { DISEASE_VARIANTS } from './constants';
import { VariantInfo } from './types';
import { historyService, HistoryRecord } from './services/historyService';
import { configService } from './services/configService';
import logger from './utils/logger';
import { BarChart3, Clock, BookOpen, Zap, Microscope, Dna, BarChart2, Archive, FlaskConical } from 'lucide-react';

// Code splitting: TabsContent renders `null` when its tab is inactive, so these
// lazy() chunks are only fetched the first time a user actually opens the tab.
// Before this, every panel shipped in one ~1,024 kB bundle.
const VariantExplainerTab = lazy(() => import('./components/VariantExplainerTab'));
const CompensatoryDesignTab = lazy(() => import('./components/CompensatoryDesignTab'));
const DiseaseTracerTab = lazy(() => import('./components/DiseaseTracerTab'));
const SplicingDecoderTab = lazy(() => import('./components/SplicingDecoder/SplicingDecoderTab'));
const DnaArchiveLabTab = lazy(() => import('./components/DnaArchiveLab/DnaArchiveLabTab'));
const DesignStudioTab = lazy(() => import('./components/DesignStudio/DesignStudioTab'));
const AnalyticsDashboard = lazy(() => import('./components/Analytics/AnalyticsDashboard'));
const HistoryTable = lazy(() => import('./components/Analytics/HistoryTable'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const ShortcutsModal = lazy(() => import('./components/ShortcutsModal'));
const LandingPage = lazy(() => import('./components/LandingPage'));

// Shown while a lazy panel chunk is in flight.
const PanelFallback = () => (
  <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
    <span className="sr-only">Loading panel…</span>
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400" />
  </div>
);

// Theme Definitions
export const THEMES = [
  { id: 'purple', name: 'Lavender Mist', primary: '#C5B4E9', hover: '#B598D9' },
  { id: 'blue', name: 'Sky Blue', primary: '#81D4FA', hover: '#6EC6EA' },
  { id: 'green', name: 'Mint Green', primary: '#80DEEA', hover: '#6ED0D0' },
  { id: 'red', name: 'Soft Red', primary: '#F8BBD0', hover: '#F48FB1' },
  { id: 'orange', name: 'Peach', primary: '#FFCCBC', hover: '#FFAB91' },
  { id: 'cyan', name: 'Ice Blue', primary: '#B2EBF2', hover: '#99D9EA' },
  { id: 'pink', name: 'Rose Quartz', primary: '#F8BBD0', hover: '#F48FB1' },
  { id: 'violet', name: 'Periwinkle', primary: '#D1C4E9', hover: '#B39DDB' },
  { id: 'yellow', name: 'Cream', primary: '#FFF9C4', hover: '#FFF176' },
  { id: 'slate', name: 'Gray Blue', primary: '#B0BEC5', hover: '#90A4AE' },
];

const validTabs = ['explainer', 'design', 'tracer', 'splicing', 'archive', 'studio', 'analytics'];

function getInitialTab() {
  const tab = new URLSearchParams(window.location.search).get('tab');
  return tab && validTabs.includes(tab) ? tab : 'explainer';
}

function WorkspaceApp() {
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [activeSource, setActiveSource] = useState<'API' | 'CACHE' | 'SIMULATION' | null>(null);
  const [variants, setVariants] = useState<VariantInfo[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('purple');

  const [explainerVariant, setExplainerVariant] = useState<string | null>(null);

  // Analytics State
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const records = await historyService.getAllRecords();
      setHistory(records);
    } catch (e) {
      logger.error("Failed to fetch history", e);
    }
  }, []);

  useEffect(() => {
    setVariants(DISEASE_VARIANTS);
    fetchHistory();

    const savedTheme = localStorage.getItem('mutationMechanic_theme');
    if (savedTheme) applyTheme(savedTheme);
  }, [fetchHistory]);

  const applyTheme = (themeId: string) => {
    const theme = THEMES.find(t => t.id === themeId);
    if (theme) {
      document.documentElement.style.setProperty('--color-primary', theme.primary);
      document.documentElement.style.setProperty('--color-primary-hover', theme.hover);
      setCurrentTheme(themeId);
      localStorage.setItem('mutationMechanic_theme', themeId);
    }
  };

  const handleTabChange = (tab: string) => {
    logger.info(`Switched to tab: ${tab}`);
    setActiveTab(tab);
    if (tab === 'analytics') fetchHistory();
  };

  const handleClearHistory = async () => {
    if (true) {
      await historyService.clearHistory();
      fetchHistory();
      setToast({ message: "History cleared successfully", type: 'success' });
    }
  };

  const handleDeleteRecord = async (id: string) => {
    await historyService.deleteRecord(id);
    fetchHistory();
    setToast({ message: "Record deleted", type: 'success' });
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (window.confirm(`Delete ${ids.length} selected records?`)) {
      await Promise.all(ids.map(id => historyService.deleteRecord(id)));
      fetchHistory();
      setToast({ message: `${ids.length} records deleted`, type: 'success' });
    }
  };

  const handleBulkArchive = async (ids: string[], archive: boolean) => {
    await Promise.all(ids.map(id => historyService.updateRecord(id, { archived: archive })));
    fetchHistory();
    setToast({ message: `${ids.length} records ${archive ? 'archived' : 'unarchived'}`, type: 'success' });
  };

  const handleExport = (config: ExportConfig, ids?: string[]) => {
    const recordsToExport = ids ? history.filter(r => ids.includes(r.id)) : history;

    let content = '';
    if (config.format === 'JSON') {
      content = JSON.stringify(recordsToExport, null, 2);
    } else if (config.format === 'CSV' || config.format === 'Excel') {
      const headers = ['ID', 'Gene', 'Variant', 'Date', 'Risk', 'Score', 'Confidence', 'Type', 'Archived'];
      const rows = recordsToExport.map(r => [
        r.id, r.gene, r.variant, new Date(r.timestamp).toISOString(),
        r.riskLevel, r.pathogenicityScore, r.confidence, r.type, r.archived ? 'YES' : 'NO'
      ]);
      content = [headers, ...rows].map(row => row.join(',')).join('\n');
    } else if (config.format === 'PDF') {
      // PDF Simulation
      content = `PROTEIN ENGINEERING REPORT: ${config.filename}\nGenerated: ${new Date().toLocaleString()}\n\nSummary:\nTotal Analyzed: ${recordsToExport.length}\n\n` +
        recordsToExport.map(r => `[${r.gene}] ${r.variant} - Risk: ${r.riskLevel} (${r.confidence}% Confidence)`).join('\n');
    }

    const mimeType = config.format === 'JSON' ? 'application/json' :
      config.format === 'PDF' ? 'application/pdf' : 'text/csv';

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.filename}.${config.format.toLowerCase()}`;
    a.click();
    setToast({ message: `${config.format} Report generated`, type: 'success' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col font-sans transition-colors duration-500">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} source={activeSource} />

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<PanelFallback />}>
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-8">
          <div className="flex justify-center">
            <TabsList
              aria-label="Main navigation"
              className="grid w-full md:w-[90%] grid-cols-3 lg:grid-cols-7"
            >
              <TabsTrigger value="explainer" icon={<BookOpen size={14} aria-hidden="true" />}>
                Explainer
              </TabsTrigger>
              <TabsTrigger value="design" icon={<Zap size={14} aria-hidden="true" />}>
                Design
              </TabsTrigger>
              <TabsTrigger value="tracer" icon={<Microscope size={14} aria-hidden="true" />}>
                Tracer
              </TabsTrigger>
              <TabsTrigger value="splicing" icon={<Dna size={14} aria-hidden="true" />}>
                Splicing
              </TabsTrigger>
              <TabsTrigger value="archive" icon={<Archive size={14} aria-hidden="true" />}>
                Archive
              </TabsTrigger>
              <TabsTrigger value="studio" icon={<FlaskConical size={14} aria-hidden="true" />}>
                Studio
              </TabsTrigger>
              <TabsTrigger value="analytics" icon={<BarChart3 size={14} aria-hidden="true" />}>
                Analytics
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="explainer">
            <VariantExplainerTab variants={variants} externalVariantId={explainerVariant} onSourceChange={setActiveSource} />
          </TabsContent>
          <TabsContent value="design">
            <CompensatoryDesignTab onSourceChange={setActiveSource} />
          </TabsContent>
          <TabsContent value="tracer">
            <DiseaseTracerTab />
          </TabsContent>
          <TabsContent value="splicing">
            <SplicingDecoderTab />
          </TabsContent>
          <TabsContent value="archive">
            <DnaArchiveLabTab />
          </TabsContent>
          <TabsContent value="studio">
            <DesignStudioTab />
          </TabsContent>

          <TabsContent value="analytics">
            <div className="space-y-12">
              <AnalyticsDashboard
                records={history}
                onClear={handleClearHistory}
                onExport={(cfg) => handleExport(cfg)}
                onBulkDelete={handleBulkDelete}
                onBulkArchive={handleBulkArchive}
              />
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Clock size={20} className="text-primary" /> Audit History
                </h3>
                <HistoryTable
                  records={history}
                  onDelete={handleDeleteRecord}
                  onBulkDelete={handleBulkDelete}
                  onBulkArchive={handleBulkArchive}
                  onBulkExport={(ids) => handleExport({
                    format: 'CSV',
                    filename: 'selected_variants_export',
                    includeStats: false,
                    includeCharts: false,
                    includeRecords: true,
                    includeMetadata: true
                  }, ids)}
                  onView={(r) => {
                    setActiveTab('explainer');
                    setExplainerVariant(`${r.gene} ${r.hgvs_c || r.variant}`);
                    setToast({ message: `Loading detailed view for ${r.gene}...`, type: 'info' });
                  }}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
        </Suspense>
      </main>

      {toast && <ToastNotification message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <Footer />
      {/* Both modals render null when closed and have no exit animation, so
          gating on isOpen keeps their chunks out of the initial load. */}
      {isSettingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            currentTheme={currentTheme}
            onThemeChange={applyTheme}
            onConfigChange={() => {
              const isOffline = configService.isForcedOffline();
              setToast({
                message: isOffline
                  ? 'Offline Demo Mode enabled (Simulation mode active)'
                  : 'Live API Mode enabled (Live models active)',
                type: isOffline ? 'info' : 'success'
              });
            }}
          />
        </Suspense>
      )}
      {isShortcutsOpen && (
        <Suspense fallback={null}>
          <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

function App() {
  if (window.location.pathname === '/') {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
        <LandingPage />
      </Suspense>
    );
  }

  return <WorkspaceApp />;
}

export default App;
