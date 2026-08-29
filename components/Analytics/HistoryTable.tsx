import React, { useState, useEffect, memo } from 'react';
import { backendService, Patient, Variant } from '../../services/backendService';
import {
  Trash2, ExternalLink, Download, UserPlus, Database,
  Users, Activity, CheckCircle2, WifiOff, Wifi
} from 'lucide-react';
import EmptyState from '../EmptyState';

interface HistoryTableProps {
  records: any[];
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkArchive: (ids: string[], archive: boolean) => void;
  onBulkExport: (ids: string[]) => void;
  onView: (record: any) => void;
}

const HistoryTable: React.FC<HistoryTableProps> = ({
  records: initialRecords,
  onDelete,
  onBulkDelete,
  onBulkArchive,
  onBulkExport,
  onView,
}) => {
  const [patients,        setPatients]        = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [variants,        setVariants]        = useState<Variant[]>([]);
  const [history,         setHistory]         = useState<any[]>([]);
  const [loading,         setLoading]         = useState(false);
  const [backendOk,       setBackendOk]       = useState<boolean | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [pts, hist] = await Promise.all([
          backendService.getPatients(),
          backendService.getHistory(),
        ]);
        setPatients(pts);
        setHistory(hist);
        setBackendOk(true);
      } catch {
        setBackendOk(false);
      }
    };
    init();
  }, []);

  const loadVariants = async (patientId: string) => {
    setVariants([]);
    if (!patientId) return;
    setLoading(true);
    try {
      setVariants(await backendService.getVariants(patientId));
    } catch {
      /* handled gracefully by empty state below */
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePatient = async () => {
    const id = `MRN-${Math.floor(100000 + Math.random() * 900000)}`;
    try {
      await backendService.createPatient({ patientId: id });
      setPatients(await backendService.getPatients());
    } catch {
      /* surface via status banner already */
    }
  };

  const isEmpty = (n: number) => n === 0;

  return (
    <div className="space-y-6">

      {/* Two-column management panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Clinical Patient Management */}
        <div className="mm-card-glowing mm-glow mm-glow--cyan p-6 rounded-2xl shadow-xl transition-all duration-300">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Database className="text-cyan-400" size={18} aria-hidden="true" />
            Clinical Patient Management
          </h3>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <select
                aria-label="Select research patient"
                className="ds-select w-full"
                value={selectedPatient}
                onChange={(e) => {
                  setSelectedPatient(e.target.value);
                  loadVariants(e.target.value);
                }}
                disabled={patients.length === 0}
              >
                <option value="">
                  {patients.length === 0 ? 'No patients registered' : 'Select Research Patient'}
                </option>
                {patients.map(p => (
                  <option key={p.id} value={p.patientId}>
                    {p.name ? `${p.name} (${p.patientId})` : p.patientId}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleCreatePatient}
              aria-label="Register new patient with auto-generated MRN"
              className={[
                'flex items-center justify-center gap-2 px-5 py-2 rounded-lg',
                'text-xs font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 uppercase tracking-widest shadow-[0_0_15px_rgba(34,211,238,0.4)] hover:shadow-[0_0_20px_rgba(34,211,238,0.6)]',
                'transition-all duration-150 shrink-0',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70',
                'active:scale-[0.97]',
              ].join(' ')}
            >
              <UserPlus size={16} aria-hidden="true" /> New Patient
            </button>
          </div>

          {/* Zero-state when no patients */}
          {patients.length === 0 && backendOk === true && (
            <div className="mt-4">
              <EmptyState
                icon={Users}
                headline="No patients registered"
                subtext="Click 'New Patient' to register the first research patient."
                size="compact"
              />
            </div>
          )}
        </div>

        {/* Repository Overview */}
        <div className="mm-card-glowing mm-glow mm-glow--cyan p-6 rounded-2xl shadow-xl transition-all duration-300">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Database className="text-cyan-400" size={18} aria-hidden="true" />
            Repository Overview
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {/* Total Patients stat */}
            <div className={`rounded-xl border p-4 transition-all ${isEmpty(patients.length) ? "border-slate-800 bg-slate-950/50" : "border-cyan-500/30 bg-cyan-950/20 shadow-[inset_0_0_10px_rgba(34,211,238,0.05)]"}`}>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Total Patients</div>
              {isEmpty(patients.length) ? (
                <>
                  <div className="text-2xl font-bold text-slate-700">0</div>
                  <div className="text-[10px] text-slate-700 italic mt-0.5">No patients yet</div>
                </>
              ) : (
                <div className="text-2xl font-bold text-white">{patients.length}</div>
              )}
            </div>

            {/* Total Analyses stat */}
            <div className={`rounded-xl border p-4 transition-all ${isEmpty(history.length) ? "border-slate-800 bg-slate-950/50" : "border-cyan-500/30 bg-cyan-950/20 shadow-[inset_0_0_10px_rgba(34,211,238,0.05)]"}`}>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Total Analyses</div>
              {isEmpty(history.length) ? (
                <>
                  <div className="text-2xl font-bold text-slate-700">0</div>
                  <div className="text-[10px] text-slate-700 italic mt-0.5">Run first analysis</div>
                </>
              ) : (
                <div className="text-2xl font-bold text-white">{history.length}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Variants table — shown only when a patient is selected */}
      {selectedPatient && (
        <div className="mm-card-glowing mm-glow mm-glow--purple rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-300 shadow-xl">
          <div className="px-5 py-3.5 bg-slate-950/60 border-b border-slate-800 flex justify-between items-center">
            <h3 className="font-semibold text-white text-sm">
              Variants — <span className="font-mono text-cyan-400">{selectedPatient}</span>
            </h3>
            <span className="text-xs text-slate-500">{variants.length} record{variants.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left" aria-label={`Variants for patient ${selectedPatient}`}>
              <thead className="bg-slate-950 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3">Gene</th>
                  <th className="px-5 py-3">HGVS (c)</th>
                  <th className="px-5 py-3">Zygosity</th>
                  <th className="px-5 py-3">gnomAD Freq</th>
                  <th className="px-5 py-3">ACMG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center">
                      <span className="text-slate-500 text-sm animate-pulse">Loading variants…</span>
                    </td>
                  </tr>
                ) : variants.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState
                        icon={Activity}
                        headline="No variants registered"
                        subtext="No variant data has been recorded for this patient yet."
                        size="compact"
                      />
                    </td>
                  </tr>
                ) : (
                  variants.map(v => (
                    <tr
                      key={v.id}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                      onClick={() => onView(v)}
                      tabIndex={0}
                      role="button"
                      aria-label={`View details for ${v.gene} ${v.hgvs_c}`}
                      onKeyDown={(e) => e.key === 'Enter' && onView(v)}
                    >
                      <td className="px-5 py-3.5 font-bold text-white text-sm group-hover:text-cyan-400 transition-colors">{v.gene}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-cyan-400">{v.hgvs_c}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-300 capitalize">{v.zygosity}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">{v.gnomad_freq || 'N/A'}</td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          v.acmg_class === 'PVS1'
                            ? 'bg-red-500/12 text-red-400 border border-red-500/20'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {v.acmg_class || 'Unclassified'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* System status banner — reusable StatusBanner pattern */}
      {backendOk !== null && (
        <div
          role="status"
          aria-live="polite"
          className={`ds-status-banner ${backendOk ? 'ds-status-banner--connected' : 'ds-status-banner--disconnected'}`}
        >
          {backendOk
            ? <><CheckCircle2 size={14} aria-hidden="true" /> System connected to clinical backend — <span className="font-bold">{history.length}</span> analysis record{history.length !== 1 ? 's' : ''} in persistent storage.</>
            : <><WifiOff size={14} aria-hidden="true" /> Backend unavailable — running in simulation mode. Patient data will not persist.</>
          }
        </div>
      )}
    </div>
  );
};

export default memo(HistoryTable);
