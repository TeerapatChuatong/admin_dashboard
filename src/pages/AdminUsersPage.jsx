// src/pages/AdminUsersPage.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { readUsersApi } from "../api/readUsersApi";
import { searchUsersApi } from "../api/searchUsersApi";
import { deleteUserApi } from "../api/deleteUserApi";

import CreateUserModal from "../components/CreateUserModal";
import EditUserModal from "../components/EditUserModal";

// ✅ helper: เช็คว่าเป็น super admin หรือไม่ (รองรับทั้ง super admin / super_admin / ตัวใหญ่ตัวเล็ก)
function isSuperAdminUser(u) {
  if (!u || !u.role) return false;
  const raw = String(u.role).toLowerCase().trim();  // "super admin"
  const normalized = raw.replace(/[\s_]+/g, "");    // เอาช่องว่าง/underscore ออก → "superadmin"
  return normalized === "superadmin";
}

export default function AdminUsersPage() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const [openCreate, setOpenCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const data = await readUsersApi();
      const arr = Array.isArray(data) ? data : [];
      // ⬇️ กรอง super admin ออก
      setUsers(arr.filter((u) => !isSuperAdminUser(u)));
    } catch (err) {
      setError(err.message || "โหลดผู้ใช้ไม่สำเร็จ");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!keyword.trim()) {
      loadUsers();
      return;
    }

    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await searchUsersApi(keyword.trim());
        const arr = Array.isArray(data) ? data : [];
        if (!cancelled) {
          // ⬇️ ตรงผลค้นหาก็กรอง super admin ออกเหมือนกัน
          setUsers(arr.filter((u) => !isSuperAdminUser(u)));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "ค้นหาผู้ใช้ไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [keyword]);

  async function handleDelete(u) {
    if (!window.confirm("ยืนยันลบผู้ใช้นี้?")) return;
    setError("");
    try {
      await deleteUserApi(u.id);
      await loadUsers();
    } catch (err) {
      setError(err.message || "ลบผู้ใช้ไม่สำเร็จ");
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* ✅ ปุ่มกลับหน้าหลัก */}
          <a href="/admin" className="btn ghost">
            ← กลับหน้าหลัก
          </a>
          <h1 style={{ margin: 0 }}>จัดการผู้ใช้งาน</h1>
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

      <div
        className="card"
        style={{ display: "flex", gap: 8, alignItems: "center" }}
      >
        <input
          placeholder="ค้นหาจากชื่อผู้ใช้ / อีเมล"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ flex: 1 }}
        />
        {searching && (
          <span style={{ fontSize: 12, color: "#6b7280" }}>กำลังค้นหา...</span>
        )}
        <button className="btn ghost" onClick={() => setKeyword("")}>
          รีเซ็ต
        </button>
        <button className="btn" onClick={() => setOpenCreate(true)}>
          + เพิ่มผู้ใช้
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div>กำลังโหลด...</div>
        ) : users.length === 0 ? (
          <div>ไม่พบข้อมูลผู้ใช้งาน</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>ชื่อผู้ใช้</th>
                <th>อีเมล</th>
                <th>ประเภทผู้ใช้</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>
                    <button className="btn xs" onClick={() => setEditUser(u)}>
                      แก้ไข
                    </button>{" "}
                    <button
                      className="btn xs danger"
                      onClick={() => handleDelete(u)}
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {openCreate && (
        <CreateUserModal
          onClose={() => setOpenCreate(false)}
          onSuccess={async () => {
            setOpenCreate(false);
            await loadUsers();
          }}
        />
      )}

      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSuccess={async () => {
            setEditUser(null);
            await loadUsers();
          }}
        />
      )}
    </div>
  );
}
