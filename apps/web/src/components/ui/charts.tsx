"use client";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

const GOLD = "#d4af5f";
const GOLD_SOFT = "rgba(212, 175, 95, 0.18)";
const TEXT_MUTED = "#94a3b8";

const tooltipStyle = {
  background: "rgba(255, 255, 255, 0.97)",
  border: "1px solid rgba(15, 23, 42, 0.08)",
  borderRadius: 12,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
  fontSize: 12,
  padding: "8px 12px",
  color: "#0f172a",
} as const;

export function LeadsAreaChart({ data }: { data: Array<{ day: string; leads: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="leadsGold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity={0.4} />
            <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GOLD_SOFT} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="day" tick={{ fill: TEXT_MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: TEXT_MUTED, fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="leads" stroke={GOLD} strokeWidth={2} fill="url(#leadsGold)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function IntentBarChart({ data }: { data: Array<{ intent: string; count: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={GOLD_SOFT} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="intent" tick={{ fill: TEXT_MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: TEXT_MUTED, fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: GOLD_SOFT }} />
        <Bar dataKey="count" fill={GOLD} radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const PIE_COLORS = ["#d4af5f", "#b8923f", "#4c79b0", "#14a075", "#d04a4a"];

export function LanguagePieChart({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={80} paddingAngle={3}>
          {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12, color: TEXT_MUTED }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
