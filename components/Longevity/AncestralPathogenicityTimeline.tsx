import React, { useState, useEffect } from 'react';
import { TreePine, Clock, MapPin, Users, Info } from 'lucide-react';
import { backendService } from '../../services/backendService';

interface AncestralVariant {
  id: string;
  variantId: string;
  gene: string;
  hgvs: string;
  mutationAgeEstimate: number; // in years ago
  geographicOrigin: string;
  populationPrevalence: Record<string, number>; // e.g. { "European": 0.001, "African": 0.003 }
  selectionPressure: string; // "balancing", "positive", "negative", "neutral"
  reasonPersisted: string; // why the variant persisted
  whyDoIHaveThis: string; // explanation for patient
  createdAt: string;
  variant?: {
    gene: string;
    hgvs_c: string;
    acmg_class: string;
  };
  patient?: {
    patientId: string;
    name?: string;
  };
}

const AncestralPathogenicityTimeline: React.FC = () => {
  const [patientId, setPatientId] = useState<string>('');
  const [ancestralVariants, setAncestralVariants] = useState<AncestralVariant[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<AncestralVariant | null>(null);
  const [patients, setPatients] = useState<{patientId: string, name?: string}[]>([]);

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const patientData = await backendService.getPatients();
        setPatients(patientData.map(p => ({ patientId: p.patientId, name: p.name })));
      } catch (err) {
        setError('Failed to fetch patients');
        console.error(err);
      }
    };

    fetchPatients();
  }, []);

  const fetchAncestralData = async () => {
    if (!patientId) return;
    
    setLoading(true);
    setError(null);
    try {
      // In a real implementation, we would fetch ancestral pathogenicity data
      // For now, we'll simulate data based on existing variants
      const variantsResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/variants?patientId=${patientId}`, { credentials: 'include' });
      if (!variantsResponse.ok) throw new Error('Failed to fetch variants');
      const variants = await variantsResponse.json();
      
      // Simulate ancestral data for each variant
      const simulatedAncestralData: AncestralVariant[] = variants.map((v: any, index: number) => ({
        id: `anc-${v.id}`,
        variantId: v.id,
        gene: v.gene,
        hgvs: v.hgvs_c,
        mutationAgeEstimate: 2000 + Math.random() * 200000, // Random age between 2k-200k years
        geographicOrigin: ['Africa', 'Europe', 'Asia', 'Americas'][Math.floor(Math.random() * 4)],
        populationPrevalence: {
          'African': Math.random() * 0.05,
          'European': Math.random() * 0.05,
          'East Asian': Math.random() * 0.05,
          'South Asian': Math.random() * 0.05,
          'Latino': Math.random() * 0.05
        },
        selectionPressure: ['balancing', 'positive', 'negative', 'neutral'][Math.floor(Math.random() * 4)],
        reasonPersisted: [
          "Balancing selection (heterozygote advantage)",
          "Founder effect in isolated population", 
          "Genetic drift in small population",
          "Recent mutation that hasn't been selected against"
        ][Math.floor(Math.random() * 4)],
        whyDoIHaveThis: [
          `This variant originated approximately ${Math.floor(2000 + Math.random() * 200000)} years ago in ${['Africa', 'Europe', 'Asia', 'Americas'][Math.floor(Math.random() * 4)]}. It persisted through balancing selection, providing heterozygote advantage against infectious diseases.`,
          `This variant likely arrived in your lineage through founder effects during human migration. It represents ancient genetic diversity that has persisted through generations.`,
          `This is a relatively recent mutation that occurred in your ancestral population. It may not have experienced strong selective pressure yet.`
        ][Math.floor(Math.random() * 3)],
        createdAt: v.createdAt,
        variant: v,
        patient: {
          patientId: v.patientId,
          name: 'Simulated Patient' // Would come from actual patient data
        }
      }));
      
      setAncestralVariants(simulatedAncestralData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getSelectionPressureColor = (pressure: string) => {
    switch (pressure) {
      case 'balancing': return 'text-blue-500 bg-blue-500/10';
      case 'positive': return 'text-green-500 bg-green-500/10';
      case 'negative': return 'text-red-500 bg-red-500/10';
      case 'neutral': return 'text-gray-500 bg-gray-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };

  const getLeftClass = (percent: number) => `left-p-${Math.round(Math.max(0, Math.min(100, percent)))}`;

  useEffect(() => {
    if (patientId) {
      fetchAncestralData();
    }
  }, [patientId]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <TreePine className="text-scientific-blue" size={32} /> Ancestral Pathogenicity Timeline
          </h1>
          <p className="text-slate-400 mt-2">
            Evolutionary visualization of when your variants emerged in human history
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            aria-label="Select patient"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-white focus:border-primary focus:outline-none"
          >
            <option value="">Select Patient</option>
            {patients.map(p => (
              <option key={p.patientId} value={p.patientId}>
                {p.name || p.patientId} {p.name ? `(${p.patientId})` : ''}
              </option>
            ))}
          </select>
          <button 
            onClick={fetchAncestralData}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-bold transition-all"
          >
            <Clock size={18} /> Trace Ancestry
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 flex items-center gap-3">
          <Info className="text-red-400" size={24} />
          <div>
            <h3 className="text-red-300 font-bold">Error</h3>
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      )}

      {ancestralVariants.length > 0 && (
        <div className="space-y-6">
          {/* Timeline Header */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Evolutionary Timeline</h2>
            <p className="text-slate-400">
              Interactive timeline showing when your variants arose in human history (100K years ago → present)
            </p>
            
            {/* Timeline Visualization */}
            <div className="mt-6 relative">
              {/* Timeline */}
              <div className="relative">
                <div className="absolute top-8 left-0 right-0 h-1 bg-slate-700"></div>
                
                {/* Events on timeline */}
                <div className="relative flex justify-between h-24 mt-16">
                  {ancestralVariants.slice(0, 5).map((variant, index) => (
                    <div 
                      key={variant.id} 
                      className={`absolute ${getLeftClass((index / 4) * 100)} -translate-x-1/2`}
                    >
                      <div 
                        className={`w-6 h-6 rounded-full border-4 border-slate-900 cursor-pointer flex items-center justify-center ${
                          variant.selectionPressure === 'balancing' ? 'bg-blue-500' :
                          variant.selectionPressure === 'positive' ? 'bg-green-500' :
                          variant.selectionPressure === 'negative' ? 'bg-red-500' : 'bg-gray-500'
                        }`}
                        onClick={() => setSelectedVariant(variant)}
                      >
                        <span 
                          className="absolute left-1/2 -top-8 -translate-x-1/2 text-xs font-bold text-white bg-slate-800 px-2 py-1 rounded whitespace-nowrap"
                        >
                          ~{Math.floor(variant.mutationAgeEstimate/1000)}kY
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Labels */}
                <div className="flex justify-between text-slate-400 text-sm mt-24">
                  <span>100,000 years ago</span>
                  <span>50,000 years ago</span>
                  <span>Present Day</span>
                </div>
              </div>
            </div>
          </div>

          {/* Variant List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Variant Origins</h3>
              
              <div className="space-y-4">
                {ancestralVariants.map(variant => (
                  <div 
                    key={variant.id}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedVariant?.id === variant.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'
                    }`}
                    onClick={() => setSelectedVariant(variant)}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h4 className="font-bold text-white flex items-center gap-2">
                          <MapPin size={16} />
                          {variant.gene} {variant.hgvs}
                        </h4>
                        <p className="text-slate-400 text-sm">
                          Origin: {variant.geographicOrigin} • ~{Math.floor(variant.mutationAgeEstimate/1000)} thousand years ago
                        </p>
                      </div>
                      
                      <div className="flex flex-col items-end">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getSelectionPressureColor(variant.selectionPressure)}`}>
                          {variant.selectionPressure} selection
                        </span>
                        <span className="text-slate-400 text-sm mt-1">
                          {variant.reasonPersisted}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Variant Detail */}
            {selectedVariant && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Variant Detail</h3>
                
                <div className="space-y-4">
                  <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <h4 className="font-bold text-white mb-2">{selectedVariant.gene} {selectedVariant.hgvs}</h4>
                    <p className="text-slate-300">
                      <strong>Origin:</strong> {selectedVariant.geographicOrigin}, ~{Math.floor(selectedVariant.mutationAgeEstimate/1000)} thousand years ago
                    </p>
                    <p className="text-slate-300 mt-1">
                      <strong>Selection Pressure:</strong> {selectedVariant.selectionPressure} selection
                    </p>
                    <p className="text-slate-300 mt-1">
                      <strong>Reason Persisted:</strong> {selectedVariant.reasonPersisted}
                    </p>
                  </div>
                  
                  <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                      <Info size={16} /> Why do I have this?
                    </h4>
                    <p className="text-slate-300">
                      {selectedVariant.whyDoIHaveThis}
                    </p>
                  </div>
                  
                  <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                      <Users size={16} /> Population Prevalence
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(selectedVariant.populationPrevalence).map(([pop, freq]) => (
                        <div key={pop} className="flex justify-between">
                          <span className="text-slate-400">{pop}:</span>
                          <span className="text-white">{(freq * 100).toFixed(4)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {ancestralVariants.length === 0 && patientId && !loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <TreePine className="text-slate-600 mx-auto mb-4" size={48} />
          <h3 className="text-xl font-bold text-white mb-2">No Ancestral Data Found</h3>
          <p className="text-slate-400 mb-6">
            No ancestral pathogenicity data has been calculated for this patient yet.
          </p>
        </div>
      )}
    </div>
  );
};

export default AncestralPathogenicityTimeline;