"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DateTime } from "luxon";
import { clockDuration } from "@/lib/dates";
import styles from "./analytics.module.css";
export function TimeChart({
  rows,
  planned = false,
  weekly = false,
  color = "var(--accent-hover)",
}: {
  rows: { date: string; studyMs: number; plannedMs?: number }[];
  planned?: boolean;
  weekly?: boolean;
  color?: string;
}) {
  const data = rows.map((row) => ({
    ...row,
    actual: row.studyMs / 3600000,
    planned: (row.plannedMs ?? 0) / 3600000,
  }));
  return (
    <>
      <div
        className={styles.chart}
        role="group"
        aria-label={
          weekly ? "Weekly recorded study hours" : "Daily study hours"
        }
      >
        <ResponsiveContainer
          width="100%"
          height={240}
          minWidth={0}
          initialDimension={{ width: 600, height: 240 }}
        >
          <BarChart
            data={data}
            margin={{ top: 16, right: 8, left: -15, bottom: 0 }}
            accessibilityLayer
          >
            <CartesianGrid
              stroke="var(--border)"
              vertical={false}
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              minTickGap={15}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickFormatter={(value) =>
                DateTime.fromISO(String(value), { zone: "UTC" }).toFormat(
                  !weekly && rows.length === 7 ? "ccc" : "MMM d",
                )
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              domain={[0, (max: number) => Math.max(1, Math.ceil(max))]}
              allowDecimals={false}
              tickFormatter={(value) => `${value}h`}
            />
            <Tooltip
              cursor={{ fill: "var(--elevated)" }}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--foreground)", marginBottom: 6 }}
              labelFormatter={(value) => `${weekly ? "Week of " : ""}${value}`}
              formatter={(value) => clockDuration(Number(value) * 3600000)}
            />
            {planned && (
              <Bar
                dataKey="planned"
                name="Planned"
                fill="#606271"
                radius={[3, 3, 0, 0]}
                maxBarSize={22}
                isAnimationActive={false}
              />
            )}
            <Bar
              dataKey="actual"
              name="Recorded study"
              fill={color}
              radius={[3, 3, 0, 0]}
              maxBarSize={planned ? 22 : 36}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className={styles.values}>
        <summary>View exact values</summary>
        <div className={styles.tableWrap}>
          <table>
            <caption className="sr-only">
              {weekly ? "Weekly" : "Daily"} study durations in hours, minutes
              and seconds
            </caption>
            <thead>
              <tr>
                <th scope="col">{weekly ? "Week starting" : "Date"}</th>
                {planned && <th scope="col">Planned</th>}
                <th scope="col">Recorded</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.date}>
                  <th scope="row">{row.date}</th>
                  {planned && <td>{clockDuration(row.plannedMs ?? 0)}</td>}
                  <td>{clockDuration(row.studyMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
