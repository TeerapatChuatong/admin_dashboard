// src/pages/AdminChemicalsAndMOAGroupsPage.jsx
// รวมหน้า: AdminChemicalsPage + AdminMOAGroupsPage (รวม UI + ฟังก์ชันจริง ไม่ได้ import สองหน้าเข้าด้วยกัน)

import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";

import {
  readChemicalsApi,
  searchChemicals,
  createChemical,
  updateChemical,
  deleteChemical,
} from "../api/chemicalsApi";

import {
  readMoaGroupsApi,
  createMoaGroup,
  updateMoaGroup,
  deleteMoaGroup,
} from "../api/moaGroupsApi";

// ✅ ลบ HRAC (สารกำจัดวัชพืช) ออก
const SYSTEM_OPTIONS = [
  { value: "FRAC", label: "FRAC (สารป้องกันกำจัดเชื้อรา)" },
  { value: "IRAC", label: "IRAC (สารกำจัดแมลง)" },
  { value: "OTHER", label: "อื่น ๆ" },
];

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(16,185,129,0.06)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 9999,
};

const modalStyle = {
  width: "min(920px, 100%)",
  maxHeight: "90vh",
  overflow: "auto",
};

// ✅ ปุ่มบันทึก/ยกเลิกเล็กลง และย้ายลงมาอีกบรรทัด (ไม่อยู่บรรทัดเดียวกับสถานะ)
const modalActionsRowStyle = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "flex-end",
  width: "100%",
  marginTop: 6,
  gridColumn: "1 / -1",
};

const modalActionBtnStyle = {
  padding: "7px 12px",
  height: 32,
  lineHeight: "18px",
};

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function normalizeCommonName(v) {
  return String(v ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function toStr(v) {
  return v == null ? "" : String(v);
}

export default function AdminChemicalsAndMOAGroupsPage() {
  const { user, logout } = useAuth();

  const centerCell = { textAlign: "center", verticalAlign: "middle" };

  // ====== UI: แท็บ ======
  const [tab, setTab] = useState("chemicals"); // chemicals | moa

  // ======================
  // ====== MOA Groups =====
  // ======================
  const [moaItems, setMoaItems] = useState([]);
  const [moaKeyword, setMoaKeyword] = useState("");
  const [moaSystem, setMoaSystem] = useState("");
  const [moaLoading, setMoaLoading] = useState(true);
  const [moaSearching, setMoaSearching] = useState(false);

  const [moaError, setMoaError] = useState("");
  const [moaOpenCreate, setMoaOpenCreate] = useState(false);
  const [moaOpenEdit, setMoaOpenEdit] = useState(false);

  const [moaCreateForm, setMoaCreateForm] = useState({
    moa_system: "FRAC",
    moa_code: "",
  });

  const [moaEditForm, setMoaEditForm] = useState({
    moa_group_id: "",
    moa_system: "FRAC",
    moa_code: "",
  });

  const moaFirstLoadRef = useRef(true);

  async function fetchMoaGroups({ forceLoading = false } = {}) {
    if (forceLoading) setMoaLoading(true);
    setMoaError("");

    try {
      const data = await readMoaGroupsApi({ moa_system: moaSystem || null });
      const list = normalizeList(data).filter(
        (r) => String(r?.moa_system || "").toUpperCase() !== "HRAC"
      );
      setMoaItems(list);
    } catch (err) {
      setMoaError(err?.message || "โหลดรายการกลุ่ม MOA ไม่สำเร็จ");
      setMoaItems([]);
    } finally {
      setMoaLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    const isFirst = moaFirstLoadRef.current;
    if (isFirst) {
      moaFirstLoadRef.current = false;
      fetchMoaGroups({ forceLoading: true });
      return;
    }

    setMoaSearching(true);
    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        await fetchMoaGroups({ forceLoading: false });
      } finally {
        if (!cancelled) setMoaSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moaSystem]);

  const moaFilteredItems = moaItems.filter((row) => {
    const q = moaKeyword.trim().toLowerCase();
    if (!q) return true;
    const hay = [row?.moa_system, row?.moa_code]
      .map((x) => toStr(x).toLowerCase())
      .join(" | ");
    return hay.includes(q);
  });

  function openMoaCreateModal() {
    setMoaError("");
    setMoaCreateForm({
      moa_system: moaSystem || "FRAC",
      moa_code: "",
    });
    setMoaOpenCreate(true);
  }

  function openMoaEditModal(row) {
    setMoaError("");
    setMoaEditForm({
      moa_group_id: row?.moa_group_id ?? row?.moaGroupId ?? "",
      moa_system: row?.moa_system ?? "FRAC",
      moa_code: row?.moa_code ?? "",
    });
    setMoaOpenEdit(true);
  }

  function onChangeMoaCreate(e) {
    const { name, value } = e.target;
    setMoaCreateForm((s) => ({ ...s, [name]: value }));
  }

  function onChangeMoaEdit(e) {
    const { name, value } = e.target;
    setMoaEditForm((s) => ({ ...s, [name]: value }));
  }

  async function submitMoaCreate(e) {
    e.preventDefault();
    setMoaError("");

    const sys = (moaCreateForm.moa_system || "").trim();
    const code = (moaCreateForm.moa_code || "").trim();

    if (!sys) return setMoaError("กรุณาเลือก/กรอก moa_system");
    if (sys.toUpperCase() === "HRAC")
      return setMoaError("ระบบ HRAC (สารกำจัดวัชพืช) ถูกยกเลิก/ไม่อนุญาตให้ใช้แล้ว");
    if (!code) return setMoaError("กรุณากรอก moa_code (เช่น 1A)");

    try {
      setMoaLoading(true);
      await createMoaGroup({ moa_system: sys, moa_code: code });
      setMoaOpenCreate(false);
      await fetchMoaGroups({ forceLoading: true });
    } catch (err) {
      setMoaError(err?.message || "เพิ่มกลุ่ม MOA ไม่สำเร็จ");
      setMoaLoading(false);
    }
  }

  async function submitMoaEdit(e) {
    e.preventDefault();
    setMoaError("");

    const id = moaEditForm.moa_group_id;
    const sys = (moaEditForm.moa_system || "").trim();
    const code = (moaEditForm.moa_code || "").trim();

    if (!id) return setMoaError("ไม่พบ moa_group_id");
    if (!sys) return setMoaError("กรุณาเลือก/กรอก moa_system");
    if (sys.toUpperCase() === "HRAC")
      return setMoaError("ระบบ HRAC (สารกำจัดวัชพืช) ถูกยกเลิก/ไม่อนุญาตให้ใช้แล้ว");
    if (!code) return setMoaError("กรุณากรอก moa_code (เช่น 1A)");

    try {
      setMoaLoading(true);
      await updateMoaGroup({
        moa_group_id: Number(id),
        moa_system: sys,
        moa_code: code,
      });
      setMoaOpenEdit(false);
      await fetchMoaGroups({ forceLoading: true });
    } catch (err) {
      setMoaError(err?.message || "แก้ไขกลุ่ม MOA ไม่สำเร็จ");
      setMoaLoading(false);
    }
  }

  async function onDeleteMoa(row) {
    const id = row?.moa_group_id ?? row?.moaGroupId;
    if (!id) return;
    if (!window.confirm("ยืนยันลบกลุ่ม MOA นี้?")) return;

    setMoaError("");
    try {
      setMoaLoading(true);
      await deleteMoaGroup(Number(id));
      await fetchMoaGroups({ forceLoading: true });
    } catch (err) {
      setMoaError(err?.message || "ลบกลุ่ม MOA ไม่สำเร็จ");
      setMoaLoading(false);
    }
  }

  // ======================
  // ====== Chemicals ======
  // ======================
  const [chemItems, setChemItems] = useState([]);
  const [chemMoaGroups, setChemMoaGroups] = useState([]);
  const [chemMoaLoading, setChemMoaLoading] = useState(false);

  const [chemKeyword, setChemKeyword] = useState("");
  const [chemSystemFilter, setChemSystemFilter] = useState(""); // "" = ทุกระบบ
  const [chemLoading, setChemLoading] = useState(true);
  const [chemSearching, setChemSearching] = useState(false);
  const [chemError, setChemError] = useState("");

  const [chemOpenCreate, setChemOpenCreate] = useState(false);
  const [chemOpenEdit, setChemOpenEdit] = useState(false);

  const [chemCreateForm, setChemCreateForm] = useState({
    common_name: "",
    usage_rate: "",
    moa_group_id: "",
    is_active: "1",
  });

  const [chemEditForm, setChemEditForm] = useState({
    chemical_id: "",
    common_name: "",
    usage_rate: "",
    moa_group_id: "",
    is_active: "1",
  });

  const chemFirstLoadRef = useRef(true);

  function formatMoaOption(mg) {
    const sys = (mg?.moa_system || "").trim();
    const code = (mg?.moa_code || "").trim();
    const name = (mg?.group_name || "").trim();
    const left = [sys, code].filter(Boolean).join(" ").trim();
    if (left && name && name !== left) return `${left} - ${name}`;
    return left || name || `ID ${mg?.moa_group_id}`;
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setChemMoaLoading(true);
      try {
        const data = await readMoaGroupsApi({});
        if (!cancelled) {
          const list = normalizeList(data).filter(
            (r) => String(r?.moa_system || "").toUpperCase() !== "HRAC"
          );
          setChemMoaGroups(list);
        }
      } catch {
        if (!cancelled) setChemMoaGroups([]);
      } finally {
        if (!cancelled) setChemMoaLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function fetchChemList({ forceLoading = false } = {}) {
    const q = chemKeyword.trim();
    if (forceLoading) setChemLoading(true);
    setChemError("");

    try {
      const data = q ? await searchChemicals(q, {}) : await readChemicalsApi({});
      setChemItems(normalizeList(data));
    } catch (err) {
      setChemError(err?.message || "โหลดรายการสารเคมีไม่สำเร็จ");
      setChemItems([]);
    } finally {
      setChemLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    const isFirst = chemFirstLoadRef.current;
    if (isFirst) {
      chemFirstLoadRef.current = false;
      fetchChemList({ forceLoading: true });
      return;
    }

    setChemSearching(true);
    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        await fetchChemList({ forceLoading: false });
      } finally {
        if (!cancelled) setChemSearching(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chemKeyword]);

  async function ensureUniqueCommonName(commonName, excludeChemicalId) {
    const target = normalizeCommonName(commonName);
    if (!target) return { ok: false, msg: "กรุณากรอกชื่อสามัญ (ไทย/อังกฤษ)" };

    try {
      const all = normalizeList(await readChemicalsApi({}));
      const found = all.find((row) => {
        const id = row?.chemical_id;
        if (excludeChemicalId != null && String(id) === String(excludeChemicalId)) return false;
        const n1 = normalizeCommonName(row?.active_ingredient);
        const n2 = normalizeCommonName(row?.trade_name);
        return n1 === target || n2 === target;
      });

      if (found) {
        const dupId = found?.chemical_id ?? "-";
        return { ok: false, msg: `ชื่อสามัญซ้ำกับรายการเดิม (ID: ${dupId})` };
      }
      return { ok: true, msg: "" };
    } catch {
      // ถ้าเช็คไม่สำเร็จ ให้ปล่อยให้ backend เช็คซ้ำอีกชั้น
      return { ok: true, msg: "" };
    }
  }


  const chemVisibleItems = chemItems.filter((row) => {
    if (!chemSystemFilter) return true;
    const moaGroup = chemMoaGroups.find(
      (mg) => String(mg?.moa_group_id) === String(row?.moa_group_id)
    );
    const sys = String(row?.moa_system || moaGroup?.moa_system || "")
      .trim()
      .toUpperCase();
    return sys === String(chemSystemFilter).toUpperCase();
  });

  function openChemCreateModal() {
    setChemError("");
    setChemCreateForm({
      common_name: "",
      usage_rate: "",
      moa_group_id: "",
      is_active: "1",
    });
    setChemOpenCreate(true);
  }

  function openChemEditModal(row) {
    setChemError("");

    const common =
      (row?.active_ingredient ?? "").trim() ||
      (row?.trade_name ?? "").trim() ||
      "";

    setChemEditForm({
      chemical_id: row?.chemical_id ?? "",
      common_name: common,
      usage_rate: row?.usage_rate ?? "",
      moa_group_id: row?.moa_group_id ?? "",
      is_active: String(row?.is_active ?? 1),
    });
    setChemOpenEdit(true);
  }

  function onChangeChemCreate(e) {
    const { name, value } = e.target;
    setChemCreateForm((s) => ({ ...s, [name]: value }));
  }

  function onChangeChemEdit(e) {
    const { name, value } = e.target;
    setChemEditForm((s) => ({ ...s, [name]: value }));
  }

  async function submitChemCreate(e) {
    e.preventDefault();
    setChemError("");

    const common_name = (chemCreateForm.common_name || "").trim();
    if (!common_name) {
      setChemError("กรุณากรอกชื่อสามัญ (ไทย/อังกฤษ)");
      return;
    }

    const u = await ensureUniqueCommonName(common_name, null);
    if (!u.ok) {
      setChemError(u.msg);
      return;
    }

    const payload = {
      trade_name: common_name,
      active_ingredient: common_name,
      usage_rate: (chemCreateForm.usage_rate || "").trim() || null,
      moa_group_id:
        String(chemCreateForm.moa_group_id || "").trim() === ""
          ? null
          : Number(chemCreateForm.moa_group_id),
      is_active: chemCreateForm.is_active === "0" ? 0 : 1,
    };

    try {
      setChemLoading(true);
      await createChemical(payload);
      setChemOpenCreate(false);
      await fetchChemList({ forceLoading: true });
    } catch (err) {
      setChemError(err?.message || "เพิ่มสารเคมีไม่สำเร็จ");
      setChemLoading(false);
    }
  }

  async function submitChemEdit(e) {
    e.preventDefault();
    setChemError("");

    const common_name = (chemEditForm.common_name || "").trim();
    if (!common_name) {
      setChemError("กรุณากรอกชื่อสามัญ (ไทย/อังกฤษ)");
      return;
    }

    const u = await ensureUniqueCommonName(common_name, chemEditForm.chemical_id);
    if (!u.ok) {
      setChemError(u.msg);
      return;
    }

    const payload = {
      chemical_id: chemEditForm.chemical_id,
      trade_name: common_name,
      active_ingredient: common_name,
      usage_rate: (chemEditForm.usage_rate || "").trim() || null,
      moa_group_id:
        String(chemEditForm.moa_group_id || "").trim() === ""
          ? null
          : Number(chemEditForm.moa_group_id),
      is_active: chemEditForm.is_active === "0" ? 0 : 1,
    };

    try {
      setChemLoading(true);
      await updateChemical(payload);
      setChemOpenEdit(false);
      await fetchChemList({ forceLoading: true });
    } catch (err) {
      setChemError(err?.message || "แก้ไขสารเคมีไม่สำเร็จ");
      setChemLoading(false);
    }
  }

  async function onDeleteChem(row) {
    const id = row?.chemical_id;
    if (!id) return;

    if (!window.confirm("ยืนยันลบสารเคมีนี้?")) return;

    setChemError("");
    try {
      setChemLoading(true);
      await deleteChemical(id);
      await fetchChemList({ forceLoading: true });
    } catch (err) {
      setChemError(err?.message || "ลบสารเคมีไม่สำเร็จ");
      setChemLoading(false);
    }
  }

  // ====== render ======
  const activeTabBtn = {
    background: "var(--primary)",
    color: "#fff",
    border: "1px solid var(--primary)",
  };

  const tabBtn = {
    background: "#fff",
    color: "var(--primary)",
    border: "1px solid var(--primary)",
  };

  return (
    <div className="page">
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="/admin" className="btn ghost">
            ← กลับหน้าหลัก
          </a>
          <h1 style={{ margin: 0 }}>สารเคมี + กลุ่ม MOA</h1>
        </div>

        <div className="header-right">
          <span>
            เข้าสู่ระบบเป็น: {user?.username ?? user?.email} ({user?.role})
          </span>
          <button className="btn ghost" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </header>

      <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          className="btn"
          style={tab === "chemicals" ? activeTabBtn : tabBtn}
          onClick={() => setTab("chemicals")}
          type="button"
        >
          จัดการสารเคมี
        </button>
        <button
          className="btn"
          style={tab === "moa" ? activeTabBtn : tabBtn}
          onClick={() => setTab("moa")}
          type="button"
        >
          จัดการกลุ่ม MOA
        </button>
      </div>

      {/* ===== TAB: Chemicals ===== */}
      {tab === "chemicals" && (
        <>
          {chemError && <div className="alert error">{chemError}</div>}

          <div
            className="card"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
            }}
          >
            <select
              className="input"
              value={chemSystemFilter}
              onChange={(e) => setChemSystemFilter(e.target.value)}
              style={{ minWidth: 140 }}
              title="กรองตามระบบ MOA"
            >
              <option value="">ทุกระบบ</option>
              {SYSTEM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value}
                </option>
              ))}
            </select>

            <input
              placeholder="ค้นหาสารเคมี (ชื่อสามัญ / MOA / อัตราการใช้)" 

              value={chemKeyword}
              onChange={(e) => setChemKeyword(e.target.value)}
              style={{ flex: 1, minWidth: 220 }}
            />

            {chemSearching && (
              <span className="t-muted">กำลังค้นหา...</span>
            )}

            <button className="btn ghost" onClick={() => { setChemKeyword(""); setChemSystemFilter(""); }}>
              รีเซ็ต
            </button>

            <button className="btn" onClick={openChemCreateModal}>
              + เพิ่มสารเคมี
            </button>
          </div>

          <div className="card">
            {chemLoading ? (
              <div>กำลังโหลด...</div>
            ) : chemVisibleItems.length === 0 ? (
              <div>{chemItems.length === 0 ? "ไม่พบข้อมูลสารเคมี" : "ไม่พบข้อมูลตามเงื่อนไข"}</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th style={centerCell}>ID</th>
                    <th>ชื่อสามัญ</th>
                    <th>อัตราการใช้</th>
                    <th style={centerCell}>ระบบ</th>
                    <th style={centerCell}>MOA</th>
                    <th style={centerCell}>สถานะ</th>
                    <th className="actionsHeader">จัดการ</th>
                  </tr>
                </thead>

                <tbody>
                  {chemVisibleItems.map((row) => {
                    const moaText =
                      row.moa_code || row.moa_group_name
                        ? `${row.moa_code ?? ""}${
                            row.moa_group_name ? ` - ${row.moa_group_name}` : ""
                          }`
                        : row.moa_group_id ?? "-";

                    const moaGroup = chemMoaGroups.find(
                      (mg) => String(mg?.moa_group_id) === String(row?.moa_group_id)
                    );
                    const moaSystemText = (row?.moa_system || moaGroup?.moa_system || "-")
                      ? String(row?.moa_system || moaGroup?.moa_system || "-").toUpperCase()
                      : "-";

                    const common =
                      (row?.active_ingredient ?? "").trim() ||
                      (row?.trade_name ?? "").trim() ||
                      "-";

                    return (
                      <tr key={row.chemical_id}>
                        <td style={centerCell}>{row.chemical_id}</td>
                        <td style={{ whiteSpace: "pre-wrap" }}>{common}</td>
                        <td style={{ whiteSpace: "pre-wrap" }}>{row.usage_rate || "-"}</td>
                        <td style={centerCell}>{moaSystemText || "-"}</td>
                        <td style={centerCell}>{moaText || "-"}</td>
                        <td style={centerCell}>
                          {String(row.is_active) === "1" ? "ใช้งาน" : "ปิด"}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }} className="actionsCell">
                          <div className="actionButtons">
                            <button className="btn btn-edit" onClick={() => openChemEditModal(row)}>
                              แก้ไข
                            </button>
                            <button className="btn btn-delete" onClick={() => onDeleteChem(row)}>
                              ลบ
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Modal: Create Chemical */}
          {chemOpenCreate && (
            <div style={overlayStyle} onMouseDown={() => setChemOpenCreate(false)}>
              <div
                className="card"
                style={modalStyle}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 10,
                  }}
                >
                  <h2 style={{ margin: 0 }}>เพิ่มสารเคมี</h2>
                  <button className="btn ghost" onClick={() => setChemOpenCreate(false)}>
                    ปิด
                  </button>
                </div>

                <form onSubmit={submitChemCreate}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: 10,
                    }}
                  >
                    <div>
                      <label className="t-label">ชื่อสามัญ (ไทย/อังกฤษ) *</label>
                      <input
                        className="input"
                        name="common_name"
                        value={chemCreateForm.common_name}
                        onChange={onChangeChemCreate}
                        placeholder="เช่น แมนโคเซบ (Mancozeb)"
                      />
                    </div>

                    <div>
                      <label className="t-label">อัตราการใช้</label>
                      <input
                        className="input"
                        name="usage_rate"
                        value={chemCreateForm.usage_rate}
                        onChange={onChangeChemCreate}
                        placeholder="เช่น 2 กรัมต่อน้ำ 20 ลิตร"
                      />
                    </div>

                    <div>
                      <label className="t-label">กลุ่ม MOA</label>
                      <select
                        className="input"
                        name="moa_group_id"
                        value={String(chemCreateForm.moa_group_id ?? "")}
                        onChange={onChangeChemCreate}
                        disabled={chemMoaLoading}
                      >
                        <option value="">-- ไม่ระบุ --</option>
                        {chemMoaLoading && (
                          <option value="" disabled>
                            กำลังโหลดรายการ MOA...
                          </option>
                        )}
                        {chemMoaGroups.map((mg) => (
                          <option key={mg.moa_group_id} value={String(mg.moa_group_id)}>
                            {formatMoaOption(mg)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="t-label">สถานะ</label>
                      <select
                        className="input"
                        name="is_active"
                        value={chemCreateForm.is_active}
                        onChange={onChangeChemCreate}
                      >
                        <option value="1">ใช้งาน</option>
                        <option value="0">ปิดใช้งาน</option>
                      </select>
                    </div>

                    <div className="formActions" style={{ gridColumn: "1 / -1", marginTop: 6 }}>
                      <button
                        className="btnBase btnSave"
                        type="submit"
                        disabled={chemLoading}
                      >
                        บันทึก
                      </button>
                      <button
                        className="btnBase btnCancel"
                        type="button"
                        onClick={() => setChemOpenCreate(false)}
                        disabled={chemLoading}
                      >
                        ยกเลิก
                      </button>
                      
                      
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal: Edit Chemical */}
          {chemOpenEdit && (
            <div style={overlayStyle} onMouseDown={() => setChemOpenEdit(false)}>
              <div
                className="card"
                style={modalStyle}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 10,
                  }}
                >
                  <h2 style={{ margin: 0 }}>แก้ไขสารเคมี (ID: {chemEditForm.chemical_id})</h2>
                  <button className="btn ghost" onClick={() => setChemOpenEdit(false)}>
                    ปิด
                  </button>
                </div>

                <form onSubmit={submitChemEdit}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: 10,
                    }}
                  >
                    <div>
                      <label className="t-label">ชื่อสามัญ (ไทย/อังกฤษ) *</label>
                      <input
                        className="input"
                        name="common_name"
                        value={chemEditForm.common_name}
                        onChange={onChangeChemEdit}
                      />
                    </div>

                    <div>
                      <label className="t-label">อัตราการใช้</label>
                      <input
                        className="input"
                        name="usage_rate"
                        value={chemEditForm.usage_rate}
                        onChange={onChangeChemEdit}
                        placeholder="เช่น 2 กรัมต่อน้ำ 20 ลิตร"
                      />
                    </div>

                    <div>
                      <label className="t-label">กลุ่ม MOA</label>
                      <select
                        className="input"
                        name="moa_group_id"
                        value={String(chemEditForm.moa_group_id ?? "")}
                        onChange={onChangeChemEdit}
                        disabled={chemMoaLoading}
                      >
                        <option value="">-- ไม่ระบุ --</option>

                        {chemMoaLoading && (
                          <option value="" disabled>
                            กำลังโหลดรายการ MOA...
                          </option>
                        )}

                        {String(chemEditForm.moa_group_id || "").trim() !== "" &&
                          !chemMoaGroups.some(
                            (mg) => String(mg.moa_group_id) === String(chemEditForm.moa_group_id)
                          ) && (
                            <option value={String(chemEditForm.moa_group_id)}>
                              {`(ไม่พบในตาราง MOA) ID: ${chemEditForm.moa_group_id}`}
                            </option>
                          )}

                        {chemMoaGroups.map((mg) => (
                          <option key={mg.moa_group_id} value={String(mg.moa_group_id)}>
                            {formatMoaOption(mg)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="t-label">สถานะ</label>
                      <select
                        className="input"
                        name="is_active"
                        value={chemEditForm.is_active}
                        onChange={onChangeChemEdit}
                      >
                        <option value="1">ใช้งาน</option>
                        <option value="0">ปิดใช้งาน</option>
                      </select>
                    </div>

                    <div className="formActions" style={{ gridColumn: "1 / -1", marginTop: 6 }}>
                      <button
                        className="btnBase btnSave"
                        type="submit"
                        disabled={chemLoading}
                      >
                        บันทึก
                      </button>
                      <button
                        className="btnBase btnCancel"
                        type="button"
                        onClick={() => setChemOpenEdit(false)}
                        disabled={chemLoading}
                      >
                        ยกเลิก
                      </button>
                      
                      
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== TAB: MOA Groups ===== */}
      {tab === "moa" && (
        <>
          {moaError && <div className="alert error">{moaError}</div>}

          <div
            className="card"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
            }}
          >
            <select
              value={moaSystem}
              onChange={(e) => setMoaSystem(e.target.value)}
              style={{ minWidth: 220 }}
            >
              <option value="">-- ทุกระบบ (All Systems) --</option>
              {SYSTEM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <input
              placeholder="ค้นหา (system/code)"
              value={moaKeyword}
              onChange={(e) => setMoaKeyword(e.target.value)}
              style={{ flex: 1, minWidth: 200 }}
            />

            {moaSearching && (
              <span className="t-muted">กำลังโหลด...</span>
            )}

            <button className="btn ghost" onClick={() => setMoaKeyword("")}>
              รีเซ็ต
            </button>

            <button className="btn" onClick={openMoaCreateModal}>
              + เพิ่มกลุ่ม MOA
            </button>
          </div>

          <div className="card">
            {moaLoading ? (
              <div>กำลังโหลด...</div>
            ) : moaFilteredItems.length === 0 ? (
              <div>ไม่พบข้อมูลกลุ่ม MOA</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th style={centerCell}>ID</th>
                    <th style={centerCell}>System</th>
                    <th style={centerCell}>Code</th>
                    <th className="actionsHeader">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {moaFilteredItems.map((row) => (
                    <tr key={row.moa_group_id ?? row.moaGroupId}>
                      <td style={centerCell}>{row.moa_group_id ?? row.moaGroupId}</td>
                      <td style={centerCell}>{row.moa_system || "-"}</td>
                      <td style={centerCell}>{row.moa_code || "-"}</td>
                      <td style={{ whiteSpace: "nowrap" }} className="actionsCell">
                        <div className="actionButtons">
                          <button className="btn btn-edit" onClick={() => openMoaEditModal(row)}>
                            แก้ไข
                          </button>
                          <button className="btn btn-delete" onClick={() => onDeleteMoa(row)}>
                            ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Modal Create MOA */}
          {moaOpenCreate && (
            <div style={overlayStyle} onMouseDown={() => setMoaOpenCreate(false)}>
              <div
                className="card"
                style={modalStyle}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 10,
                  }}
                >
                  <h2 style={{ margin: 0 }}>เพิ่มกลุ่ม MOA</h2>
                  <button className="btn ghost" onClick={() => setMoaOpenCreate(false)}>
                    ปิด
                  </button>
                </div>

                <form onSubmit={submitMoaCreate}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: 10,
                    }}
                  >
                    <div>
                      <label className="t-label">ระบบ (moa_system) *</label>
                      <select
                        className="input"
                        name="moa_system"
                        value={moaCreateForm.moa_system}
                        onChange={onChangeMoaCreate}
                      >
                        {SYSTEM_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.value}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="t-label">รหัส (moa_code) *</label>
                      <input
                        className="input"
                        name="moa_code"
                        value={moaCreateForm.moa_code}
                        onChange={onChangeMoaCreate}
                        placeholder="เช่น 1A"
                      />
                    </div>

                    <div className="formActions" style={{ gridColumn: "1 / -1", marginTop: 6 }}>
                      <button
                        className="btnBase btnSave"
                        type="submit"
                        disabled={moaLoading}
                      >
                        บันทึก
                      </button>
                      <button
                        className="btnBase btnCancel"
                        type="button"
                        onClick={() => setMoaOpenCreate(false)}
                        disabled={moaLoading}
                      >
                        ยกเลิก
                      </button>
                      
                      
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal Edit MOA */}
          {moaOpenEdit && (
            <div style={overlayStyle} onMouseDown={() => setMoaOpenEdit(false)}>
              <div
                className="card"
                style={modalStyle}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 10,
                  }}
                >
                  <h2 style={{ margin: 0 }}>แก้ไขกลุ่ม MOA (ID: {moaEditForm.moa_group_id})</h2>
                  <button className="btn ghost" onClick={() => setMoaOpenEdit(false)}>
                    ปิด
                  </button>
                </div>

                <form onSubmit={submitMoaEdit}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: 10,
                    }}
                  >
                    <div>
                      <label className="t-label">ระบบ (moa_system) *</label>
                      <select
                        className="input"
                        name="moa_system"
                        value={moaEditForm.moa_system}
                        onChange={onChangeMoaEdit}
                      >
                        {SYSTEM_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.value}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="t-label">รหัส (moa_code) *</label>
                      <input
                        className="input"
                        name="moa_code"
                        value={moaEditForm.moa_code}
                        onChange={onChangeMoaEdit}
                        placeholder="เช่น 1A"
                      />
                    </div>

                    <div className="formActions" style={{ gridColumn: "1 / -1", marginTop: 6 }}>
                      <button
                        className="btnBase btnSave"
                        type="submit"
                        disabled={moaLoading}
                      >
                        บันทึก
                      </button>
                      <button
                        className="btnBase btnCancel"
                        type="button"
                        onClick={() => setMoaOpenEdit(false)}
                        disabled={moaLoading}
                      >
                        ยกเลิก
                      </button>
                      
                      
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
