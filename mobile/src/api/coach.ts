import { client } from './client';

export const fetchLatestMessage = async () => {
    const res = await client.get('/students/me/messages/latest');
    return res.data;
};

// --- Plan Types ---

export interface PlanTask {
    id: number;
    task_type: string;
    target_minutes: number;
    status: string;
    date: string;
    subject: string | null;
    topic_name: string | null;
    phase: string | null;
    subject_block_order: number | null;
}

export interface DailyPlan {
    date: string;
    tasks: PlanTask[];
}

export interface PlanOverview {
    id: number;
    start_date: string;
    end_date: string;
    version: number;
    status: string;
    total_tasks: number;
    completed_tasks: number;
    tur_number: number | null;
}

export interface SubjectBlock {
    subject: string;
    order: number;
    start_date: string;
    end_date: string;
    reading_days: number;
    question_days: number;
    phase: string; // "completed" | "active" | "pending"
}

export interface PlanStructure {
    id: number;
    tur_number: number;
    start_date: string;
    end_date: string;
    blocks: SubjectBlock[];
    current_block_index: number | null;
}

// --- Plan Mutation Types ---

export interface UpdateTaskData {
    target_minutes?: number;
    task_type?: string;
    date?: string;
}

export interface CreateTaskData {
    date: string;
    task_type: string;
    target_minutes: number;
}

export interface UpdateBlockDaysData {
    reading_days: number;
    question_days: number;
}

// --- Plan API ---

export const fetchDailyPlan = async (date?: string): Promise<DailyPlan> => {
    const res = await client.get('/students/me/plan', { params: { date } });
    return res.data;
};

export const fetchPlanOverview = async (): Promise<PlanOverview | null> => {
    const res = await client.get('/students/me/plan/overview');
    return res.data;
};

export interface BlockConfigItem {
    subject: string;
    order: number;
    reading_days: number;
    question_days: number;
}

export const generatePlan = async (
    turNumber: number = 1,
    customBlockConfig?: BlockConfigItem[],
): Promise<PlanOverview> => {
    const body: Record<string, any> = { tur_number: turNumber };
    if (customBlockConfig && customBlockConfig.length > 0) {
        body.custom_block_config = customBlockConfig;
    }
    const res = await client.post('/students/me/plan/generate', body);
    return res.data;
};

export const fetchPlanStructure = async (): Promise<PlanStructure | null> => {
    const res = await client.get('/students/me/plan/structure');
    return res.data;
};

export const completeTask = async (taskId: number) => {
    const res = await client.post(`/plan_tasks/${taskId}/complete`);
    return res.data;
};

export const updatePlanTask = async (taskId: number, data: UpdateTaskData) => {
    const res = await client.put(`/plan_tasks/${taskId}`, data);
    return res.data;
};

export const createPlanTask = async (data: CreateTaskData) => {
    const res = await client.post('/plan_tasks', data);
    return res.data;
};

export const deletePlanTask = async (taskId: number) => {
    const res = await client.delete(`/plan_tasks/${taskId}`);
    return res.data;
};

export const reorderPlanBlocks = async (order: string[]) => {
    const res = await client.put('/students/me/plan/blocks/reorder', { order });
    return res.data;
};

export const updateBlockDays = async (subject: string, data: UpdateBlockDaysData) => {
    const res = await client.put(`/students/me/plan/blocks/${encodeURIComponent(subject)}`, data);
    return res.data;
};

export interface CreateSessionData {
    date: string; // ISO date string (YYYY-MM-DD)
    minutes: number;
    subject?: string;
    topic_id?: number;
    notes?: string;
}

export const createSession = async (data: CreateSessionData) => {
    const res = await client.post('/sessions/', data);
    return res.data;
};

export interface DailyMinutes {
    date: string;
    minutes: number;
}

export interface StatsData {
    range: string;
    daily_minutes: DailyMinutes[];
    total_minutes: number;
    streak_days: number;
}

export const fetchStats = async (range: string = '7d'): Promise<StatsData> => {
    const res = await client.get('/students/me/stats', { params: { range } });
    return res.data;
};

export interface CoachMessage {
    id: number;
    workflow_run_id: number;
    workflow_name: string;
    created_at: string;
    subject: string;
    body: string;
    tone?: string;
    read_at?: string;
}

export const fetchMessagesHistory = async (limit: number = 20): Promise<CoachMessage[]> => {
    const res = await client.get('/students/me/messages', { params: { limit } });
    return res.data;
};

export const fetchMessageById = async (messageId: number): Promise<CoachMessage> => {
    const res = await client.get(`/students/me/messages/${messageId}`);
    return res.data;
};

export const fetchMessageByWorkflowRun = async (workflowRunId: number): Promise<CoachMessage> => {
    const res = await client.get(`/students/me/messages/by-workflow-run/${workflowRunId}`);
    return res.data;
};

export const markMessageRead = async (messageId: number): Promise<CoachMessage> => {
    const res = await client.post(`/students/me/messages/${messageId}/read`);
    return res.data;
};

export const fetchUnreadCount = async (): Promise<{ unread_count: number }> => {
    const res = await client.get('/students/me/messages/unread_count');
    return res.data;
};

// --- Preferences & Onboarding ---

export interface OnboardingStatus {
    exam_date_set: boolean;
    daily_target_set: boolean;
}

export interface StudentPreferences {
    id: number;
    student_id: number;
    exam_date: string | null;
    daily_target_minutes_weekday: number | null;
    daily_target_minutes_weekend: number | null;
    preferred_study_window_start: string | null;
    preferred_study_window_end: string | null;
    quiet_hours_start: string | null;
    quiet_hours_end: string | null;
    timezone: string;
    created_at: string;
    updated_at: string | null;
}

export interface StudentPreferencesUpdate {
    exam_date?: string;
    daily_target_minutes_weekday?: number;
    daily_target_minutes_weekend?: number;
    preferred_study_window_start?: string;
    preferred_study_window_end?: string;
    quiet_hours_start?: string;
    quiet_hours_end?: string;
    timezone?: string;
}

export const fetchOnboardingStatus = async (): Promise<OnboardingStatus> => {
    const res = await client.get('/students/me/onboarding_status');
    return res.data;
};

export const fetchPreferences = async (): Promise<StudentPreferences> => {
    const res = await client.get('/students/me/preferences');
    return res.data;
};

export const updatePreferences = async (data: StudentPreferencesUpdate): Promise<StudentPreferences> => {
    const res = await client.put('/students/me/preferences', data);
    return res.data;
};

// --- Analytics ---

export interface StatsSummary {
    today_minutes: number;
    today_target_minutes: number | null;
    week_minutes: number;
    week_target_minutes: number | null;
    streak_days: number;
    last_session_date: string | null;
    exam_countdown_days: number | null;
}

export interface WeeklyBucket {
    week_start: string;
    minutes: number;
    target_minutes: number | null;
}

export interface DailyBucket {
    date: string;
    minutes: number;
    target_minutes: number | null;
}

export const fetchStatsSummary = async (): Promise<StatsSummary> => {
    const res = await client.get('/students/me/stats/summary');
    return res.data;
};

export const fetchWeeklyStats = async (weeks: number = 8): Promise<WeeklyBucket[]> => {
    const res = await client.get('/students/me/stats/weekly', { params: { weeks } });
    return res.data;
};

export const fetchDailyStats = async (days: number = 14): Promise<DailyBucket[]> => {
    const res = await client.get('/students/me/stats/daily', { params: { days } });
    return res.data;
};
