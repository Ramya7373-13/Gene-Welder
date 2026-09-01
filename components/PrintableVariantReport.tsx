import React from 'react';
import { createPortal } from 'react-dom';
import { VariantAnalysis } from '../services/geminiService';
import { GenomicContext } from '../types/genomics';

interface PrintableVariantReportProps {
  report: VariantAnalysis;
  genomicData?: GenomicContext | null;
}

/**
 * Tier 3: off-screen, print-optimized clinical variant report.
 *
 * Rendered through a portal to <body> (sibling of #root) and hidden on screen via
 * `.mm-printable-report { display: none }`. The global `@media print` rules hide
 * `#root` entirely — stripping every backdrop, glow, and sidebar — and reveal only
 * this document, so the parent's "Export printable report" button just calls
 * `window.print()`. Everything here is a synchronous snapshot of the already-loaded
 * `report` object (no async fetches), so the print layout is deterministic and instant.
 */
const fmtNum = (n: number | null | undefined, digits = 2, suffix = ''): string =>
  typeof n === 'number' && Number.isFinite(n) ? `${n.toFixed(digits)}${suffix}` : '—';

const PrintableVariantReport: React.FC<PrintableVariantReportProps> = ({ report, genomicData }) => {
  if (typeof document === 'undefined') return null;

  const { variant, predictions, alphaMissense, analysis, mechanism } = report;
  const generatedAt = new Date().toLocaleString();

  const amColor =
    alphaMissense?.classification === 'likely_pathogenic'
      ? 'bg-red-100 text-red-800 border-red-400'
      : alphaMissense?.classification === 'likely_benign'
      ? 'bg-green-100 text-green-800 border-green-400'
      : 'bg-amber-100 text-amber-800 border-amber-400';

  const cadd = genomicData?.impact?.cadd;
  const phyloP = genomicData?.conservation?.phyloP;
  const gnomad = genomicData?.frequency?.gnomadGlobal;
  const clinvarPhenotypes = genomicData?.clinvar?.phenotypes;

  return createPortal(
    <div className="mm-printable-report">
      <div className="mm-pr-page">
        {/* ── Header ──────────────────────────────────────────────── */}
        <header
          className="mm-pr-block"
          style={{ borderBottom: '2px solid #111827', paddingBottom: '10px', marginBottom: '16px' }}
        >
          <div className="flex justify-between items-start gap-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                MutationMechanic · Clinical Variant Report
              </div>
              <h1 className="text-2xl font-black text-gray-900 mt-1">
                {variant.protein} <span className="font-mono text-gray-700">{variant.hgvs}</span>
              </h1>
              {variant.disease && <div className="text-sm text-gray-600 mt-0.5">{variant.disease}</div>}
            </div>
            <div className="text-right text-[11px] text-gray-600 font-mono leading-5 shrink-0">
              <div>UniProt: {variant.uniprot || '—'}</div>
              <div>Variant ID: {variant.id || '—'}</div>
              <div>Generated: {generatedAt}</div>
            </div>
          </div>
          <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-gray-700 border border-gray-400 bg-gray-100 rounded px-2 py-1 inline-block">
            Research Use Only — computational decision support, not a diagnosis.
          </div>
        </header>

        {/* ── AlphaMissense + Structural metrics ──────────────────── */}
        <section className="grid grid-cols-2 gap-4 mb-4">
          <div className="mm-pr-block border border-gray-300 rounded p-3">
            <h2 className="text-[11px] font-black uppercase tracking-wider text-gray-500 mb-2">
              AlphaMissense Pathogenicity
            </h2>
            {alphaMissense ? (
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-3xl font-black font-mono text-gray-900">
                  {fmtNum(alphaMissense.pathogenicityScore, 3)}
                </span>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${amColor}`}>
                  {alphaMissense.classification.replace('_', ' ')}
                </span>
                <span className="text-[10px] text-gray-500 font-mono ml-auto">{alphaMissense.source}</span>
              </div>
            ) : (
              <div className="text-sm text-gray-500 italic">Not available for this variant.</div>
            )}
          </div>

          <div className="mm-pr-block border border-gray-300 rounded p-3">
            <h2 className="text-[11px] font-black uppercase tracking-wider text-gray-500 mb-2">
              Structural Metrics (AlphaFold)
            </h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-gray-600">pLDDT (WT)</dt>
              <dd className="font-mono font-bold text-gray-900 text-right">{fmtNum(predictions?.native?.plddt_avg, 1)}</dd>
              <dt className="text-gray-600">pLDDT (Mutant)</dt>
              <dd className="font-mono font-bold text-gray-900 text-right">{fmtNum(predictions?.mutant?.plddt_avg, 1)}</dd>
              <dt className="text-gray-600">Backbone RMSD</dt>
              <dd className="font-mono font-bold text-gray-900 text-right">{fmtNum(predictions?.delta?.rmsd, 2, ' Å')}</dd>
              <dt className="text-gray-600">Confidence Δ</dt>
              <dd className="font-mono font-bold text-gray-900 text-right">{fmtNum(predictions?.delta?.confidence_drop, 1)}</dd>
            </dl>
            {predictions?.delta?.functional_impact && (
              <div className="mt-2 text-[11px] text-gray-700">
                <span className="font-bold">Functional impact:</span> {predictions.delta.functional_impact}
              </div>
            )}
            {predictions?.mutant?.domains_affected && predictions.mutant.domains_affected.length > 0 && (
              <div className="mt-1 text-[11px] text-gray-700">
                <span className="font-bold">Domains affected:</span> {predictions.mutant.domains_affected.join(', ')}
              </div>
            )}
          </div>
        </section>

        {/* ── Plain-English Clinical Summary ──────────────────────── */}
        <section className="mm-pr-block border border-gray-300 rounded p-3 mb-4">
          <h2 className="text-[11px] font-black uppercase tracking-wider text-gray-500 mb-2">
            Plain-English Clinical Summary
          </h2>
          <p className="text-sm text-gray-900 leading-relaxed">{analysis?.summary || '—'}</p>
        </section>

        {/* ── Mechanistic Reasoning ───────────────────────────────── */}
        {mechanism && (
          <section className="mm-pr-block border border-gray-300 rounded p-3 mb-4">
            <h2 className="text-[11px] font-black uppercase tracking-wider text-gray-500 mb-2">
              Mechanistic Reasoning
            </h2>
            <p className="text-sm text-gray-900 leading-relaxed">{mechanism}</p>
          </section>
        )}

        {/* ── Suggested Compensatory Mutations ────────────────────── */}
        {analysis?.compensatory_mutations && analysis.compensatory_mutations.length > 0 && (
          <section className="mm-pr-block mb-4">
            <h2 className="text-[11px] font-black uppercase tracking-wider text-gray-500 mb-2">
              Suggested Compensatory Mutations
            </h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-400 text-left text-[11px] uppercase text-gray-500">
                  <th className="py-1 pr-2 font-bold">Mutation</th>
                  <th className="py-1 pr-2 font-bold">Rationale</th>
                  <th className="py-1 font-bold text-right">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {analysis.compensatory_mutations.map((m, i) => (
                  <tr key={i} className="border-b border-gray-200 align-top">
                    <td className="py-1 pr-2 font-mono font-bold text-gray-900 whitespace-nowrap">{m.mutation}</td>
                    <td className="py-1 pr-2 text-gray-700">{m.reasoning}</td>
                    <td className="py-1 text-right font-mono text-gray-900">{fmtNum(m.confidence * 100, 0, '%')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ── Genomic Context (optional) ──────────────────────────── */}
        {genomicData && (
          <section className="mm-pr-block border border-gray-300 rounded p-3 mb-4">
            <h2 className="text-[11px] font-black uppercase tracking-wider text-gray-500 mb-2">Genomic Context</h2>
            <dl className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm">
              <dt className="text-gray-600">CADD</dt>
              <dd className="font-mono font-bold text-gray-900 col-span-2">{fmtNum(cadd, 1)}</dd>
              <dt className="text-gray-600">PhyloP</dt>
              <dd className="font-mono font-bold text-gray-900 col-span-2">{fmtNum(phyloP, 2)}</dd>
              <dt className="text-gray-600">gnomAD (global)</dt>
              <dd className="font-mono font-bold text-gray-900 col-span-2">
                {typeof gnomad === 'number' && Number.isFinite(gnomad) ? gnomad.toExponential(1) : '—'}
              </dd>
            </dl>
            {clinvarPhenotypes && clinvarPhenotypes.length > 0 && (
              <div className="mt-2 text-[11px] text-gray-700">
                <span className="font-bold">ClinVar:</span> {clinvarPhenotypes.slice(0, 4).join('; ')}
              </div>
            )}
          </section>
        )}

        {/* ── Footer ──────────────────────────────────────────────── */}
        <footer className="mm-pr-block mt-6 pt-3 text-[10px] text-gray-500 leading-4" style={{ borderTop: '1px solid #9ca3af' }}>
          <p>
            AlphaMissense pathogenicity: Cheng et al., Science 381 (2023), CC BY 4.0. Structural predictions via AlphaFold.
            AI summaries generated by Google Gemini. All values are computational predictions and must not be used as the
            sole basis for clinical decisions.
          </p>
          <p className="mt-1">MutationMechanic · Generated {generatedAt}</p>
        </footer>
      </div>
    </div>,
    document.body
  );
};

export default PrintableVariantReport;
