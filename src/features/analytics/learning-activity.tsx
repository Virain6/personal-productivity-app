"use client";
import dynamic from "next/dynamic";
import type { AnalyticsRoadmap } from "@/lib/analytics-types";
import { roadmapColor } from "@/lib/roadmap-colors";
import { ActivityHeatmap } from "./activity-heatmap";
import styles from "./activity.module.css";
const TimeChart = dynamic(() =>
  import("./time-chart").then((m) => m.TimeChart),
);
export function LearningActivity({ roadmap }: { roadmap: AnalyticsRoadmap }) {
  const { mastery } = roadmap;
  return (
    <div className={styles.learning}>
      <div className={styles.summary}>
        <span>
          <strong>
            {mastery.steps
              ? `${Math.round((mastery.completed / mastery.steps) * 100)}%`
              : "—"}
          </strong>{" "}
          current mastery
        </span>
        <span>
          <strong>
            {roadmap.consistency === null
              ? "—"
              : `${Math.round(roadmap.consistency)}%`}
          </strong>{" "}
          scheduled-day study consistency
        </span>
      </div>
      <progress
        className={styles.mastery}
        style={
          {
            accentColor: roadmapColor(roadmap.color),
            "--mastery-color": roadmapColor(roadmap.color),
          } as import("react").CSSProperties
        }
        aria-label={`${roadmap.title} current mastery`}
        value={mastery.completed}
        max={mastery.steps || 1}
      />
      <p className={styles.note}>
        {mastery.completed}/{mastery.steps} active-module steps completed.{" "}
        {roadmap.studiedScheduledDays}/{roadmap.eligibleDays} elapsed required
        study days have saved time. Today, future and unscheduled days are
        excluded from consistency; marking a task or step complete does not
        count as studied.
      </p>
      <div className={styles.columns}>
        <ActivityHeatmap
          key={roadmap.id}
          title={`${roadmap.title} study activity`}
          cells={roadmap.activity}
          learning
          accent={roadmapColor(roadmap.color)}
        />
        <div>
          <h3>Study time · selected roadmap</h3>
          <TimeChart
            rows={roadmap.dailyTime}
            color={roadmapColor(roadmap.color)}
          />
          <p className={styles.note}>
            Actual saved time, split by local date. Study on an unscheduled day
            is still shown; skipped scheduled days remain eligible.
          </p>
        </div>
      </div>
    </div>
  );
}
