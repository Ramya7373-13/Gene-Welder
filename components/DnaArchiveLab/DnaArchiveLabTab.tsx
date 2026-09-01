import React, { useEffect, useState } from 'react';
import { Archive } from 'lucide-react';
import { dnaArchiveLabService } from '../../services/dnaArchiveLabService';
import OverviewScreen from './OverviewScreen';
import NewExperimentWizard from './NewExperimentWizard';
import EncodingVisualizer from './EncodingVisualizer';
import ErrorSimulatorScreen from './ErrorSimulatorScreen';
import DecodeVerifyScreen from './DecodeVerifyScreen';
import CompareScreen from './CompareScreen';
import HistoryScreen from './HistoryScreen';
import DocumentationScreen from './DocumentationScreen';
import FutureLabIntegrationsScreen from './FutureLabIntegrationsScreen';
import type { SimulateResult } from '../../types/dnaStorage';

type ScreenId =
  | 'overview'
  | 'new'
  | 'encode'
  | 'simulate'
  | 'decode'
  | 'compare'
  | 'history'
  | 'docs'
  | 'future';

const NAV: Array<{ id: ScreenId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'new', label: 'New experiment' },
  { id: 'encode', label: 'Encode' },
  { id: 'simulate', label: 'Error simulation' },
  { id: 'decode', label: 'Decode and verify' },
  { id: 'compare', label: 'Compare' },
  { id: 'history', label: 'History' },
  { id: 'docs', label: 'Documentation' },
  { id: 'future', label: 'Future integrations' },
];

const DnaArchiveLabTab: React.FC = () => {
  const [screen, setScreen] = useState<ScreenId>('overview');
  const [experimentId, setExperimentId] = useState<string | null>(null);
  const [uniqueStrands, setUniqueStrands] = useState(0);
  const [errorRunId, setErrorRunId] = useState<string | undefined>();

  useEffect(() => {
    if (!experimentId) return;
    dnaArchiveLabService
      .getExperiment(experimentId)
      .then((exp) => setUniqueStrands(exp._count?.strands ?? 0))
      .catch(() => undefined);
  }, [experimentId]);

  const handleWizardComplete = (id: string) => {
    setExperimentId(id);
    setScreen('encode');
  };

  const handleSimulated = (result: SimulateResult) => {
    setErrorRunId(result.errorRunId);
    setUniqueStrands(result.uniqueStrands);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="mm-card-glowing mm-glow mm-glow--cyan p-4">
        <div className="flex items-center gap-2 mb-3">
          <Archive size={16} className="text-cyan-400" aria-hidden="true" />
          <h1 className="text-sm font-black uppercase tracking-wider text-white">DNA Archive Lab</h1>
        </div>
        <div className="flex flex-wrap gap-2" role="navigation" aria-label="DNA Archive Lab screens">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setScreen(item.id)}
              className={`text-[11px] px-3 py-1.5 rounded-lg border font-bold uppercase tracking-wider ${
                screen === item.id
                  ? 'border-cyan-400 text-cyan-200 bg-cyan-500/15'
                  : 'border-slate-700 text-slate-400 hover:border-cyan-500/40'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {screen === 'overview' ? <OverviewScreen /> : null}
      {screen === 'new' ? <NewExperimentWizard onComplete={handleWizardComplete} /> : null}
      {screen === 'encode' ? <EncodingVisualizer experimentId={experimentId} /> : null}
      {screen === 'simulate' ? (
        <ErrorSimulatorScreen
          experimentId={experimentId}
          uniqueStrands={uniqueStrands}
          onSimulated={handleSimulated}
        />
      ) : null}
      {screen === 'decode' ? <DecodeVerifyScreen experimentId={experimentId} errorRunId={errorRunId} /> : null}
      {screen === 'compare' ? <CompareScreen /> : null}
      {screen === 'history' ? (
        <HistoryScreen
          onOpen={(id) => {
            setExperimentId(id);
            setScreen('encode');
          }}
        />
      ) : null}
      {screen === 'docs' ? <DocumentationScreen /> : null}
      {screen === 'future' ? <FutureLabIntegrationsScreen /> : null}
    </div>
  );
};

export default DnaArchiveLabTab;
