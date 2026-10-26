import { notFound } from "next/navigation";
import { Sprout } from "lucide-react";
const sections: Record<string, string> = {
  learning: "Learning",
  projects: "Projects",
  jobs: "Jobs",
  habits: "Habits",
  settings: "Settings",
};
export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections[section]) notFound();
  return (
    <>
      <h1 className="text-2xl font-semibold">{sections[section]}</h1>
      <div className="mt-8 flex max-w-lg items-start gap-4 rounded-xl border border-border bg-surface p-6">
        <Sprout className="shrink-0 text-accent-hover" />
        <div>
          <h2 className="font-medium">A little more to come</h2>
          <p className="mt-2 leading-relaxed text-muted">
            {sections[section]} is planned for a later sprint and is not
            implemented yet. Your daily planning starts on Home.
          </p>
        </div>
      </div>
    </>
  );
}
