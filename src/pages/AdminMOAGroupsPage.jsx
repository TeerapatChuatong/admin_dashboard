// src/pages/AdminMOAGroupsPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  readMoaGroupsApi,
  createMoaGroup,
  updateMoaGroup,
  deleteMoaGroup,
} from "../api/moaGroupsApi";

const SYSTEM_OPTIONS = [
  { value: "FRAC", label: "FRAC (สารป้องกันกำจัดเชื้อรา)" },
  { value: "IRAC", label: "IRAC (สารกำจัดแมลง)" },
  { value: "HRAC", label: "HRAC (สารกำจัดวัชพืช)" },
  { value: "OTHER", label: "อื่น ๆ" },
];

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 9999,
};

const modalStyle = {
  width: "min(920px, 100%)",
  maxHeight: "90vh",
  overflow: "auto",
};

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function toStr(v) {
  return v == null ? "" : String(v);
}

export default function AdminMOAGroupsPage() {
  const { user, logout } = useAuth();

  const centerCell = { textAlign: "center", verticalAlign: "middle" };

  const [items, setItems] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [moaSystem, setMoaSystem] = useState("");

  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  const [createForm, setCreateForm] = useState({
    moa_system: "FRAC",
    moa_code: "",
    group_name: "",
    description: "",
  });

  const [editForm, setEditForm] = useState({
    moa_group_id: "",
    moa_system: "FRAC",
    moa_code: "",
    group_name: "",
    description: "",
  });

  const firstLoadRef = useRef(true);

  async function fetchList({ forceLoading = false } = {}) {
    if (forceLoading) setLoading(true);
    setError("");

    try {
      // ให้ backend filter ด้วย moa_system ได้ (ถ้า backend รองรับ)
      const data = await readMoaGroupsApi({
        moa_system: moaSystem || null,
      });

      setItems(normalizeList(data));
    } catch (err) {
      setError(err?.message || "โหลดรายการกลุ่ม MOA ไม่สำเร็จ");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  // debounce เหมือนหน้า Questions/Chemicals: เปลี่ยน filter/keyword แล้วค่อยรีเฟรช
  // หมายเหตุ: keyword เราจะกรองฝั่งหน้าเว็บเพื่อไม่บังคับว่าต้องมี search endpoint
  useEffect(() => {
    let cancelled = false;

    const isFirst = firstLoadRef.current;
    if (isFirst) {
      firstLoadRef.current = false;
      fetchList({ forceLoading: true });
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      if (cancelled) return;
      try {
        await fetchList({ forceLoading: false });
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moaSystem]);

  // client-side filter ด้วย keyword
  const filteredItems = items.filter((row) => {
    const q = keyword.trim().toLowerCase();
    if (!q) return true;

    const hay = [
      row?.moa_system,
      row?.moa_code,
      row?.group_name,
      row?.description,
    ]
      .map((x) => toStr(x).toLowerCase())
      .join(" | ");

    return hay.includes(q);
  });

  function openCreateModal() {
    setError("");
    setCreateForm({
      moa_system: moaSystem || "FRAC",
      moa_code: "",
      group_name: "",
      description: "",
    });
    setOpenCreate(true);
  }

  function openEditModal(row) {
    setError("");
    setEditForm({
      moa_group_id: row?.moa_group_id ?? row?.moaGroupId ?? "",
      moa_system: row?.moa_system ?? "FRAC",
      moa_code: row?.moa_code ?? "",
      group_name: row?.group_name ?? "",
      description: row?.description ?? "",
    });
    setOpenEdit(true);
  }

  function onChangeCreate(e) {
    const { name, value } = e.target;
    setCreateForm((s) => ({ ...s, [name]: value }));
  }

  function onChangeEdit(e) {
    const { name, value } = e.target;
    setEditForm((s) => ({ ...s, [name]: value }));
  }

  async function submitCreate(e) {
    e.preventDefault();
    setError("");

    const moa_system = (createForm.moa_system || "").trim();
    const moa_code = (createForm.moa_code || "").trim();
    if (!moa_system) return setError("กรุณาเลือก/กรอก moa_system");
    if (!moa_code) return setError("กรุณากรอก moa_code (เช่น 1A)");

    const payload = {
      moa_system,
      moa_code,
      group_name: (createForm.group_name || "").trim() || null,
      description: (createForm.description || "").trim() || null,
    };

    try {
      setLoading(true);
      await createMoaGroup(payload);
      setOpenCreate(false);
      await fetchList({ forceLoading: true });
    } catch (err) {
      setError(err?.message || "เพิ่มกลุ่ม MOA ไม่สำเร็จ");
      setLoading(false);
    }
  }

  async function submitEdit(e) {
    e.preventDefault();
    setError("");

    const moa_group_id = editForm.moa_group_id;
    const moa_system = (editForm.moa_system || "").trim();
    const moa_code = (editForm.moa_code || "").trim();
    if (!moa_group_id) return setError("ไม่พบ moa_group_id");
    if (!moa_system) return setError("กรุณาเลือก/กรอก moa_system");
    if (!moa_code) return setError("กรุณากรอก moa_code (เช่น 1A)");

    const payload = {
      moa_group_id: Number(moa_group_id),
      moa_system,
      moa_code,
      group_name: (editForm.group_name || "").trim() || null,
      description: (editForm.description || "").trim() || null,
    };

    try {
      setLoading(true);
      await updateMoaGroup(payload);
      setOpenEdit(false);
      await fetchList({ forceLoading: true });
    } catch (err) {
      setError(err?.message || "แก้ไขกลุ่ม MOA ไม่สำเร็จ");
      setLoading(false);
    }
  }

  async function onDelete(row) {
    const id = row?.moa_group_id ?? row?.moaGroupId;
    if (!id) return;

    if (!window.confirm("ยืนยันลบกลุ่ม MOA นี้?")) return;

    setError("");
    try {
      setLoading(true);
      await deleteMoaGroup(Number(id));
      await fetchList({ forceLoading: true });
    } catch (err) {
      setError(err?.message || "ลบกลุ่ม MOA ไม่สำเร็จ");
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="/admin" className="btn ghost">
            ← กลับหน้าหลัก
          </a>
          <h1 style={{ margin: 0 }}>จัดการกลุ่ม MOA</h1>
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

      {error && <div className="alert error">{error}</div>}

      {/* แถบ filter + search */}
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
          placeholder="ค้นหา (system/code/name/description)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />

        {searching && (
          <span style={{ fontSize: 12, color: "#6b7280" }}>กำลังโหลด...</span>
        )}

        <button className="btn ghost" onClick={() => setKeyword("")}>
          รีเซ็ต
        </button>

        <button className="btn" onClick={openCreateModal}>
          + เพิ่มกลุ่ม MOA
        </button>
      </div>

      {/* ตาราง */}
      <div className="card">
        {loading ? (
          <div>กำลังโหลด...</div>
        ) : filteredItems.length === 0 ? (
          <div>ไม่พบข้อมูลกลุ่ม MOA</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={centerCell}>ID</th>
                <th style={centerCell}>System</th>
                <th style={centerCell}>Code</th>
                <th>ชื่อกลุ่ม</th>
                <th>คำอธิบาย</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((row) => (
                <tr key={row.moa_group_id ?? row.moaGroupId}>
                  <td style={centerCell}>{row.moa_group_id ?? row.moaGroupId}</td>
                  <td style={centerCell}>{row.moa_system || "-"}</td>
                  <td style={centerCell}>{row.moa_code || "-"}</td>
                  <td style={{ whiteSpace: "pre-wrap" }}>
                    {row.group_name || "-"}
                  </td>
                  <td style={{ whiteSpace: "pre-wrap" }}>
                    {row.description || "-"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button
                      className="btn xs"
                      onClick={() => openEditModal(row)}
                      style={{ marginRight: 6 }}
                    >
                      แก้ไข
                    </button>
                    <button className="btn xs ghost" onClick={() => onDelete(row)}>
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Create */}
      {openCreate && (
        <div style={overlayStyle} onMouseDown={() => setOpenCreate(false)}>
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
              <button className="btn ghost" onClick={() => setOpenCreate(false)}>
                ปิด
              </button>
            </div>

            <form onSubmit={submitCreate}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 10,
                }}
              >
                <div>
                  <label style={{ fontSize: 13 }}>ระบบ (moa_system) *</label>
                  <select
                    className="input"
                    name="moa_system"
                    value={createForm.moa_system}
                    onChange={onChangeCreate}
                  >
                    {SYSTEM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.value}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 13 }}>รหัส (moa_code) *</label>
                  <input
                    className="input"
                    name="moa_code"
                    value={createForm.moa_code}
                    onChange={onChangeCreate}
                    placeholder="เช่น 1A"
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 13 }}>ชื่อกลุ่ม (group_name)</label>
                  <input
                    className="input"
                    name="group_name"
                    value={createForm.group_name}
                    onChange={onChangeCreate}
                    placeholder="เช่น FRAC 1A"
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 13 }}>คำอธิบาย (description)</label>
                  <textarea
                    className="input"
                    name="description"
                    value={createForm.description}
                    onChange={onChangeCreate}
                    placeholder="ใส่รายละเอียดเพิ่มเติม..."
                    rows={3}
                    style={{ width: "100%" }}
                  />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" type="submit" disabled={loading}>
                    บันทึก
                  </button>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => setOpenCreate(false)}
                    disabled={loading}
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit */}
      {openEdit && (
        <div style={overlayStyle} onMouseDown={() => setOpenEdit(false)}>
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
              <h2 style={{ margin: 0 }}>
                แก้ไขกลุ่ม MOA (ID: {editForm.moa_group_id})
              </h2>
              <button className="btn ghost" onClick={() => setOpenEdit(false)}>
                ปิด
              </button>
            </div>

            <form onSubmit={submitEdit}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 10,
                }}
              >
                <div>
                  <label style={{ fontSize: 13 }}>ระบบ (moa_system) *</label>
                  <select
                    className="input"
                    name="moa_system"
                    value={editForm.moa_system}
                    onChange={onChangeEdit}
                  >
                    {SYSTEM_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.value}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 13 }}>รหัส (moa_code) *</label>
                  <input
                    className="input"
                    name="moa_code"
                    value={editForm.moa_code}
                    onChange={onChangeEdit}
                    placeholder="เช่น 1A"
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 13 }}>ชื่อกลุ่ม (group_name)</label>
                  <input
                    className="input"
                    name="group_name"
                    value={editForm.group_name}
                    onChange={onChangeEdit}
                    placeholder="เช่น FRAC 1A"
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 13 }}>คำอธิบาย (description)</label>
                  <textarea
                    className="input"
                    name="description"
                    value={editForm.description}
                    onChange={onChangeEdit}
                    placeholder="ใส่รายละเอียดเพิ่มเติม..."
                    rows={3}
                    style={{ width: "100%" }}
                  />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" type="submit" disabled={loading}>
                    บันทึก
                  </button>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => setOpenEdit(false)}
                    disabled={loading}
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
