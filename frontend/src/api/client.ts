import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Only redirect if token is actually missing/expired — not on network glitches
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
      } else {
        // Token present but rejected — clear and redirect
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export interface User { id: number; email: string; role: string; }
export interface JobPosting { id: number; title: string; description: string; required_skills: string[]; min_experience_years: number; education_requirement: string | null; status: string; created_at: string; candidate_count: number; }
export interface CandidateWithScore { id: number; name: string | null; email: string | null; phone: string | null; extracted_skills: string[]; experience_years: number | null; education_level: string | null; education_details: string | null; processing_status: string; overall_score: number | null; semantic_score: number | null; skills_score: number | null; experience_score: number | null; education_score: number | null; matched_skills: string[]; missing_skills: string[]; summary: string | null; created_at: string; }

export const api = {
  signup: async (email: string, password: string, company_name?: string) => {
    const res = await client.post('/auth/signup', { email, password, company_name });
    return res.data;
  },
  login: async (email: string, password: string) => {
    const res = await client.post('/auth/login', { email, password });
    return res.data;
  },
  demoLogin: async () => {
    const res = await client.post('/auth/demo-login');
    return res.data;
  },
  getJobs: async () => {
    const res = await client.get('/jobs/');
    return res.data;
  },
  createJob: async (data: Partial<JobPosting>) => {
    const res = await client.post('/jobs/', data);
    return res.data;
  },
  getJob: async (id: string | number) => {
    const res = await client.get(`/jobs/${id}`);
    return res.data;
  },
  updateJob: async (id: string | number, data: Partial<JobPosting>) => {
    const res = await client.put(`/jobs/${id}`, data);
    return res.data;
  },
  deleteJob: async (id: string | number) => {
    const res = await client.delete(`/jobs/${id}`);
    return res.data;
  },
  uploadResume: async (jobId: string | number, file: File, onUploadProgress?: (progressEvent: any) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await client.post(`/jobs/${jobId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress
    });
    return res.data;
  },
  getCandidateStatus: async (candidateId: string | number) => {
    const res = await client.get(`/candidates/${candidateId}/status`);
    return res.data;
  },
  getRankedCandidates: async (jobId: string | number, sort_by?: string, min_score?: number, min_experience?: number) => {
    const params: any = {};
    if (sort_by) params.sort_by = sort_by;
    if (min_score !== undefined && min_score !== null) params.min_score = min_score;
    if (min_experience !== undefined && min_experience !== null) params.min_experience = min_experience;
    
    const res = await client.get(`/jobs/${jobId}/candidates`, { params });
    return res.data;
  },
  rerankAll: async (jobId: string | number) => {
    const res = await client.post(`/jobs/${jobId}/rerank-all`);
    return res.data;
  },
  triggerExtraction: async (candidateId: string | number) => {
    const res = await client.post(`/candidates/${candidateId}/extract`);
    return res.data;
  },
  triggerEmbed: async (candidateId: string | number) => {
    const res = await client.post(`/candidates/${candidateId}/embed`);
    return res.data;
  },
  scoreCandidate: async (jobId: string | number, candidateId: string | number) => {
    const res = await client.post(`/jobs/${jobId}/score-candidate/${candidateId}`);
    return res.data;
  }
};
