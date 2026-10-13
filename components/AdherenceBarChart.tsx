"use client";

// One horizontal bar per medicine: % of doses taken. Single series, one colour (teal),
// value labels at the bar end, hover tooltip with the counts behind each percentage.

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type BarDatum = { name: string; pct: number; detail: string };

// Short axis label: the main name without the part in brackets, e.g. "Metformin".
export function chartLabel(name: string): string {
  const main = name.split(" (")[0].trim();
  return main.length > 18 ? `${main.slice(0, 17)}…` : main;
}

const BAR_COLOR = "#0f766e"; // teal-700
const INK = "#334155"; // slate-700 for axis text

export default function AdherenceBarChart({ data, ariaLabel }: { data: BarDatum[]; ariaLabel: string }) {
  const height = 40 + data.length * 52;
  return (
    <div role="img" aria-label={ariaLabel} style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 48, bottom: 8, left: 8 }} barCategoryGap={14}>
          <CartesianGrid horizontal={false} stroke="#e2e8f0" />
          <XAxis
            type="number"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: INK, fontSize: 13 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tick={{ fill: INK, fontSize: 14 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            formatter={(_value, _name, item) => [(item.payload as BarDatum).detail, ""]}
            separator=""
          />
          <Bar dataKey="pct" fill={BAR_COLOR} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey="pct" position="right" formatter={(v) => `${v}%`} fill="#0f172a" fontSize={14} fontWeight={600} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
