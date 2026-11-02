import { LearningPage } from "@/features/learning/learning-page";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; moduleId: string }>;
}) {
  const { id, moduleId } = await params;
  return <LearningPage roadmapId={id} moduleId={moduleId} />;
}
