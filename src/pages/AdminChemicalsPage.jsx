// src/pages/AdminChemicalsPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  readChemicalsApi,
  searchChemicals,
  createChemical,
  updateChemical,
  deleteChemical,
} from "../api/chemicalsApi";
import { readMoaGroupsApi } from "../api/moaGroupsApi";

const TARGET_OPTIONS = [
  { value: "fungicide", label: "สารป้องกันกำจัดเชื้อรา (fungicide)" },
  { value: "bactericide", label: "สารป้องกันกำจัดแบคทีเรีย (bactericide)" },
  { value: "insecticide", label: "สารกำจัดแมลง (insecticide)" },
  { value: "other", label: "อื่น ๆ (other)" },
];

const TARGET_LABELS = TARGET_OPTIONS.reduce((acc, o) => {
  acc[o.value] = o.label;
  return acc;
}, {});

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

export default function AdminChemicalsPage() {
  const { user, logout } = useAuth();

  const centerCell = { textAlign: "center", verticalAlign: "middle" };

  const [items, setItems] = useState([]);
  const [moaGroups, setMoaGroups] = useState([]);
  const [moaLoading, setMoaLoading] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [targetType, setTargetType] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  const [createForm, setCreateForm] = useState({
    trade_name: "",
    active_ingredient: "",
    target_type: "other",
    moa_group_id: "",
    notes: "",
    is_active: "1",
  });

  const [editForm, setEditForm] = useState({
    chemical_id: "",
    trade_name: "",
    active_ingredient: "",
    target_type: "other",
    moa_group_id: "",
    notes: "",
    is_active: "1",
  });

  const firstLoadRef = useRef(true);

  function formatMoaOption(mg) {
    const sys = (mg?.moa_system || "").trim();
    const code = (mg?.moa_code || "").trim();
    const name = (mg?.group_name || "").trim();
    const left = [sys, code].filter(Boolean).join(" ").trim();
    if (left && name && name !== left) return `${left} - ${name}`;
    return left || name || `ID ${mg?.moa_group_id}`;
  }

  // ✅ โหลดรายการ MOA groups สำหรับ dropdown (Create/Edit)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setMoaLoading(true);
      try {
        const data = await readMoaGroupsApi({});
        if (!cancelled) setMoaGroups(normalizeList(data));
      } catch {
        if (!cancelled) setMoaGroups([]);
      } finally {
        if (!cancelled) setMoaLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function fetchList({ forceLoading = false } = {}) {
    const q = keyword.trim();
    const filters = {
      target_type: targetType || null,
    };

    if (forceLoading) setLoading(true);
    setError("");

    try {
      const data = q
        ? await searchChemicals(q, filters)
        : await readChemicalsApi(filters);

      setItems(normalizeList(data));
    } catch (err) {
      setError(err?.message || "โหลดรายการสารเคมีไม่สำเร็จ");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  // เหมือนหน้า Questions: เปลี่ยน filter/keyword แล้ว debounce ค้นหา
  useEffect(() => {
    let cancelled = false;

    // ครั้งแรกให้เป็น loading
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
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, targetType]);

  function openCreateModal() {
    setError("");
    setCreateForm({
      trade_name: "",
      active_ingredient: "",
      target_type: targetType || "other",
      moa_group_id: "",
      notes: "",
      is_active: "1",
    });
    setOpenCreate(true);
  }

  function openEditModal(row) {
    setError("");
    setEditForm({
      chemical_id: row?.chemical_id ?? "",
      trade_name: row?.trade_name ?? "",
      active_ingredient: row?.active_ingredient ?? "",
      target_type: row?.target_type ?? "other",
      moa_group_id: row?.moa_group_id ?? "",
      notes: row?.notes ?? "",
      is_active: String(row?.is_active ?? 1),
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

    const trade_name = (createForm.trade_name || "").trim();
    if (!trade_name) {
      setError("กรุณากรอกชื่อการค้า (trade_name)");
      return;
    }

    const payload = {
      trade_name,
      active_ingredient: (createForm.active_ingredient || "").trim() || null,
      target_type: createForm.target_type || "other",
      moa_group_id:
        String(createForm.moa_group_id || "").trim() === ""
          ? null
          : Number(createForm.moa_group_id),
      notes: (createForm.notes || "").trim() || null,
      is_active: createForm.is_active === "0" ? 0 : 1,
    };

    try {
      setLoading(true);
      await createChemical(payload);
      setOpenCreate(false);
      await fetchList({ forceLoading: true });
    } catch (err) {
      setError(err?.message || "เพิ่มสารเคมีไม่สำเร็จ");
      setLoading(false);
    }
  }

  async function submitEdit(e) {
    e.preventDefault();
    setError("");

    const trade_name = (editForm.trade_name || "").trim();
    if (!trade_name) {
      setError("กรุณากรอกชื่อการค้า (trade_name)");
      return;
    }

    const payload = {
      chemical_id: editForm.chemical_id,
      trade_name,
      active_ingredient: (editForm.active_ingredient || "").trim() || null,
      target_type: editForm.target_type || "other",
      moa_group_id:
        String(editForm.moa_group_id || "").trim() === ""
          ? null
          : Number(editForm.moa_group_id),
      notes: (editForm.notes || "").trim() || null,
      is_active: editForm.is_active === "0" ? 0 : 1,
    };

    try {
      setLoading(true);
      await updateChemical(payload);
      setOpenEdit(false);
      await fetchList({ forceLoading: true });
    } catch (err) {
      setError(err?.message || "แก้ไขสารเคมีไม่สำเร็จ");
      setLoading(false);
    }
  }

  async function onDelete(row) {
    const id = row?.chemical_id;
    if (!id) return;

    if (!window.confirm("ยืนยันลบสารเคมีนี้?")) return;

    setError("");
    try {
      setLoading(true);
      await deleteChemical(id);
      await fetchList({ forceLoading: true });
    } catch (err) {
      setError(err?.message || "ลบสารเคมีไม่สำเร็จ");
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
          <h1 style={{ margin: 0 }}>จัดการสารเคมี</h1>
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

      {/* แถบ filter ด้านบน: เลือกประเภท + ค้นหา */}
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
          value={targetType}
          onChange={(e) => setTargetType(e.target.value)}
          style={{ minWidth: 200 }}
        >
          <option value="">-- ทุกประเภท --</option>
          {TARGET_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <input
          placeholder="ค้นหาสารเคมี (ชื่อการค้า/ตัวยา/MOA)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ flex: 1, minWidth: 180 }}
        />

        {searching && (
          <span style={{ fontSize: 12, color: "#6b7280" }}>กำลังค้นหา...</span>
        )}

        <button className="btn ghost" onClick={() => setKeyword("")}>
          รีเซ็ต
        </button>

        <button className="btn" onClick={openCreateModal}>
          + เพิ่มสารเคมี
        </button>
      </div>

      {/* ตารางสารเคมี */}
      <div className="card">
        {loading ? (
          <div>กำลังโหลด...</div>
        ) : items.length === 0 ? (
          <div>ไม่พบข้อมูลสารเคมี</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={centerCell}>ID</th>
                <th>ชื่อการค้า</th>
                <th>ตัวยาสำคัญ</th>
                <th style={centerCell}>ประเภท</th>
                <th style={centerCell}>MOA</th>
                <th>หมายเหตุ</th>
                <th style={centerCell}>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>

            <tbody>
              {items.map((row) => {
                const moaText =
                  row.moa_code || row.moa_group_name
                    ? `${row.moa_code ?? ""}${
                        row.moa_group_name ? ` - ${row.moa_group_name}` : ""
                      }`
                    : row.moa_group_id ?? "-";

                return (
                  <tr key={row.chemical_id}>
                    <td style={centerCell}>{row.chemical_id}</td>
                    <td style={{ whiteSpace: "pre-wrap" }}>{row.trade_name}</td>
                    <td style={{ whiteSpace: "pre-wrap" }}>
                      {row.active_ingredient || "-"}
                    </td>
                    <td style={centerCell}>
                      {TARGET_LABELS[row.target_type] || row.target_type || "-"}
                    </td>
                    <td style={centerCell}>{moaText || "-"}</td>
                    <td style={{ whiteSpace: "pre-wrap" }}>{row.notes || "-"}</td>
                    <td style={centerCell}>
                      {String(row.is_active) === "1" ? "ใช้งาน" : "ปิด"}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button
                        className="btn xs"
                        onClick={() => openEditModal(row)}
                        style={{ marginRight: 6 }}
                      >
                        แก้ไข
                      </button>
                      <button
                        className="btn xs ghost"
                        onClick={() => onDelete(row)}
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Create */}
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
              <h2 style={{ margin: 0 }}>เพิ่มสารเคมี</h2>
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
                  <label style={{ fontSize: 13 }}>ชื่อการค้า (trade_name) *</label>
                  <input
                    className="input"
                    name="trade_name"
                    value={createForm.trade_name}
                    onChange={onChangeCreate}
                    placeholder="เช่น แมนโคเซบ"
                  />
                </div>

                <div>
                  <label style={{ fontSize: 13 }}>
                    ตัวยาสำคัญ (active_ingredient)
                  </label>
                  <input
                    className="input"
                    name="active_ingredient"
                    value={createForm.active_ingredient}
                    onChange={onChangeCreate}
                    placeholder="เช่น Mancozeb 80% WP"
                  />
                </div>

                <div>
                  <label style={{ fontSize: 13 }}>ประเภท (target_type)</label>
                  <select
                    className="input"
                    name="target_type"
                    value={createForm.target_type}
                    onChange={onChangeCreate}
                  >
                    {TARGET_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ✅ dropdown จากตาราง moa_groups */}
                <div>
                  <label style={{ fontSize: 13 }}>
                    MOA group id (moa_group_id)
                  </label>
                  <select
                    className="input"
                    name="moa_group_id"
                    value={String(createForm.moa_group_id ?? "")}
                    onChange={onChangeCreate}
                    disabled={moaLoading}
                  >
                    <option value="">-- ไม่ระบุ --</option>
                    {moaLoading && (
                      <option value="" disabled>
                        กำลังโหลดรายการ MOA...
                      </option>
                    )}
                    {moaGroups.map((mg) => (
                      <option
                        key={mg.moa_group_id}
                        value={String(mg.moa_group_id)}
                      >
                        {formatMoaOption(mg)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 13 }}>สถานะ</label>
                  <select
                    className="input"
                    name="is_active"
                    value={createForm.is_active}
                    onChange={onChangeCreate}
                  >
                    <option value="1">ใช้งาน</option>
                    <option value="0">ปิดใช้งาน</option>
                  </select>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 13 }}>หมายเหตุ (notes)</label>
                  <textarea
                    className="input"
                    name="notes"
                    value={createForm.notes}
                    onChange={onChangeCreate}
                    placeholder="ใส่หมายเหตุเพิ่มเติม..."
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

      {/* Modal: Edit */}
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
                แก้ไขสารเคมี (ID: {editForm.chemical_id})
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
                  <label style={{ fontSize: 13 }}>ชื่อการค้า (trade_name) *</label>
                  <input
                    className="input"
                    name="trade_name"
                    value={editForm.trade_name}
                    onChange={onChangeEdit}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 13 }}>
                    ตัวยาสำคัญ (active_ingredient)
                  </label>
                  <input
                    className="input"
                    name="active_ingredient"
                    value={editForm.active_ingredient}
                    onChange={onChangeEdit}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 13 }}>ประเภท (target_type)</label>
                  <select
                    className="input"
                    name="target_type"
                    value={editForm.target_type}
                    onChange={onChangeEdit}
                  >
                    {TARGET_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ✅ dropdown จากตาราง moa_groups */}
                <div>
                  <label style={{ fontSize: 13 }}>
                    MOA group id (moa_group_id)
                  </label>
                  <select
                    className="input"
                    name="moa_group_id"
                    value={String(editForm.moa_group_id ?? "")}
                    onChange={onChangeEdit}
                    disabled={moaLoading}
                  >
                    <option value="">-- ไม่ระบุ --</option>
                    {moaLoading && (
                      <option value="" disabled>
                        กำลังโหลดรายการ MOA...
                      </option>
                    )}

                    {/* ถ้าเคยผูกไว้ แต่รายการ MOA ปัจจุบันไม่พบ ให้ยังแสดงค่าเดิม */}
                    {String(editForm.moa_group_id || "").trim() !== "" &&
                      !moaGroups.some(
                        (mg) =>
                          String(mg.moa_group_id) ===
                          String(editForm.moa_group_id)
                      ) && (
                        <option value={String(editForm.moa_group_id)}>
                          {`(ไม่พบในตาราง MOA) ID: ${editForm.moa_group_id}`}
                        </option>
                      )}

                    {moaGroups.map((mg) => (
                      <option
                        key={mg.moa_group_id}
                        value={String(mg.moa_group_id)}
                      >
                        {formatMoaOption(mg)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 13 }}>สถานะ</label>
                  <select
                    className="input"
                    name="is_active"
                    value={editForm.is_active}
                    onChange={onChangeEdit}
                  >
                    <option value="1">ใช้งาน</option>
                    <option value="0">ปิดใช้งาน</option>
                  </select>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: 13 }}>หมายเหตุ (notes)</label>
                  <textarea
                    className="input"
                    name="notes"
                    value={editForm.notes}
                    onChange={onChangeEdit}
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
