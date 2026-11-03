"use client";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HabitAnalytics } from "@/lib/activity-analytics";
import styles from "./activity.module.css";
export function QuantityChart({
  series,
}: {
  series: HabitAnalytics["quantities"][number];
}) {
  return (
    <div>
      <p className={styles.note}>
        {series.total.toLocaleString()} {series.unit} total ·{" "}
        {series.average.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
        average per logged day. Missing entries remain gaps.
      </p>
      <div className={styles.quantityChart}>
        <ResponsiveContainer
          width="100%"
          height={210}
          minWidth={0}
          initialDimension={{ width: 450, height: 210 }}
        >
          <LineChart
            data={series.days}
            margin={{ left: -15, right: 15, top: 15 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => String(d).slice(5)}
              minTickGap={25}
              tick={{ fill: "var(--muted)", fontSize: 10 }}
            />
            <YAxis
              domain={[0, "auto"]}
              tick={{ fill: "var(--muted)", fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}
              formatter={(v) => `${v} ${series.unit}`}
            />
            <Line
              dataKey="value"
              name="Recorded"
              stroke="var(--accent-hover)"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="target"
              name="Goal / limit"
              stroke="var(--warning)"
              strokeDasharray="4 4"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className={styles.note}>
        Purple: recorded quantity · Amber: that day’s goal or limit. Lower is
        better for Limit and Avoid; awareness-only entries have no goal line.
      </p>
      <details className={styles.values}>
        <summary>Quantity values · {series.unit}</summary>
        <div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Recorded</th>
                <th>Goal / limit</th>
              </tr>
            </thead>
            <tbody>
              {series.days.map((d) => (
                <tr key={d.date}>
                  <th scope="row">{d.date}</th>
                  <td>{d.value ?? "Not logged"}</td>
                  <td>{d.target ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
