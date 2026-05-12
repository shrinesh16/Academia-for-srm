"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Loader2, BookOpen, Clock, Activity,
  BarChart3, LogOut, GraduationCap, Hash, Building,
} from "lucide-react";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setIsLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ netId: fd.get("netId"), password: fd.get("password") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to authenticate");
      if (data.authenticated) { setDashboardData(data.data); setIsLoggedIn(true); }
      else throw new Error("Invalid credentials");
    } catch (err: any) { setErrorMsg(err.message || "An error occurred"); }
    finally { setIsLoading(false); }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AnimatePresence mode="wait">
        {!isLoggedIn ? (
          <LoginScreen key="login" isLoading={isLoading} onLogin={handleLogin} errorMsg={errorMsg} />
        ) : (
          <DashboardScreen key="dash" onLogout={() => { setIsLoggedIn(false); setDashboardData(null); }} data={dashboardData} />
        )}
      </AnimatePresence>
    </main>
  );
}

/* ━━━━━━━━ LOGIN ━━━━━━━━ */
function LoginScreen({ isLoading, onLogin, errorMsg }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-screen px-4">

      {/* Top-left branding */}
      <motion.div initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="absolute top-6 left-8 flex items-center gap-2.5">
        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-semibold tracking-tight">Academia Pro</span>
      </motion.div>

      {/* Hero heading */}
      <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
        className="text-center mb-10">
        <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-medium tracking-tight leading-[1.1] mb-5">
          Your academics,<br />simplified
        </h1>
        <p className="text-muted text-base md:text-lg">
          Sign in with your SRM NetID to view your dashboard.
        </p>
      </motion.div>

      {/* Login card */}
      <motion.div initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
        className="w-full max-w-md bg-card border border-card-border rounded-2xl p-8 shadow-[0_2px_20px_rgba(0,0,0,0.04)]">
        <form onSubmit={onLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-muted mb-1.5">NetID / Email</label>
            <input type="text" name="netId" placeholder="ab1234@srmist.edu.in" required
              className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted/50 outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1.5">Password</label>
            <input type="password" name="password" placeholder="••••••••" required
              className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted/50 outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all" />
          </div>
          <button type="submit" disabled={isLoading}
            className="w-full bg-btn-dark hover:bg-btn-dark-hover text-white rounded-xl px-4 py-3.5 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1">
            {isLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
              : <><span>Continue</span> <ArrowRight className="w-4 h-4" /></>}
          </button>
          {errorMsg && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-danger text-sm text-center font-medium">{errorMsg}</motion.p>
          )}
        </form>
      </motion.div>
    </motion.div>
  );
}

/* ━━━━━━━━ DASHBOARD ━━━━━━━━ */
function DashboardScreen({ onLogout, data }: { onLogout: () => void; data: any }) {
  const student = data?.student || { name: "Student", course: "Unknown" };
  const attendance = data?.attendance || { overall: 0, subjects: [] };
  const grades = data?.grades || [];
  const marks = data?.marks || [];
  const schedule = data?.schedule || [];
  const [tab, setTab] = useState<"attendance" | "marks" | "schedule">("attendance");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="min-h-screen p-4 md:p-8 max-w-6xl mx-auto">

      {/* Header */}
      <header className="flex items-center justify-between mb-8 bg-card border border-card-border rounded-2xl px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-accent rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{student.name}</h2>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{student.regNumber || "—"}</span>
              <span className="flex items-center gap-1"><Building className="w-3 h-3" />{student.course}</span>
              <span className="hidden md:inline">Sem {student.semester} · Batch {student.batch}</span>
            </div>
          </div>
        </div>
        <button onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-card-border hover:bg-card-border/30 transition-colors">
          <LogOut className="w-4 h-4" /> <span className="hidden md:inline">Logout</span>
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {([
          { key: "attendance" as const, label: "Attendance", Icon: Activity },
          { key: "marks" as const, label: "Internal Marks", Icon: BarChart3 },
          { key: "schedule" as const, label: "Schedule", Icon: Clock },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === t.key
                ? "bg-btn-dark text-white"
                : "bg-card border border-card-border text-muted hover:text-foreground"
            }`}>
            <t.Icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {tab === "attendance" && <AttendanceTab key="a" attendance={attendance} />}
        {tab === "marks" && <MarksTab key="m" marks={marks} grades={grades} />}
        {tab === "schedule" && <ScheduleTab key="s" schedule={schedule} />}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Attendance Tab ── */
function AttendanceTab({ attendance }: { attendance: any }) {
  const ringColors = ["var(--color-accent)", "var(--color-success)", "var(--color-danger)", "#5b7fb5"];
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><Ring val={attendance.overall} label="Overall" color={ringColors[0]} /></Card>
        {attendance.subjects.slice(0, 3).map((s: any, i: number) => (
          <Card key={i}><Ring val={s.percentage} label={s.code} color={ringColors[(i + 1) % 4]} /></Card>
        ))}
      </div>
      <Card>
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-accent" /> Subject-wise Attendance
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-muted text-xs uppercase tracking-wider">
                <th className="text-left py-3 px-3 font-medium">Code</th>
                <th className="text-left py-3 px-3 font-medium">Subject</th>
                <th className="text-left py-3 px-3 font-medium hidden md:table-cell">Category</th>
                <th className="text-left py-3 px-3 font-medium hidden lg:table-cell">Faculty</th>
                <th className="text-left py-3 px-3 font-medium hidden md:table-cell">Slot</th>
                <th className="text-left py-3 px-3 font-medium hidden md:table-cell">Room</th>
                <th className="text-right py-3 px-3 font-medium">Attn %</th>
              </tr>
            </thead>
            <tbody>
              {attendance.subjects.map((s: any, i: number) => (
                <tr key={i} className="border-b border-card-border hover:bg-foreground/[0.02] transition-colors">
                  <td className="py-3 px-3 font-mono text-xs text-muted">{s.code}</td>
                  <td className="py-3 px-3 font-medium">{s.name}</td>
                  <td className="py-3 px-3 hidden md:table-cell">
                    <span className={`text-xs px-2 py-1 rounded-lg ${s.category === "Theory" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                      {s.category}
                    </span>
                  </td>
                  <td className="py-3 px-3 hidden lg:table-cell text-xs text-muted">{s.faculty}</td>
                  <td className="py-3 px-3 hidden md:table-cell">{s.slot}</td>
                  <td className="py-3 px-3 hidden md:table-cell text-muted">{s.room}</td>
                  <td className="py-3 px-3 text-right">
                    <span className={`font-bold text-sm ${s.percentage >= 90 ? "text-success" : s.percentage >= 75 ? "text-warning" : "text-danger"}`}>
                      {s.percentage}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </motion.div>
  );
}

/* ── Marks Tab ── */
function MarksTab({ marks, grades }: { marks: any[]; grades: any[] }) {
  if (marks.length === 0) return <Card><p className="text-center py-8 text-muted">No marks data available.</p></Card>;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
      {marks.map((m: any, i: number) => (
        <Card key={i}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${m.courseType === "Theory" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                {m.courseType === "Theory" ? "T" : "P"}
              </div>
              <div>
                <h4 className="font-semibold">{m.code}</h4>
                <p className="text-xs text-muted">{m.courseType}</p>
              </div>
            </div>
            {grades[i] && (
              <div className="text-right">
                <div className={`text-2xl font-bold ${grades[i].percentage >= 80 ? "text-success" : grades[i].percentage >= 60 ? "text-warning" : "text-danger"}`}>
                  {grades[i].percentage}%
                </div>
                <div className="text-xs text-muted">{grades[i].totalScored}/{grades[i].totalMax}</div>
              </div>
            )}
          </div>
          {m.tests?.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {m.tests.map((t: any, j: number) => {
                const p = t.maxMarks > 0 ? (t.scored / t.maxMarks) * 100 : 0;
                return (
                  <div key={j} className="bg-input-bg border border-card-border rounded-xl p-3">
                    <div className="text-xs text-muted mb-1 truncate" title={t.testName}>{t.testName}</div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-lg font-bold ${p >= 80 ? "text-success" : p >= 50 ? "text-warning" : "text-danger"}`}>{t.scored}</span>
                      <span className="text-xs text-muted">/ {t.maxMarks}</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-card-border rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(p, 100)}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: j * 0.1 }}
                        className={`h-full rounded-full ${p >= 80 ? "bg-success" : p >= 50 ? "bg-warning" : "bg-danger"}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-sm text-muted italic">No marks data available yet</p>}
        </Card>
      ))}
    </motion.div>
  );
}

/* ── Schedule Tab ── */
function ScheduleTab({ schedule }: { schedule: any[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <Card>
        <h3 className="text-base font-semibold mb-6 flex items-center gap-2">
          <Clock className="w-4 h-4 text-accent" /> Today&apos;s Schedule
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {schedule.length > 0 ? schedule.map((c: any, i: number) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="bg-input-bg border border-card-border rounded-xl p-4 hover:shadow-md transition-all">
              <div className="text-xs font-medium text-accent mb-2">{c.time}</div>
              <div className="font-semibold text-sm mb-1">{c.name}</div>
              <div className="text-sm text-muted">{c.room}</div>
            </motion.div>
          )) : <div className="col-span-4 text-center py-8 text-muted">No classes scheduled.</div>}
        </div>
      </Card>
    </motion.div>
  );
}

/* ━━━ Shared ━━━ */
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card border border-card-border rounded-2xl p-6 ${className || ""}`}>{children}</div>;
}

function Ring({ val, label, color }: { val: number; label: string; color: string }) {
  const c = 2 * Math.PI * 38;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center">
        <svg className="w-24 h-24 -rotate-90">
          <circle strokeWidth="8" stroke="var(--color-card-border)" fill="transparent" r="38" cx="48" cy="48" />
          <motion.circle strokeWidth="8" strokeDasharray={c}
            initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (val / 100) * c }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
            strokeLinecap="round" stroke={color} fill="transparent" r="38" cx="48" cy="48" />
        </svg>
        <span className="absolute text-xl font-bold">{val}%</span>
      </div>
      <span className="text-sm font-medium text-muted">{label}</span>
    </div>
  );
}
