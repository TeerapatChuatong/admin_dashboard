// src/pages/AdminUsersPage.jsx
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { readUsersApi } from "../api/readUsersApi";
import { searchUsersApi } from "../api/searchUsersApi";
import { deleteUserApi } from "../api/deleteUserApi";

import CreateUserModal from "../components/CreateUserModal";
import EditUserModal from "../components/EditUserModal";

export default function AdminUsersPage() {
  const { user, logout } = useAuth();

  const [users, setUsers] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);    // โหลดครั้งแรก / รีเฟรชใหญ่
  const [searching, setSearching] = useState(false); // ค้นหาแบบ live
  const [error, setError] = useState("");

  const [openCreate, setOpenCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);

  // โหลดทั้งหมด (ใช้ตอนเปิดหน้า + รีเฟรชใหญ่)
  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const list = await readUsersApi();
      setUsers(list);
    } catch (err) {
      setError(err.message || "โหลดข้อมูลผู้ใช้ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  // โหลดรอบแรก
  useEffect(() => {
    loadUsers();
  }, []);

  // ✅ Live search: พิมพ์แล้วค้นหาแบบสมูท
  useEffect(() => {
    const q = keyword.trim();

    // ถ้าว่าง → แสดงทั้งหมด แต่ไม่ต้องโชว์ "กำลังโหลด..." ใหญ่
    if (q === "") {
      let cancelled = false;
      setSearching(true);
      (async () => {
        try {
          const list = await readUsersApi();
          if (!cancelled) setUsers(list);
        } catch (err) {
          if (!cancelled) {
            setError(err.message || "โหลดข้อมูลผู้ใช้ไม่สำเร็จ");
          }
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
      return;
    }

    // มีคำค้น → debounce 400ms แล้วค่อยยิง search
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      setError("");
      try {
        const list = await searchUsersApi(q);
        if (!cancelled) setUsers(list);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "ค้นหาไม่สำเร็จ");
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

  function startEdit(u) {
    if (u.role === "super_admin") {
      alert("ไม่สามารถแก้ไขข้อมูลของ super admin ผ่านหน้านี้ได้");
      return;
    }
    setEditUser(u);
  }

  async function handleDelete(id, role) {
    if (role === "super_admin") {
      alert("ไม่สามารถลบ super admin ได้");
      return;
    }
    if (!window.confirm("ยืนยันลบผู้ใช้นี้?")) return;

    setError("");
    try {
      await deleteUserApi(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError(err.message || "ลบไม่สำเร็จ");
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>จัดการผู้ใช้งาน</h1>
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

      {/* แถวค้นหา + ปุ่มเพิ่ม */}
      <div className="card">
        <div className="form-row" style={{ alignItems: "center" }}>
          <input
            type="text"
            placeholder="ค้นหาจากชื่อผู้ใช้ / อีเมล"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />

          {/* แสดงสถานะค้นหาแบบเบา ๆ ไม่กระตุกจอ */}
          {searching && (
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              กำลังค้นหา...
            </span>
          )}

          <button
            type="button"
            className="btn ghost"
            onClick={() => setKeyword("")}
          >
            รีเซ็ต
          </button>

          <div style={{ flex: 1 }} />

          <button
            type="button"
            className="btn"
            onClick={() => setOpenCreate(true)}
          >
            + เพิ่มผู้ใช้
          </button>
        </div>
      </div>

      {/* ตารางผู้ใช้งาน */}
      <div className="card">
        <h2>รายการผู้ใช้งาน</h2>
        {loading ? (
          <p>กำลังโหลด...</p>
        ) : users.length === 0 ? (
          <p>ไม่มีข้อมูลผู้ใช้งาน</p>
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
              {users.map((u) => {
                const isSuperAdmin = u.role === "super admin";
                return (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td>{u.username}</td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>
                      {isSuperAdmin ? (
                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                          super admin
                        </span>
                      ) : (
                        <>
                          <button
                            className="btn xs"
                            type="button"
                            onClick={() => startEdit(u)}
                          >
                            แก้ไข
                          </button>
                          <button
                            className="btn xs danger"
                            type="button"
                            onClick={() => handleDelete(u.id, u.role)}
                          >
                            ลบ
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: เพิ่มผู้ใช้ */}
      {openCreate && (
        <CreateUserModal
          onClose={() => setOpenCreate(false)}
          onSuccess={async () => {
            setOpenCreate(false);
            await loadUsers();
          }}
        />
      )}

      {/* Modal: แก้ไขผู้ใช้ */}
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
