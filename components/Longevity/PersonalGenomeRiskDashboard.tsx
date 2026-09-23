import React, { useState, useEffect } from 'react';
import { 
  Activity, TrendingUp, Calendar, AlertTriangle, 
  CheckCircle, XCircle, Info, User, Plus, Download
} from 'lucide-react';
import { backendService } from '../../services/backendService';

interface RiskAssessment {
  id: string;
  patientId: string;
  diseaseType: string;
  riskScore: number; // 0.0 - 1.0 scale
  biologicalAge?: number;
  relativeRisk: number; // vs population baseline
  confidenceIntervalLower: number;
  confidenceIntervalUpper: number;
  riskTrajectoryCurrent?: number; // Current risk level
  riskTrajectory5Year?: number; // 5-year projected risk
  riskTrajectory10Year?: number; // 10-year projected risk
  riskTrajectoryLifetime?: number; // Lifetime risk
  severityLevel: 'low' | 'moderate' | 'high' | 'actionable';
  riskCategory: 'green' | 'yellow' | 'red' | 'purple';
  createdAt: string;
  variant?: {
    gene: string;
    hgvs_c: string;
  };
  patient?: {
    name?: string;
  };
}

interface Intervention {
  id: string;
  riskAssessmentId: string;
  interventionType: string;
  interventionName: string;
  interventionDescription?: string;
  evidenceLevel: string; // 'A', 'B', 'C' grade
  expectedRiskReduction?: number;
  preventableYears?: number;
  recommended: boolean;
  implemented: boolean;
  implementationDate?: string;
  createdAt: string;
}

const PersonalGenomeRiskDashboard: React.FC = () => {
  const [patientId, setPatientId] = useState<string>('');
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssessment, setSelectedAssessment] = useState<RiskAssessment | null>(null);
  const [interventions, setInterventions] = useState<Intervention[]>([]);

  // Fetch patients to select from
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

  const fetchRiskAssessments = async () => {
    if (!patientId) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/risk-assessments?patientId=${patientId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch risk assessments');
      const data = await response.json();
      setAssessments(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchInterventions = async (assessmentId: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/interventions?riskAssessmentId=${assessmentId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch interventions');
      const data = await response.json();
      setInterventions(data);
    } catch (err: any) {
      console.error('Error fetching interventions:', err);
    }
  };

  useEffect(() => {
    if (patientId) {
      fetchRiskAssessments();
    }
  }, [patientId]);

  useEffect(() => {
    if (selectedAssessment) {
      fetchInterventions(selectedAssessment.id);
    } else {
      setInterventions([]);
    }
  }, [selectedAssessment]);

  const getRiskColor = (category: string) => {
    switch (category) {
      case 'green': return 'text-green-500 bg-green-500/10';
      case 'yellow': return 'text-yellow-500 bg-yellow-500/10';
      case 'red': return 'text-red-500 bg-red-500/10';
      case 'purple': return 'text-purple-500 bg-purple-500/10';
      default: return 'text-gray-500 bg-gray-500/10';
    }
  };

  const getRiskLabel = (severity: string) => {
    switch (severity) {
      case 'low': return 'Low Risk';
      case 'moderate': return 'Moderate Risk';
      case 'high': return 'High Risk';
      case 'actionable': return 'Actionable';
      default: return severity;
    }
  };

  const calculateLongevityScore = () => {
    if (assessments.length === 0) return 50;
    
    // Calculate based on risk scores and interventions
    const avgRisk = assessments.reduce((sum, a) => sum + a.riskScore, 0) / assessments.length;
    const protectiveFactor = interventions.filter(i => i.implemented).length * 0.05; // 5% per implemented intervention
    const score = Math.max(0, Math.min(100, 100 - (avgRisk * 100) + (protectiveFactor * 100)));
    return Math.round(score);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Activity className="text-scientific-blue" size={32} /> Personal Genome Risk Dashboard
          </h1>
          <p className="text-slate-400 mt-2">
            Analyze your genetic variants against population databases for personalized risk assessment
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
            onClick={fetchRiskAssessments}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-bold transition-all"
          >
            <TrendingUp size={18} /> Analyze
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
          <AlertTriangle className="text-red-400" size={24} />
          <div>
            <h3 className="text-red-300 font-bold">Error</h3>
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      )}

      {assessments.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Longevity Score Card */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-white mb-2">Lifespan Optimization Score</h3>
              <div className="relative inline-block">
                <svg className="w-32 h-32" viewBox="0 0 100 100">
                  {/* Background circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="8"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke={calculateLongevityScore() > 70 ? "#10b981" : calculateLongevityScore() > 40 ? "#f59e0b" : "#ef4444"}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray="283" // Circumference = 2 * π * r (45) ≈ 283
                    strokeDashoffset={283 - (283 * calculateLongevityScore()) / 100}
                    transform="rotate(-90 50 50)"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                  <span className="text-3xl font-bold text-white">{calculateLongevityScore()}</span>
                  <span className="text-slate-400">/100</span>
                </div>
              </div>
              <p className="text-slate-400 mt-4">
                Based on your protective vs pathogenic variant burden
              </p>
            </div>
            
            <div className="mt-6 space-y-4">
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                  <Info size={16} /> Biological Age
                </h4>
                <p className="text-2xl font-bold text-scientific-blue">
                  {assessments[0]?.biologicalAge || 'N/A'} years
                </p>
                <p className="text-slate-400 text-sm">
                  {patientId ? `vs. chronological age of ${new Date().getFullYear() - new Date(assessments[0]?.createdAt).getFullYear()}` : ''}
                </p>
              </div>
              
              <button className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-3 rounded-lg font-bold transition-all">
                <Download size={18} /> Export Longevity Report
              </button>
            </div>
          </div>

          {/* Risk Assessments */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp size={20} /> Disease Risk Assessments
              </h3>
              
              <div className="space-y-4">
                {assessments.map(assessment => (
                  <div 
                    key={assessment.id}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedAssessment?.id === assessment.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800'
                    }`}
                    onClick={() => setSelectedAssessment(assessment)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h4 className="font-bold text-white flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${getRiskColor(assessment.riskCategory).replace('text-', 'bg-').replace(' bg-gray-500/10', ' bg-gray-500/20')}`}></span>
                          {assessment.diseaseType}
                          {assessment.variant && (
                            <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded font-mono">
                              {assessment.variant.gene} {assessment.variant.hgvs_c}
                            </span>
                          )}
                        </h4>
                        <p className="text-slate-400 text-sm">
                          Relative Risk: <span className="text-white">{assessment.relativeRisk.toFixed(2)}x</span> vs population
                        </p>
                      </div>
                      
                      <div className="flex flex-col items-end">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getRiskColor(assessment.riskCategory)}`}>
                          {getRiskLabel(assessment.severityLevel)}
                        </span>
                        <span className="text-slate-400 text-sm mt-1">
                          Risk Score: {(assessment.riskScore * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    
                    {/* Confidence interval */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span>Confidence: {assessment.confidenceIntervalLower.toFixed(2)} - {assessment.confidenceIntervalUpper.toFixed(2)}</span>
                        <span>Risk Trajectory:</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span>Current: {assessment.riskTrajectoryCurrent ? (assessment.riskTrajectoryCurrent * 100).toFixed(0) + '%' : 'N/A'}</span>
                        <span>5Y: {assessment.riskTrajectory5Year ? (assessment.riskTrajectory5Year * 100).toFixed(0) + '%' : 'N/A'}</span>
                        <span>10Y: {assessment.riskTrajectory10Year ? (assessment.riskTrajectory10Year * 100).toFixed(0) + '%' : 'N/A'}</span>
                        <span>Lifetime: {assessment.riskTrajectoryLifetime ? (assessment.riskTrajectoryLifetime * 100).toFixed(0) + '%' : 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Interventions for selected assessment */}
            {selectedAssessment && interventions.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <CheckCircle size={20} /> Actionable Interventions
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {interventions.map(intervention => (
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
                            {intervention.implemented ? (
                              <CheckCircle className="text-green-500" size={16} />
                            ) : intervention.recommended ? (
                              <AlertTriangle className="text-yellow-500" size={16} />
                            ) : (
                              <XCircle className="text-gray-500" size={16} />
                            )}
                            {intervention.interventionName}
                          </h4>
                          <p className="text-slate-400 text-sm mt-1">
                            Evidence: {intervention.evidenceLevel} | 
                            {intervention.expectedRiskReduction && ` Risk Reduction: ${intervention.expectedRiskReduction}%`}
                            {intervention.preventableYears && ` | Years: ${intervention.preventableYears}`}
                          </p>
                          {intervention.interventionDescription && (
                            <p className="text-slate-300 mt-2 text-sm">
                              {intervention.interventionDescription}
                            </p>
                          )}
                        </div>
                        
                        <span className="text-xs px-2 py-1 bg-slate-800 text-slate-300 rounded">
                          {intervention.interventionType}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {assessments.length === 0 && patientId && !loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <Activity className="text-slate-600 mx-auto mb-4" size={48} />
          <h3 className="text-xl font-bold text-white mb-2">No Risk Assessments Found</h3>
          <p className="text-slate-400 mb-6">
            No longevity risk assessments have been calculated for this patient yet.
          </p>
          <button className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-lg font-bold transition-all mx-auto">
            <Plus size={18} /> Calculate Risk Assessment
          </button>
        </div>
      )}
    </div>
  );
};

export default PersonalGenomeRiskDashboard;