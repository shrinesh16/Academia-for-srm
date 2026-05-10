"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Lock, ArrowRight, Loader2, BookOpen, Clock, Activity, BarChart3, LogOut, GraduationCap, Hash, Building } from "lucide-react";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [netId, setNetId] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const formData = new FormData(e.currentTarget);
    const submittedNetId = formData.get("netId") as string;
    const submittedPassword = formData.get("password") as string;
    
    setIsLoading(true);
    setErrorMsg("");
    
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ netId: submittedNetId, password: submittedPassword }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to authenticate");
      }
      
      if (data.authenticated) {
        setDashboardData(data.data);
        setIsLoggedIn(true);
      } else {
        throw new Error("Invalid credentials");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setDashboardData(null);
    setNetId("");
    setPassword("");
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-50 selection:bg-indigo-500/30 overflow-hidden font-sans">
      {/* Background glowing orbs */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-blue-600/10 blur-[100px]" />
        <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[40%] rounded-full bg-violet-600/15 blur-[120px]" />
      </div>

      <div className="relative z-10 min-h-screen">
        <AnimatePresence mode="wait">
          {!isLoggedIn ? (
            <LoginScreen
              key="login"
              netId={netId}
              password={password}
              setNetId={setNetId}
              setPassword={setPassword}
              isLoading={isLoading}
              onLogin={handleLogin}
              errorMsg={errorMsg}
            />
          ) : (
            <DashboardScreen key="dashboard" onLogout={handleLogout} data={dashboardData} />
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function LoginScreen({ netId, password, setNetId, setPassword, isLoading, onLogin, errorMsg }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex flex-col items-center justify-center min-h-screen p-4"
    >
      <div className="mb-8 text-center space-y-2">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/20 mb-6"
        >
          <BookOpen className="w-8 h-8 text-white" />
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
          Academia Pro
        </h1>
        <p className="text-neutral-400 max-w-sm mx-auto text-sm md:text-base">
          Sign in with your SRM NetID to access your live academic dashboard.
        </p>
      </div>

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="w-full max-w-md backdrop-blur-2xl bg-neutral-900/50 border border-white/10 p-8 rounded-3xl shadow-2xl"
      >
        <form onSubmit={onLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300 ml-1">NetID</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="w-5 h-5 text-neutral-500 group-focus-within:text-indigo-400 transition-colors" />
              </div>
              <input
                type="text"
                name="netId"
                placeholder="ab1234@srmist.edu.in"
                className="w-full bg-neutral-950/50 border border-white/5 rounded-2xl py-3 pl-11 pr-4 text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300 ml-1">Password</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="w-5 h-5 text-neutral-500 group-focus-within:text-indigo-400 transition-colors" />
              </div>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                className="w-full bg-neutral-950/50 border border-white/5 rounded-2xl py-3 pl-11 pr-4 text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full group relative overflow-hidden rounded-2xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white transition-all hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scraping Academia... (~20s)
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </span>
          </button>
          
          {errorMsg && (
            <motion.p 
              initial={{ opacity: 0, y: -5 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="text-rose-400 text-sm text-center font-medium mt-4"
            >
              {errorMsg}
            </motion.p>
          )}
        </form>
      </motion.div>
    </motion.div>
  );
}

function DashboardScreen({ onLogout, data }: { onLogout: () => void, data: any }) {
  const student = data?.student || { name: "Student", course: "Unknown" };
  const attendance = data?.attendance || { overall: 0, subjects: [] };
  const grades = data?.grades || [];
  const marks = data?.marks || [];
  const schedule = data?.schedule || [];

  const [activeTab, setActiveTab] = useState<"attendance" | "marks" | "schedule">("attendance");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto"
    >
      {/* Header */}
      <header className="flex items-center justify-between mb-8 backdrop-blur-md bg-neutral-900/30 border border-white/5 px-6 py-4 rounded-3xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{student.name}</h2>
            <div className="flex items-center gap-3 text-xs text-neutral-400">
              <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{student.regNumber || "—"}</span>
              <span className="flex items-center gap-1"><Building className="w-3 h-3" />{student.course}</span>
              <span>Sem {student.semester} · Batch {student.batch}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium transition-colors border border-white/5"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden md:inline">Logout</span>
        </button>
      </header>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        {[
          { key: "attendance" as const, label: "Attendance", icon: Activity },
          { key: "marks" as const, label: "Internal Marks", icon: BarChart3 },
          { key: "schedule" as const, label: "Schedule", icon: Clock },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-medium transition-all",
              activeTab === tab.key
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                : "bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white border border-white/5"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "attendance" && (
          <motion.div
            key="attendance"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Overall Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <DashboardCard className="relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-[40px]" />
                <StatRing value={attendance.overall} label="Overall" color="text-indigo-400" />
              </DashboardCard>
              {attendance.subjects.slice(0, 3).map((sub: any, i: number) => {
                const colors = ["text-emerald-400", "text-rose-400", "text-blue-400"];
                return (
                  <DashboardCard key={i}>
                    <StatRing value={sub.percentage} label={sub.code} color={colors[i % colors.length]} />
                  </DashboardCard>
                );
              })}
            </div>

            {/* Subject-wise attendance table */}
            <DashboardCard>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                Subject-wise Attendance
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-neutral-400 border-b border-white/5">
                      <th className="text-left py-3 px-3 font-medium">Code</th>
                      <th className="text-left py-3 px-3 font-medium">Subject</th>
                      <th className="text-left py-3 px-3 font-medium hidden md:table-cell">Category</th>
                      <th className="text-left py-3 px-3 font-medium hidden lg:table-cell">Faculty</th>
                      <th className="text-left py-3 px-3 font-medium">Slot</th>
                      <th className="text-left py-3 px-3 font-medium hidden md:table-cell">Room</th>
                      <th className="text-right py-3 px-3 font-medium">Attn %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.subjects.map((sub: any, i: number) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-3 font-mono text-xs text-neutral-300">{sub.code}</td>
                        <td className="py-3 px-3 font-medium text-white">{sub.name}</td>
                        <td className="py-3 px-3 hidden md:table-cell">
                          <span className={cn(
                            "text-xs px-2 py-1 rounded-lg",
                            sub.category === "Theory" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"
                          )}>
                            {sub.category}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-neutral-400 hidden lg:table-cell text-xs">{sub.faculty}</td>
                        <td className="py-3 px-3 text-neutral-300">{sub.slot}</td>
                        <td className="py-3 px-3 text-neutral-400 hidden md:table-cell">{sub.room}</td>
                        <td className="py-3 px-3 text-right">
                          <span className={cn(
                            "font-bold text-sm",
                            sub.percentage >= 90 ? "text-emerald-400" :
                            sub.percentage >= 75 ? "text-yellow-400" :
                            "text-rose-400"
                          )}>
                            {sub.percentage}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DashboardCard>
          </motion.div>
        )}

        {activeTab === "marks" && (
          <motion.div
            key="marks"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {marks.length > 0 ? marks.map((m: any, i: number) => (
              <DashboardCard key={i}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold",
                      m.courseType === "Theory" ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"
                    )}>
                      {m.courseType === "Theory" ? "T" : "P"}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{m.code}</h4>
                      <p className="text-xs text-neutral-400">{m.courseType}</p>
                    </div>
                  </div>
                  {grades[i] && (
                    <div className="text-right">
                      <div className={cn(
                        "text-2xl font-bold",
                        grades[i].percentage >= 80 ? "text-emerald-400" :
                        grades[i].percentage >= 60 ? "text-yellow-400" :
                        "text-rose-400"
                      )}>
                        {grades[i].percentage}%
                      </div>
                      <div className="text-xs text-neutral-400">
                        {grades[i].totalScored}/{grades[i].totalMax}
                      </div>
                    </div>
                  )}
                </div>
                {m.tests && m.tests.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {m.tests.map((t: any, j: number) => {
                      const pct = t.maxMarks > 0 ? (t.scored / t.maxMarks) * 100 : 0;
                      return (
                        <div key={j} className="bg-white/5 rounded-xl p-3">
                          <div className="text-xs text-neutral-400 mb-1 truncate" title={t.testName}>{t.testName}</div>
                          <div className="flex items-baseline gap-1">
                            <span className={cn(
                              "text-lg font-bold",
                              pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-yellow-400" : "text-rose-400"
                            )}>
                              {t.scored}
                            </span>
                            <span className="text-xs text-neutral-500">/ {t.maxMarks}</span>
                          </div>
                          <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(pct, 100)}%` }}
                              transition={{ duration: 1, ease: "easeOut", delay: j * 0.1 }}
                              className={cn(
                                "h-full rounded-full",
                                pct >= 80 ? "bg-emerald-400" : pct >= 50 ? "bg-yellow-400" : "bg-rose-400"
                              )}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {(!m.tests || m.tests.length === 0) && (
                  <p className="text-sm text-neutral-500 italic">No marks data available yet</p>
                )}
              </DashboardCard>
            )) : (
              <DashboardCard>
                <p className="text-center py-8 text-neutral-500">No marks data available.</p>
              </DashboardCard>
            )}
          </motion.div>
        )}

        {activeTab === "schedule" && (
          <motion.div
            key="schedule"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <DashboardCard>
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                Today&apos;s Schedule
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {schedule.length > 0 ? schedule.map((cls: any, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-4 rounded-2xl bg-gradient-to-b from-white/5 to-transparent border border-white/5 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 transition-all"
                  >
                    <div className="text-xs font-medium text-indigo-400 mb-2">{cls.time}</div>
                    <div className="font-semibold text-white mb-1 text-sm">{cls.name}</div>
                    <div className="text-sm text-neutral-400">{cls.room}</div>
                  </motion.div>
                )) : (
                  <div className="col-span-4 text-center py-8 text-neutral-500">No classes scheduled for today.</div>
                )}
              </div>
            </DashboardCard>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DashboardCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "bg-neutral-900/40 backdrop-blur-xl border border-white/5 rounded-3xl p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

function StatRing({ value, label, color }: { value: number; label: string; color: string }) {
  const circumference = 2 * Math.PI * 38;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center">
        <svg className="w-24 h-24 transform -rotate-90">
          <circle
            className="text-white/5"
            strokeWidth="8"
            stroke="currentColor"
            fill="transparent"
            r="38"
            cx="48"
            cy="48"
          />
          <motion.circle
            className={color}
            strokeWidth="8"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r="38"
            cx="48"
            cy="48"
          />
        </svg>
        <span className="absolute text-xl font-bold">{value}%</span>
      </div>
      <span className="text-sm font-medium text-neutral-400">{label}</span>
    </div>
  );
}
