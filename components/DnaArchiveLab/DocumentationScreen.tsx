import React from 'react';
import DisclaimerFooter from './DisclaimerFooter';

const DocumentationScreen: React.FC = () => (
  <div className="space-y-6">
    <article className="mm-card-glowing mm-glow mm-glow--cyan p-6 space-y-4 text-sm text-slate-300 leading-relaxed">
      <h2 className="text-white font-black text-sm uppercase tracking-wider">Documentation / methodology</h2>
      <section>
        <h3 className="text-cyan-300 font-bold text-xs uppercase tracking-wider mb-1">Purpose and scope</h3>
        <p>
          DNA Archive Lab is an in-silico simulator for DNA-inspired digital archival storage. It encodes a small
          file into DNA-like sequences, applies a deterministic channel-error model, and verifies recovery by SHA-256.
        </p>
      </section>
      <section>
        <h3 className="text-cyan-300 font-bold text-xs uppercase tracking-wider mb-1">Non-lab boundary</h3>
        <p>
          This module does not perform laboratory operations. It does not provide wet-lab protocols, genetic-engineering
          instructions, or any physical process guidance.
        </p>
      </section>
      <section>
        <h3 className="text-cyan-300 font-bold text-xs uppercase tracking-wider mb-1">Encoding profiles</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Learning mode: deterministic 2-bit mapping 00→A, 01→C, 10→G, 11→T with visible indexes and checksums.</li>
          <li>Constraint-aware mode: payload chunks, homopolymer limits, GC monitoring, and strand-copy redundancy.</li>
          <li>Advanced codec adapter: interface only — not enabled in this version.</li>
        </ul>
      </section>
      <section>
        <h3 className="text-cyan-300 font-bold text-xs uppercase tracking-wider mb-1">Channel-error models</h3>
        <p>
          Simulated channel errors include substitution, insertion, deletion, strand dropout, strand duplication, and
          coverage depth. The same input, encoding profile, error profile, and seed reproduce the same output.
        </p>
      </section>
      <section>
        <h3 className="text-cyan-300 font-bold text-xs uppercase tracking-wider mb-1">Privacy and retention</h3>
        <p>
          Uploads are capped at 1 MB and limited to text/JSON/CSV. Source bytes are purged after encode; SHA-256 and
          strand metadata remain. Do not upload personal, genomic, or clinical files.
        </p>
      </section>
      <section>
        <h3 className="text-cyan-300 font-bold text-xs uppercase tracking-wider mb-1">Not for clinical, biological, or laboratory decision-making</h3>
        <p>
          Density figures are theoretical/simulation-derived. Exports are computational artifacts. References such as
          DNA Fountain, DNA Storage Toolkit, Chamaeleo, and DNA-Storalator are cited as background only.
        </p>
      </section>
    </article>
    <DisclaimerFooter />
  </div>
);

export default DocumentationScreen;
