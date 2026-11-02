export const learningCategories = [
  "Fundamentals",
  "Databases",
  "System/Backend",
  "Testing/DevOps",
  "Specialization",
] as const;
export const learningNames: Record<LearningCategory, string> = {
  Fundamentals: "Computer Science Fundamentals",
  Databases: "Databases & SQL",
  "System/Backend": "System Design & Backend Engineering",
  "Testing/DevOps": "Testing, Debugging & DevOps",
  Specialization: "Specialization",
};
export type LearningCategory = string;
export const stepStatuses = [
  "not_started",
  "in_progress",
  "needs_review",
  "completed",
] as const;
export type StepStatus = (typeof stepStatuses)[number];
export const stepStatusNames: Record<StepStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  needs_review: "Needs review",
  completed: "Completed",
};
export function categoryName(category: string) {
  return Object.hasOwn(learningNames, category)
    ? learningNames[category]
    : category;
}
export type LearningStep = {
  description: string;
  objective: string;
  status: StepStatus;
  id: string;
  title: string;
  resourceUrl: string;
  completed: boolean;
  position: number;
};
export type LearningSection = {
  archived: boolean;
  description: string;
  objective: string;
  resourceUrl: string;
  id: string;
  title: string;
  position: number;
  steps: LearningStep[];
};
export type Roadmap = {
  color: string;
  description: string;
  goal: string;
  targetDate: string | null;
  id: string;
  category: LearningCategory;
  title: string;
  version: number;
  archived: boolean;
  currentStepId: string | null;
  sections: LearningSection[];
};
export type LearningData = {
  roadmaps: Roadmap[];
  studyHistory: StudyHistory[];
  timezone: string;
  categories: {
    category: LearningCategory;
    trackedMs: number;
    lastStudied: string | null;
  }[];
};
export function roadmapProgress(sections: LearningSection[]) {
  const steps = sections.filter((s) => !s.archived).flatMap((s) => s.steps);
  const completed = steps.filter((s) => s.completed).length;
  return {
    completed,
    total: steps.length,
    percent: steps.length ? (completed / steps.length) * 100 : 0,
    next: steps.find((s) => !s.completed) ?? null,
  };
}

export type StudyTopic = {
  sectionId: string;
  stepId: string;
  roadmapId: string;
  roadmapTitle: string;
  sectionTitle: string;
  stepTitle: string;
  category: LearningCategory;
  available: boolean;
};
export type StudyLink = {
  color?: string;
  sectionId?: string | null;
  stepId: string | null;
  roadmapId: string | null;
  roadmapTitle: string;
  sectionTitle: string;
  stepTitle: string;
  version: number;
};
export type StudyHistory = StudyLink & {
  sessionId: string;
  startedAt: number;
  endedAt: number | null;
  summary: string;
};

export function stepStudyTime(history: StudyHistory[], stepId: string) {
  return history.reduce(
    (total, s) =>
      total +
      (s.stepId === stepId && s.endedAt !== null ? s.endedAt - s.startedAt : 0),
    0,
  );
}

export function filterRoadmaps(
  maps: Roadmap[],
  query: string,
  category: string,
) {
  const needle = query.trim().toLocaleLowerCase();
  return maps.filter(
    (m) =>
      !m.archived &&
      (!category || m.category === category) &&
      `${m.title} ${m.description} ${categoryName(m.category)}`
        .toLocaleLowerCase()
        .includes(needle),
  );
}
export function learningSummary(data: LearningData) {
  const active = data.roadmaps.filter((m) => !m.archived);
  return {
    active: active.length,
    completed: active.reduce(
      (n, m) => n + roadmapProgress(m.sections).completed,
      0,
    ),
    studiedMs: data.studyHistory.reduce(
      (n, s) => n + (s.endedAt === null ? 0 : s.endedAt - s.startedAt),
      0,
    ),
  };
}
