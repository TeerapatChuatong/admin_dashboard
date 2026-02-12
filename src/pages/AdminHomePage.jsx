// src/pages/AdminHomePage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { readDashboardStatsApi } from "../api/readDashboardStatsApi";
import "./AdminHomePage.css";

export default function AdminHomePage() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const userInitial = (user?.username ?? user?.email ?? "A").charAt(0).toUpperCase();

  // Helper: Check if route is active
  const isActive = (path) => window.location.pathname === path;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const data = await readDashboardStatsApi();
        if (alive) setStats(data);
      } catch (e) {
        console.error("Dashboard stats error:", e);
        if (alive) setStats(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const totals = stats?.totals || {};
  const totalUsers = Number(totals.users ?? 0);
  const totalQuestions = Number(totals.questions ?? 0);
  const totalAnswers = Number(totals.answers ?? 0);
  const totalDiseasesRaw = Number(totals.diseases ?? 0);
  // หมายเหตุ: ในตาราง diseases มี 3 รายการที่ไม่ใช่ “โรค” (เช่น Healthy/หมวดคำถามอื่น ๆ)
  // ต้องการให้แสดง “โรคทั้งหมด” เฉพาะโรคจริง = 5
  const totalDiseases = Math.max(0, totalDiseasesRaw - 3);
  const totalChemicals = Number(totals.chemicals ?? 0);
  
  const activity = stats?.activity_last_7_days || [];
  const activityCounts = activity.map((x) => Number(x.count ?? 0));

  const { linePoints, dotPoints } = useMemo(() => {
    // สร้างกราฟเส้นแบบ SVG จาก activityCounts (7 จุด)
    const w = 300;
    const h = 150;
    const pad = 15;

    const n = activityCounts.length || 7;
    const data = activityCounts.length ? activityCounts : [0, 0, 0, 0, 0, 0, 0];
    const maxV = Math.max(1, ...data);

    const xs = Array.from({ length: n }, (_, i) => {
      if (n === 1) return w / 2;
      return (i * (w - pad * 2)) / (n - 1) + pad;
    });

    const ys = data.map((v) => {
      const t = v / maxV;
      return h - pad - t * (h - pad * 2);
    });

    const pts = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
    const dots = xs.map((x, i) => ({ x, y: ys[i] }));

    return { linePoints: pts, dotPoints: dots };
  }, [JSON.stringify(activityCounts)]);

  const dist = stats?.distribution_month?.items || [];
  const distTotal = dist.reduce((s, it) => s + Number(it.count ?? 0), 0);

  const donutSegments = useMemo(() => {
    // วาดโดนัทด้วย strokeDasharray
    const r = 40;
    const c = 2 * Math.PI * r;
    const colors = ["#16A34A", "#10B981", "#22C55E", "#34D399", "#86EFAC"];

    let offset = 0;
    return dist.map((it, idx) => {
      const val = Number(it.count ?? 0);
      const frac = distTotal > 0 ? val / distTotal : 0;
      const len = frac * c;
      const seg = {
        key: `${it.disease_id ?? idx}`,
        stroke: colors[idx % colors.length],
        dasharray: `${len} ${c - len}`,
        dashoffset: -offset,
      };
      offset += len;
      return seg;
    });
  }, [JSON.stringify(dist), distTotal]);

  const recent = stats?.recent_activity || [];

  const formatAgo = (dt) => {
    if (!dt) return "—";
    const t = new Date(dt.replace(" ", "T")).getTime();
    if (Number.isNaN(t)) return dt;
    const diff = Date.now() - t;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${Math.max(1, mins)} นาทีที่แล้ว`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ชม.ที่แล้ว`;
    const days = Math.floor(hrs / 24);
    return `${days} วันที่แล้ว`;
  };

  const showVal = (v) => (loading ? "…" : String(v));

  return (
    <div className="adminShell">
      {/* SIDEBAR */}
      <aside className={`adminSidebar ${sidebarOpen ? "open" : ""}`}>
        {/* Logo Section */}
        <div className="sidebarHeader">
          <div className="sidebarLogo">
            <span className="logoIcon">🌱</span>
            <span className="logoText">Citrus Admin</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebarNav">
          <Link to="/admin" className={`navItem ${isActive("/admin") ? "active" : ""}`}>
            <span className="navIcon">📊</span>
            <span className="navLabel">Dashboard</span>
          </Link>

          <Link to="/admin/users" className={`navItem ${isActive("/admin/users") ? "active" : ""}`}>
            <span className="navIcon">👥</span>
            <span className="navLabel">ผู้ใช้งาน</span>
          </Link>

          <Link to="/admin/questions" className={`navItem ${isActive("/admin/questions") ? "active" : ""}`}>
            <span className="navIcon">❓</span>
            <span className="navLabel">คำถาม</span>
          </Link>

          <Link to="/admin/answers" className={`navItem ${isActive("/admin/answers") ? "active" : ""}`}>
            <span className="navIcon">✅</span>
            <span className="navLabel">คำตอบ</span>
          </Link>

          <Link to="/admin/treatments" className={`navItem ${isActive("/admin/treatments") ? "active" : ""}`}>
            <span className="navIcon">💊</span>
            <span className="navLabel">คำแนะนำการรักษา</span>
          </Link>

          <Link to="/admin/diseases" className={`navItem ${isActive("/admin/diseases") ? "active" : ""}`}>
            <span className="navIcon">🔬</span>
            <span className="navLabel">โรค</span>
          </Link>

          <Link to="/admin/chemicals" className={`navItem ${isActive("/admin/chemicals") ? "active" : ""}`}>
            <span className="navIcon">⚗️</span>
            <span className="navLabel">สารเคมี + MOA</span>
          </Link>

          <Link to="/admin/moa-plan" className={`navItem ${isActive("/admin/moa-plan") ? "active" : ""}`}>
            <span className="navIcon">📋</span>
            <span className="navLabel">แผน MOA</span>
          </Link>
        </nav>
      </aside>

      {/* MAIN AREA */}
      <main className="adminMain">
        {/* TOPBAR */}
        <div className="adminTopbar">
          <div className="topbarLeft">
            <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
              ☰
            </button>
            <div className="topbarTitle">
              <h2>Dashboard</h2>
            </div>
          </div>

          <div className="topbarRight">
            <div className="profileBlock">
              <div className="profileInfo">
                <div className="userName">{user?.username ?? user?.email}</div>
                <div className="userRole">{user?.role === "admin" ? "ผู้ดูแลระบบ" : "ผู้ใช้ทั่วไป"}</div>
              </div>
              <div className="profileAvatar">{userInitial}</div>
            </div>
            <button className="logoutBtn" onClick={logout}>
              ออกจากระบบ
            </button>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="adminContent">
          {/* Summary Cards Row */}
          <div className="summaryRow">
            <div className="summaryCard highlight">
              <div className="cardHeader">
                <span className="cardIcon">👥</span>
                <h3>ผู้ใช้งานทั้งหมด</h3>
              </div>
              <div className="cardValue">{showVal(totalUsers)}</div>
              <p className="cardDesc">ลงทะเบียนแล้ว</p>
            </div>

            <div className="summaryCard">
              <div className="cardHeader">
                <span className="cardIcon">❓</span>
                <h3>คำถามทั้งหมด</h3>
              </div>
              <div className="cardValue">{showVal(totalQuestions)}</div>
              <p className="cardDesc">ปัจจุบัน</p>
            </div>

            <div className="summaryCard">
              <div className="cardHeader">
                <span className="cardIcon">✅</span>
                <h3>คำตอบทั้งหมด</h3>
              </div>
              <div className="cardValue">{showVal(totalAnswers)}</div>
              <p className="cardDesc">ในระบบ</p>
            </div>

            <div className="summaryCard">
              <div className="cardHeader">
                <span className="cardIcon">🏥</span>
                <h3>โรคทั้งหมด</h3>
              </div>
              <div className="cardValue">{showVal(totalDiseases)}</div>
              <p className="cardDesc">บันทึก</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="chartsRow">
            <div className="chartCard">
              <h3>📈 Activity (สัปดาห์)</h3>
              <div className="chartPlaceholder">
                <svg viewBox="0 0 300 150" xmlns="http://www.w3.org/2000/svg">
                  <polyline
                    points={linePoints}
                    fill="none"
                    stroke="#16A34A"
                    strokeWidth="3"
                  />
                  {dotPoints.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="4" fill="#16A34A" />
                  ))}
                </svg>
              </div>
            </div>

            <div className="chartCard">
              <h3>📊 Distribution (รายเดือน)</h3>
              <div className="chartPlaceholder">
                <svg viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
                  {/* base ring */}
                  <circle cx="100" cy="75" r="40" fill="none" stroke="#E5E7EB" strokeWidth="12" />
                  {donutSegments.map((s) => (
                    <circle
                      key={s.key}
                      cx="100"
                      cy="75"
                      r="40"
                      fill="none"
                      stroke={s.stroke}
                      strokeWidth="12"
                      strokeDasharray={s.dasharray}
                      strokeDashoffset={s.dashoffset}
                      strokeLinecap="butt"
                      transform="rotate(-90 100 75)"
                    />
                  ))}
                  <circle cx="100" cy="75" r="28" fill="#10B981" opacity="0.12" />
                  <text x="100" y="78" textAnchor="middle" fontSize="16" fontWeight="700" fill="#0F172A">
                    {loading ? "…" : String(distTotal || 0)}
                  </text>
                  <text x="100" y="98" textAnchor="middle" fontSize="11" fill="#64748B">
                    รายการเดือนนี้
                  </text>
                </svg>
              </div>
            </div>
          </div>

          {/* Bottom Row: Lists */}
          <div className="bottomRow">
            <div className="listCard">
              <h3>📌 Top Sections</h3>
              <div className="sectionList">
                <div className="listItem">
                  <span className="itemLabel">👥 ผู้ใช้งาน</span>
                  <span className="itemValue">{showVal(totalUsers)}</span>
                </div>
                <div className="listItem">
                  <span className="itemLabel">❓ คำถาม</span>
                  <span className="itemValue">{showVal(totalQuestions)}</span>
                </div>
                <div className="listItem">
                  <span className="itemLabel">✅ คำตอบ</span>
                  <span className="itemValue">{showVal(totalAnswers)}</span>
                </div>
                <div className="listItem">
                  <span className="itemLabel">🏥 โรค</span>
                  <span className="itemValue">{showVal(totalDiseases)}</span>
                </div>
                <div className="listItem">
                  <span className="itemLabel">⚗️ สารเคมี</span>
                  <span className="itemValue">{showVal(totalChemicals)}</span>
                </div>
              </div>
            </div>

            <div className="listCard">
              <h3>📝 Recent Activity</h3>
              <div className="activityTable">
                {recent.length === 0 ? (
                  <div className="activityRow">
                    <span className="activityAction">—</span>
                    <span className="activityDate">—</span>
                    <span className="activityPill done">Done</span>
                  </div>
                ) : (
                  recent.map((r, idx) => (
                    <div className="activityRow" key={idx}>
                      <span className="activityAction">
                        {r.action} {r.detail ? `: ${r.detail}` : ""}
                      </span>
                      <span className="activityDate">{formatAgo(r.at)}</span>
                      <span className={`activityPill ${r.status || "done"}`}>
                        {r.status === "active" ? "Active" : r.status === "received" ? "Received" : "Done"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
