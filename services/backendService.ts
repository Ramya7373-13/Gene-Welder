/**
 * Central API client for all backend calls
 */
const API_BASE = (import.meta as any).env.VITE_BACKEND_URL || 'http://localhost:5000';

export interface Patient {
    id: string;
    patientId: string;
    name?: string;
    createdAt: string;
}

export interface Variant {
    id: string;
    patientId: string;
    gene: string;
    hgvs_c: string;
    hgvs_p?: string;
    genomic_coords?: string;
    ref_allele: string;
    alt_allele: string;
    zygosity: string;
    gnomad_freq?: number;
    clinvar_path?: boolean;
    acmg_class?: string;
    annotations?: any;
}

export const backendService = {
    // Patients
    async getPatients(): Promise<Patient[]> {
        const res = await fetch(`${API_BASE}/api/patients`);
        if (!res.ok) throw new Error('Failed to fetch patients');
        return res.json();
    },

    async createPatient(patient: { patientId: string, name?: string }): Promise<Patient> {
        const res = await fetch(`${API_BASE}/api/patients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patient)
        });
        // Note: We need a POST /api/patients if it doesn't exist, 
        // but currently /api/variants auto-creates patients.
        // Let's implement a standalone POST /api/patients for completeness if needed.
        // For now, we'll use the existing /api/variants logic or add the endpoint.
        return res.json();
    },

    // Variants
    async getVariants(patientId?: string): Promise<Variant[]> {
        const url = patientId
            ? `${API_BASE}/api/variants?patientId=${encodeURIComponent(patientId)}`
            : `${API_BASE}/api/variants`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch variants');
        return res.json();
    },

    async createVariant(variant: any): Promise<Variant> {
        const res = await fetch(`${API_BASE}/api/variants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(variant)
        });
        if (!res.ok) throw new Error('Failed to create variant');
        return res.json();
    },

    // Predictions
    async logPrediction(prediction: any) {
        const res = await fetch(`${API_BASE}/api/predictions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prediction)
        });
        if (!res.ok) throw new Error('Failed to log prediction');
        return res.json();
    },

    // History (existing + new)
    async getHistory(userId?: string) {
        const url = userId
            ? `${API_BASE}/api/analyses?userId=${encodeURIComponent(userId)}`
            : `${API_BASE}/api/analyses`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch history');
        return res.json();
    },

    // Structure uploads
    async uploadStructure(file: File, variantId: string, fileType: string = 'pdb') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('variantId', variantId);
        formData.append('file_type', fileType);

        const res = await fetch(`${API_BASE}/api/structures`, {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error('Failed to upload structure');
        return res.json();
    },

    // Audits
    async getAudits(limit = 10) {
        const res = await fetch(`${API_BASE}/api/audits?limit=${limit}`);
        return res.json();
    },

    async getAuditStats() {
        const res = await fetch(`${API_BASE}/api/audits/stats`);
        return res.json();
    },

    async fetchStructureFile(localPath: string): Promise<string | null> {
        try {
            const res = await fetch(`${API_BASE}/api/structures/file?path=${encodeURIComponent(localPath)}`);
            if (res.ok) {
                return await res.text();
            }
        } catch (e) {
            console.warn('Failed to fetch structure file:', e);
        }
        return null;
    },

    getBaseUrl() {
        return API_BASE;
    }
};
