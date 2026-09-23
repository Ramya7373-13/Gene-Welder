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
        const res = await fetch(`${API_BASE}/api/patients`, { credentials: 'include' });
        if (res.status === 401) {
            const body = await res.json().catch(() => ({}));
            throw Object.assign(new Error(body.error || 'Not authenticated'), { status: 401 });
        }
        if (!res.ok) throw new Error('Failed to fetch patients');
        return res.json();
    },

    async createPatient(patient: { patientId: string, name?: string }): Promise<Patient> {
        const res = await fetch(`${API_BASE}/api/patients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(patient)
        });
        return res.json();
    },

    // Variants
    async getVariants(patientId?: string): Promise<Variant[]> {
        const url = patientId
            ? `${API_BASE}/api/variants?patientId=${encodeURIComponent(patientId)}`
            : `${API_BASE}/api/variants`;
        const res = await fetch(url, { credentials: 'include' });
        if (res.status === 401) {
            const body = await res.json().catch(() => ({}));
            throw Object.assign(new Error(body.error || 'Not authenticated'), { status: 401 });
        }
        if (!res.ok) throw new Error('Failed to fetch variants');
        return res.json();
    },

    async createVariant(variant: any): Promise<Variant> {
        const res = await fetch(`${API_BASE}/api/variants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
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
            credentials: 'include',
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
        const res = await fetch(url, { credentials: 'include' });
        if (res.status === 401) {
            const body = await res.json().catch(() => ({}));
            throw Object.assign(new Error(body.error || 'Not authenticated'), { status: 401 });
        }
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
            credentials: 'include',
            body: formData
        });
        if (!res.ok) throw new Error('Failed to upload structure');
        return res.json();
    },

    // Audits
    async getAudits(limit = 10) {
        const res = await fetch(`${API_BASE}/api/audits?limit=${limit}`, { credentials: 'include' });
        if (res.status === 401) {
            const body = await res.json().catch(() => ({}));
            throw Object.assign(new Error(body.error || 'Not authenticated'), { status: 401 });
        }
        return res.json();
    },

    async getAuditStats() {
        const res = await fetch(`${API_BASE}/api/audits/stats`, { credentials: 'include' });
        if (res.status === 401) {
            const body = await res.json().catch(() => ({}));
            throw Object.assign(new Error(body.error || 'Not authenticated'), { status: 401 });
        }
        return res.json();
    },

    async fetchStructureFile(localPath: string): Promise<string | null> {
        try {
            const res = await fetch(`${API_BASE}/api/structures/file?path=${encodeURIComponent(localPath)}`, {
                credentials: 'include'
            });
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
