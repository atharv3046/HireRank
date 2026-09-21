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
      const url = error.config?.url || '';
      const isAuthOrGuest = url.includes('/auth/login') ||
                            url.includes('/auth/signup') ||
                            url.includes('/auth/google') ||
                            url.includes('/guest/');
      if (!isAuthOrGuest) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export interface User { id: number; email: string; role: string; company_name?: string | null; }
export interface JobPosting { id: number; title: string; description: string; required_skills: string[]; min_experience_years: number; education_requirement: string | null; status: string; created_at: string; candidate_count: number; }
export interface CandidateWithScore {
  id: number;
  job_posting_id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  extracted_skills: string[];
  experience_years: number | null;
  education_level: string | null;
  education_details: string | null;
  detected_title?: string | null;
  needs_manual_review?: boolean;
  processing_status: string;
  error_message?: string | null;
  overall_score: number | null;
  semantic_score: number | null;
  skills_score: number | null;
  experience_score: number | null;
  title_score?: number | null;
  education_score: number | null;
  tier?: 'Strong' | 'Potential' | 'Low' | 'Needs Review' | string;
  is_capped?: boolean;
  cap_reason?: string | null;
  matched_skills: string[];
  missing_skills: string[];
  matched_preferred_skills?: string[];
  missing_preferred_skills?: string[];
  summary: string | null;
  explanation_json?: Record<string, any> | null;
  job_title?: string;
  pipeline_status?: 'Screened' | 'Invited' | 'Hire' | 'No Hire' | string;
  created_at: string;
}

export interface DashboardSummary {
  total_batches: number;
  total_candidates: number;
  total_strong: number;
  total_potential: number;
  total_low: number;
  total_needs_review?: number;
  overall_average_score: number | null;
  quota_used: number;
  quota_limit: number;
  tier_distribution?: {
    Strong: number;
    Potential: number;
    Low: number;
    'Needs Review': number;
  };
  efficiency_pct?: number;
  velocity?: { date: string; count: number }[];
  velocity_hourly?: { hour: string; count: number }[];
}

export interface JobStats {
  job_id: number;
  total_processed: number;
  strong_count: number;
  potential_count: number;
  low_count: number;
  needs_review_count?: number;
  average_score: number | null;
  top_score: number | null;
  tier_distribution?: {
    Strong: number;
    Potential: number;
    Low: number;
    'Needs Review': number;
  };
}

export const api = {
  signup: async (email: string, password: string, company_name?: string) => {
    const res = await client.post('/auth/signup', { email, password, company_name });
    return res.data;
  },
  login: async (email: string, password: string) => {
    const res = await client.post('/auth/login', { email, password });
    return res.data;
  },
  googleSignin: async (credential: string, company_name?: string) => {
    const res = await client.post('/auth/google', { credential, company_name });
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
  },
  getDashboardSummary: async (): Promise<DashboardSummary> => {
    const res = await client.get('/dashboard/summary');
    return res.data;
  },
  getJobStats: async (jobId: string | number): Promise<JobStats> => {
    const res = await client.get(`/jobs/${jobId}/stats`);
    return res.data;
  },
  exportJobCsv: async (jobId: string | number): Promise<Blob> => {
    const res = await client.get(`/jobs/${jobId}/export`, { responseType: 'blob' });
    return res.data;
  },
  getCandidates: async (params?: { search?: string; tier?: string; skill?: string; job_id?: number; pipeline_status?: string; sort_by?: string }): Promise<CandidateWithScore[]> => {
    const res = await client.get('/candidates', { params });
    return res.data;
  },
  updateCandidatePipelineStatus: async (candidateId: number, pipelineStatus: string): Promise<{ id: number; pipeline_status: string; message: string }> => {
    const res = await client.patch(`/candidates/${candidateId}/pipeline-status`, { pipeline_status: pipelineStatus });
    return res.data;
  },
  exportCandidatesCsv: async (candidateIds?: number[]): Promise<Blob> => {
    const res = await client.post('/candidates/export', candidateIds || null, { responseType: 'blob' });
    return res.data;
  },
  bulkInviteCandidates: async (candidateIds: number[], message?: string): Promise<{ success: boolean; invited_count: number; message: string }> => {
    const res = await client.post('/candidates/bulk-invite', { candidate_ids: candidateIds, message });
    return res.data;
  },
  deleteCandidate: async (candidateId: number): Promise<{ message: string; candidate_id: number }> => {
    const res = await client.delete(`/candidates/${candidateId}`);
    return res.data;
  },
  deleteCandidatesBulk: async (candidateIds: number[]): Promise<{ message: string; deleted_ids: number[] }> => {
    const res = await client.post('/candidates/bulk-delete', { candidate_ids: candidateIds });
    return res.data;
  },
  getCompanyProfile: async (): Promise<CompanyProfile> => {
    const res = await client.get('/settings/profile');
    return res.data;
  },
  updateCompanyProfile: async (data: { workspace_name: string; domain?: string; admin_email?: string }): Promise<CompanyProfile> => {
    const res = await client.put('/settings/profile', data);
    return res.data;
  },
  getTeam: async (): Promise<TeamResponse> => {
    const res = await client.get('/settings/team');
    return res.data;
  },
  inviteTeamMember: async (data: { email: string; role: string; name?: string }): Promise<TeamMember> => {
    const res = await client.post('/settings/team/invite', data);
    return res.data;
  },
  getMemberInviteLink: async (memberId: number): Promise<{ invite_token: string; invite_url: string; email: string; name?: string; role: string }> => {
    const res = await client.get(`/settings/team/members/${memberId}/invite-link`);
    return res.data;
  },
  verifyInviteToken: async (token: string): Promise<{ valid: boolean; email: string; name?: string; role: string; workspace_name: string; inviter_email?: string }> => {
    const res = await client.get('/settings/team/invite/verify', { params: { token } });
    return res.data;
  },
  acceptTeamInvite: async (data: { token: string; password: string; name?: string }): Promise<{ access_token: string; user_id: number; email: string; role: string; workspace_name: string; message: string }> => {
    const res = await client.post('/settings/team/invite/accept', data);
    return res.data;
  },
  removeTeamMember: async (memberId: number): Promise<{ success: boolean; message: string }> => {
    const res = await client.delete(`/settings/team/members/${memberId}`);
    return res.data;
  },
  updateTeamMember: async (memberId: number, data: { role?: string; status?: string }): Promise<TeamMember> => {
    const res = await client.patch(`/settings/team/members/${memberId}`, data);
    return res.data;
  },
  getBilling: async (): Promise<BillingResponse> => {
    const res = await client.get('/settings/billing');
    return res.data;
  },
  getImportableBatches: async (): Promise<ScreeningBatchOption[]> => {
    const res = await client.get('/assessments/batches');
    return res.data;
  },
  extractBlueprint: async (data: { job_description: string; batch_id?: number }): Promise<ExtractedBlueprintResponse> => {
    const res = await client.post('/assessments/extract-blueprint', data);
    return res.data;
  },
  simulatePassRate: async (data: { required_skills: string[]; min_experience_years: number; batch_id?: number }): Promise<PassRatePreview> => {
    const res = await client.post('/assessments/simulate-pass-rate', data);
    return res.data;
  },
  createAssessment: async (data: { title: string; job_description: string; required_skills: string[]; min_experience_years: number; education_requirement?: string; blueprint: Record<string, any> }): Promise<AssessmentRead> => {
    const res = await client.post('/assessments', data);
    return res.data;
  },
  getAssessments: async (): Promise<AssessmentRead[]> => {
    const res = await client.get('/assessments');
    return res.data;
  }
};

export interface CompanyProfile {
  workspace_name: string;
  admin_email: string;
  domain: string;
  org_id: string;
  role: string;
}

export interface TeamMember {
  id: number;
  name: string | null;
  email: string;
  role: string;
  status: string;
  is_primary: boolean;
  created_at: string;
  invite_token?: string | null;
  invite_url?: string | null;
  email_sent?: boolean;
  email_error?: string | null;
}

export interface TeamResponse {
  seat_usage: {
    used: number;
    total: number;
    percentage: number;
  };
  members: TeamMember[];
}

export interface BillingPlan {
  name: string;
  price: string;
  period: string;
  badge?: string;
  screenings: string;
  evaluations: string;
  seats: string;
  features: string[];
  is_current: boolean;
}

export interface BillingResponse {
  current_plan: string;
  billing_cycle: string;
  renewal_date: string;
  usage: {
    screenings: { used: number; limit: number; percentage: number };
    evaluations: { used: number; limit: number; percentage: number };
    team_seats: { used: number; limit: number; percentage: number };
  };
  plans: BillingPlan[];
}

export interface ScreeningBatchOption {
  id: number;
  title: string;
  description: string;
  required_skills: string[];
  candidate_count: number;
}

export interface QuestionCategory {
  category: string;
  count: number;
  percentage: number;
  topics: string[];
}

export interface BlueprintData {
  estimated_duration_minutes: number;
  difficulty_level: string;
  categories: QuestionCategory[];
}

export interface PassRatePreview {
  total_evaluated: number;
  passed_count: number;
  pass_rate_pct: number;
  summary: string;
}

export interface ExtractedBlueprintResponse {
  detected_title: string;
  min_experience_years: number;
  education_requirement: string;
  required_skills: string[];
  blueprint: BlueprintData;
  pass_preview: PassRatePreview;
}

export interface AssessmentRead {
  id: number;
  recruiter_id: number;
  title: string;
  job_description: string;
  required_skills: string[];
  min_experience_years: number;
  education_requirement?: string | null;
  blueprint_json: BlueprintData | Record<string, any>;
  status: string;
  created_at: string;
}

