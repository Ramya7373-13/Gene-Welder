import React, { useState, useEffect } from 'react';
import { Pill, Heart, Dumbbell, Apple, Shield, Activity, Star, Target, Check, X } from 'lucide-react';
import { backendService } from '../../services/backendService';

interface RiskAssessment {
  id: string;
  patientId: string;
  variantId?: string;
  diseaseType: string;
  riskScore: number; // 0.0 - 1.0 scale
  relativeRisk: number; // vs population baseline
  severityLevel: 'low' | 'moderate' | 'high' | 'actionable';
  riskCategory: 'green' | 'yellow' | 'red' | 'purple';
  createdAt: string;
  variant?: {
    gene: string;
    hgvs_c: string;
    acmg_class: string;
  };
}

interface Intervention {
  id: string;
  riskAssessmentId: string;
  interventionType: 'lifestyle' | 'pharmacological' | 'screening' | 'supplement';
  interventionName: string;
  interventionDescription?: string;
  evidenceLevel: 'A' | 'B' | 'C'; // Grade A/B/C
  expectedRiskReduction?: number; // Expected % risk reduction
  preventableYears?: number; // Years of life potentially gained
  recommended: boolean;
  implemented: boolean;
  implementationDate?: string;
  createdAt: string;
}

interface ActionableIntervention extends RiskAssessment {
  interventions: Intervention[];
}

const ActionableInterventionEngine: React.FC = () => {
  const [patientId, setPatientId] = useState<string>('');
  const [interventions, setInterventions] = useState<ActionableIntervention[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIntervention, setSelectedIntervention] = useState<ActionableIntervention | null>(null);
  const [patients, setPatients] = useState<{patientId: string, name?: string}[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'pharmacological' | 'lifestyle' | 'screening' | 'supplements'>('all');

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

  const fetchInterventions = async () => {
    if (!patientId) return;
    
    setLoading(true);
    setError(null);
    try {
      // Fetch risk assessments for this patient
      const assessmentsResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/risk-assessments?patientId=${patientId}`, {
        credentials: 'include'
      });
      if (!assessmentsResponse.ok) throw new Error('Failed to fetch risk assessments');
      const assessments: RiskAssessment[] = await assessmentsResponse.json();

      // For each assessment, fetch the corresponding interventions
      const interventionData = await Promise.all(
        assessments.map(async (assessment) => {
          const interventionsResponse = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/interventions?riskAssessmentId=${assessment.id}`, {
            credentials: 'include'
          });
          if (!interventionsResponse.ok) throw new Error('Failed to fetch interventions');
          const interventions: Intervention[] = await interventionsResponse.json();
          
          return {
            ...assessment,
            interventions
          };
        })
      );

      setInterventions(interventionData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) {
      fetchInterventions();
    }
  }, [patientId]);

  const filteredInterventions = interventions.filter(ass => {
    if (activeTab === 'all') return true;
    return ass.interventions.some(i => i.interventionType === activeTab);
  });

  const getEvidenceColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-500 bg-green-500/10';
      case 'B': return 'text-yellow-500 bg-yellow-500/10';
      case 'C': return 'text-red-500 bg-red-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };

  const getInterventionIcon = (type: string) => {
    switch (type) {
      case 'pharmacological': return <Pill size={16} />;
      case 'lifestyle': return <Dumbbell size={16} />;
      case 'screening': return <Heart size={16} />;
      case 'supplement': return <Apple size={16} />;
      default: return <Target size={16} />;
    }
  };

  const updateInterventionStatus = async (id: string, implemented: boolean) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/interventions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ implemented, implementationDate: implemented ? new Date().toISOString() : null })
      });
      
      if (!response.ok) throw new Error('Failed to update intervention status');
      
      // Update local state
      setInterventions(prev => prev.map(ass => ({
        ...ass,
        interventions: ass.interventions.map(i => 
          i.id === id ? { ...i, implemented, implementationDate: implemented ? new Date().toISOString() : null } : i
        )
      })));
    } catch (err) {
      console.error('Error updating intervention status:', err);
    }
  };

  const calculateImpactMetrics = () => {
    const totalInterventions = interventions.flatMap(a => a.interventions).length;
    const implementedInterventions = interventions.flatMap(a => a.interventions).filter(i => i.implemented).length;
    const preventableYears = interventions.flatMap(a => a.interventions).reduce((sum, i) => sum + (i.preventableYears || 0), 0);
    const highPriorityInterventions = interventions
      .filter(a => a.severityLevel === 'high' || a.severityLevel === 'actionable')
      .flatMap(a => a.interventions).length;
    
    return {
      totalInterventions,
      implementedInterventions,
      preventableYears,
      highPriorityInterventions
    };
  };

  const metrics = calculateImpactMetrics();

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="text-scientific-blue" size={32} /> Actionable Intervention Engine
          </h1>
          <p className="text-slate-400 mt-2">
            Personalized intervention strategies for each high-risk variant
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
            onClick={fetchInterventions}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-bold transition-all"
          >
            <Target size={18} /> Generate Interventions
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
          <Activity className="text-red-400" size={24} />
          <div>
            <h3 className="text-red-300 font-bold">Error</h3>
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      )}

      {interventions.length > 0 && (
        <>
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Target className="text-primary" size={24} />
                </div>
                <div>
                  <p className="text-slate-400">Total Interventions</p>
                  <p className="text-2xl font-bold text-white">{metrics.totalInterventions}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Check className="text-green-500" size={24} />
                </div>
                <div>
                  <p className="text-slate-400">Implemented</p>
                  <p className="text-2xl font-bold text-white">{metrics.implementedInterventions}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <Star className="text-yellow-500" size={24} />
                </div>
                <div>
                  <p className="text-slate-400">Preventable Years</p>
                  <p className="text-2xl font-bold text-white">{metrics.preventableYears}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <Shield className="text-red-500" size={24} />
                </div>
                <div>
                  <p className="text-slate-400">High Priority</p>
                  <p className="text-2xl font-bold text-white">{metrics.highPriorityInterventions}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-1 flex flex-wrap gap-1">
            <button
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'all' 
                  ? 'bg-primary text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              onClick={() => setActiveTab('all')}
            >
              All Interventions
            </button>
            <button
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'pharmacological' 
                  ? 'bg-primary text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              onClick={() => setActiveTab('pharmacological')}
            >
              Pharmacological
            </button>
            <button
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'lifestyle' 
                  ? 'bg-primary text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              onClick={() => setActiveTab('lifestyle')}
            >
              Lifestyle
            </button>
            <button
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'screening' 
                  ? 'bg-primary text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              onClick={() => setActiveTab('screening')}
            >
              Screening
            </button>
            <button
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'supplements' 
                  ? 'bg-primary text-white shadow-lg' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              onClick={() => setActiveTab('supplements')}
            >
              Supplements
            </button>
          </div>

          {/* Interventions List */}
          <div className="space-y-6">
            {filteredInterventions.length > 0 ? (
              filteredInterventions.map((assessment, index) => (
                <div key={assessment.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-full ${
                          assessment.riskCategory === 'red' ? 'bg-red-500' :
                          assessment.riskCategory === 'yellow' ? 'bg-yellow-500' :
                          assessment.riskCategory === 'green' ? 'bg-green-500' :
                          'bg-purple-500'
                        }`}></span>
                        {assessment.diseaseType} Risk Assessment
                      </h3>
                      <p className="text-slate-400 flex items-center gap-2 mt-1">
                        {assessment.variant && <span>Gene: {assessment.variant.gene}</span>}
                        {assessment.variant && <span>•</span>}
                        {assessment.variant && <span>HGVS: {assessment.variant.hgvs_c}</span>}
                        <span>•</span>
                        <span>Relative Risk: {assessment.relativeRisk.toFixed(2)}x</span>
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      assessment.riskCategory === 'red' ? 'text-red-500 bg-red-500/10' :
                      assessment.riskCategory === 'yellow' ? 'text-yellow-500 bg-yellow-500/10' :
                      assessment.riskCategory === 'green' ? 'text-green-500 bg-green-500/10' :
                      'text-purple-500 bg-purple-500/10'
                    }`}>
                      {assessment.severityLevel.toUpperCase()}
                    </span>
                  </div>

                  {assessment.interventions.length > 0 ? (
                    <div className="space-y-4">
                      {assessment.interventions
                        .filter(i => activeTab === 'all' || i.interventionType === activeTab)
                        .map(intervention => (
                          <div 
                            key={intervention.id} 
                            className={`p-4 rounded-xl border ${
                              intervention.implemented 
                                ? 'border-green-500/30 bg-green-900/10' 
                                : 'border-slate-700 bg-slate-800/50'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-bold text-white flex items-center gap-2">
                                  {getInterventionIcon(intervention.interventionType)}
                                  {intervention.interventionName}
                                  <span className={`text-xs px-2 py-1 rounded-full ${getEvidenceColor(intervention.evidenceLevel)}`}>
                                    Grade: {intervention.evidenceLevel}
                                  </span>
                                </h4>
                                
                                {intervention.interventionDescription && (
                                  <p className="text-slate-300 mt-2">
                                    {intervention.interventionDescription}
                                  </p>
                                )}
                                
                                <div className="flex items-center gap-4 mt-3 text-sm text-slate-400 flex-wrap">
                                  {intervention.expectedRiskReduction && (
                                    <span>Risk Reduction: <span className="text-white">{intervention.expectedRiskReduction}%</span></span>
                                  )}
                                  {intervention.preventableYears && (
                                    <span>Years Saved: <span className="text-white">{intervention.preventableYears}</span></span>
                                  )}
                                  <span>Category: <span className="text-white capitalize">{intervention.interventionType}</span></span>
                                </div>
                              </div>
                              
                              <div className="flex flex-col items-end gap-2 ml-4">
                                <button
                                  onClick={() => updateInterventionStatus(intervention.id, !intervention.implemented)}
                                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm ${
                                    intervention.implemented
                                      ? 'bg-green-900/50 text-green-400 border border-green-800/50 hover:bg-green-800/50'
                                      : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                                  }`}
                                >
                                  {intervention.implemented ? <><Check size={16} /> Active</> : <><X size={16} /> Take Action</>}
                                </button>
                                
                                {intervention.implementationDate && (
                                  <span className="text-xs text-slate-500">
                                    Started: {new Date(intervention.implementationDate).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-500">
                      No interventions found for this category
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-500">
                No interventions match the selected category filters
              </div>
            )}
          </div>
        </>
      )}

      {interventions.length === 0 && patientId && !loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <Shield className="text-slate-600 mx-auto mb-4" size={48} />
          <h3 className="text-xl font-bold text-white mb-2">No Interventions Found</h3>
          <p className="text-slate-400 mb-6">
            No actionable interventions have been generated for this patient yet.
          </p>
        </div>
      )}
    </div>
  );
};

export default ActionableInterventionEngine;