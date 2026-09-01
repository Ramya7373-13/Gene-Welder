import React, { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import DisclaimerFooter from './DisclaimerFooter';
import ConfirmModal from '../ConfirmModal';
import { dnaArchiveLabService } from '../../services/dnaArchiveLabService';
import type { DnaStorageExperiment } from '../../types/dnaStorage';

interface HistoryScreenProps {
  onOpen?: (experimentId: string) => void;
}

const HistoryScreen: React.FC<HistoryScreenProps> = ({ onOpen }) => {
  const [experiments, setExperiments] = useState<DnaStorageExperiment[]>([]);
  const [pendingDelete, setPendingDelete] = useState<DnaStorageExperiment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setExperiments(await dnaArchiveLabService.listExperiments());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to list experiments');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await dnaArchiveLabService.deleteExperiment(pendingDelete.id);
      setPendingDelete(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete experiment');
    }
  };

  return (
    <div className="space-y-6">
      <div className="mm-card-glowing mm-glow mm-glow--cyan p-6">
        <h2 className="text-white font-black text-sm uppercase tracking-wider mb-4">Experiment history</h2>
        {error ? <p className="text-rose-300 text-sm mb-3">{error}</p> : null}
        {experiments.length === 0 ? (
          <p className="text-sm text-slate-500">No experiments yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 text-xs uppercase tracking-wider">
                <th className="py-2">Title</th>
                <th>Status</th>
                <th>Seed</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {experiments.map((item) => (
                <tr key={item.id} className="border-t border-slate-800 text-slate-200">
                  <td className="py-2">
                    <button type="button" className="text-cyan-300 hover:underline" onClick={() => onOpen?.(item.id)}>
                      {item.title}
                    </button>
                  </td>
                  <td className="font-mono text-xs">{item.status}</td>
                  <td className="font-mono text-xs">{item.randomSeed ?? '—'}</td>
                  <td className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</td>
                  <td>
                    <button type="button" aria-label={`Delete ${item.title}`} onClick={() => setPendingDelete(item)} className="text-rose-400">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <ConfirmModal
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete experiment"
        description="This removes the computational experiment record and stored artifacts. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
      />
      <DisclaimerFooter />
    </div>
  );
};

export default HistoryScreen;
