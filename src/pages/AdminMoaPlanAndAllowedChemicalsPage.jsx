// src/pages/AdminMoaPlanAndAllowedChemicalsPage.jsx
// รวมหน้า: AdminMoaRotationPlanPage + AdminAllowedChemicalsPerGroupPage
// (รวม UI + ฟังก์ชันจริง ไม่ได้ import สองหน้าเข้าด้วยกัน)

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";

import { apiFetch } from "../api/_baseApi";
import { readDiseaseRiskLevels } from "../api/diseaseRiskLevelsApi";
import { readMoaGroups } from "../api/moaGroupsApi";
import { readRiskLevelMoaPlan, saveRiskLevelMoaPlan } from "../api/riskLevelMoaPlanApi";
import {
  readRiskLevelMoaChemicals,
  createRiskLevelMoaChemical,
  updateRiskLevelMoaChemical,
  deleteRiskLevelMoaChemical,
} from "../api/riskLevelMoaChemicalsApi";

import * as chemicalsApi from "../api/chemicalsApi";
// ---------- helpers ----------
function unwrapList(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (typeof res === "object" && res !== null) {
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray(res.rows)) return res.rows;
    if (Array.isArray(res.items)) return res.items;
  }
  return [];
}

function toInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toStr(v) {
  return v == null ? "" : String(v);
}

function diseaseNameFromRow(d) {
  return (
    d?.disease_name_th ||
    d?.disease_th ||
    d?.disease_name ||
    d?.disease_name_en ||
    d?.disease_en ||
    d?.name ||
    ""
  );
}

function chemicalNameFromRow(c) {
  return (
    c?.trade_name ||
    c?.chemical_name ||
    c?.name_th ||
    c?.name ||
    c?.active_ingredient ||
    c?.activeIngredient ||
    null
  );
}



export default function AdminMoaPlanAndAllowedChemicalsPage() {
  // ---------- master data ----------
  const [diseases, setDiseases] = useState([]);
  const [riskLevels, setRiskLevels] = useState([]);
  const [moaGroupsAll, setMoaGroupsAll] = useState([]);
  const [chemicalsMini, setChemicalsMini] = useState([]);

  // ---------- selection ----------
  // ✅ เลือกโรค (ไม่ต้องแบ่งระดับ) -> จะ sync แผน/สารที่อนุญาตไปทุก risk_level ของโรคนี้
  const [diseaseId, setDiseaseId] = useState("");
  const [moaSystem, setMoaSystem] = useState("FRAC");
  const [tab, setTab] = useState("plan"); // plan | allowed


  // ---------- rotation plan state ----------
  const [planRows, setPlanRows] = useState([]);
  const [deletedPlanIds, setDeletedPlanIds] = useState([]);

  // modal add group
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addMoaGroupId, setAddMoaGroupId] = useState("");
  const [addPriority, setAddPriority] = useState("");

  // modal edit group (แก้ไขลำดับ) ในแผน
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editPlanRow, setEditPlanRow] = useState(null);
  const [editPriority, setEditPriority] = useState("");

  // auto sync แผนไปทุกระดับของโรค (แทนปุ่ม "บันทึกแผน")
  const planLoadedRef = useRef(false);
  const planDirtyRef = useRef(false);


  // ---------- allowed chemicals state ----------
  const [allowed, setAllowed] = useState([]);
  const [showAddAllowed, setShowAddAllowed] = useState(false);
  const [showEditAllowed, setShowEditAllowed] = useState(false);


  const [addAllowedForm, setAddAllowedForm] = useState({
    moaGroupId: "",
    chemicalId: "",
    priority: 1,
  });

  const [editAllowedOrigin, setEditAllowedOrigin] = useState(null); // {moaGroupId, chemicalId}
  const [editAllowedForm, setEditAllowedForm] = useState({
    id: "",
    moaGroupId: "",
    chemicalId: "",
    priority: 1,
  });

  // ---------- ui state ----------
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [loadingAllowed, setLoadingAllowed] = useState(false);
  const [savingAllowed, setSavingAllowed] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // ป้องกัน modal ค้างเวลาสลับแท็บ
    setIsAddOpen(false);
    setIsEditOpen(false);
    setShowAddAllowed(false);
    setShowEditAllowed(false);
  }, [tab]);


  // ---------- maps ----------
  const diseaseNameById = useMemo(() => {
    const m = new Map();
    (diseases || []).forEach((d) => {
      const id = Number(d?.disease_id);
      const name = diseaseNameFromRow(d);
      if (!Number.isNaN(id)) m.set(id, String(name || "").trim());
    });
    return m;
  }, [diseases]);

  const moaGroupById = useMemo(() => {
    const m = new Map();
    (moaGroupsAll || []).forEach((g) => {
      const id = Number(g?.moa_group_id);
      if (!Number.isNaN(id)) m.set(id, g);
    });
    return m;
  }, [moaGroupsAll]);

  const chemicalById = useMemo(() => {
    const m = new Map();
    (chemicalsMini || []).forEach((c) => {
      const id = Number(c?.chemical_id ?? c?.id);
      if (!Number.isNaN(id)) m.set(id, c);
    });
    return m;
  }, [chemicalsMini]);



  const chemicalOptions = useMemo(() => {
    return (chemicalsMini || [])
      .slice()
      .map((c) => {
        const id = c?.chemical_id ?? c?.id;
        return { value: String(id), label: chemicalNameFromRow(c) || `ID ${id}` };
      })
      .filter((o) => o.value && o.value !== "undefined" && o.value !== "null")
      .sort((a, b) => String(a.label).localeCompare(String(b.label)));
  }, [chemicalsMini]);

  // ---------- derived: risk levels of selected disease ----------
  const riskLevelsForDisease = useMemo(() => {
    const did = Number(diseaseId);
    if (!did) return [];
    return (riskLevels || [])
      .filter((rl) => Number(rl?.disease_id) === did)
      .slice()
      .sort((a, b) => Number(a?.risk_level_id) - Number(b?.risk_level_id));
  }, [riskLevels, diseaseId]);

  const diseaseRiskLevelIds = useMemo(
    () => riskLevelsForDisease.map((rl) => Number(rl?.risk_level_id)).filter((x) => Number.isFinite(x)),
    [riskLevelsForDisease]
  );

  const anchorRiskLevelId = useMemo(() => {
    if (!diseaseRiskLevelIds.length) return "";
    return String(diseaseRiskLevelIds[0]);
  }, [diseaseRiskLevelIds]);

  // ---------- MOA systems options ----------
  const moaSystemOptions = useMemo(() => {
    const set = new Set();
    (moaGroupsAll || []).forEach((g) => {
      const s = String(g?.moa_system || "").trim().toUpperCase();
      if (s) set.add(s);
    });
    const arr = Array.from(set);
    if (arr.length) return arr.sort();
    return ["FRAC", "IRAC"];
  }, [moaGroupsAll]);

  // ensure moaSystem is valid when options loaded
  useEffect(() => {
    if (!moaSystemOptions.length) return;
    const cur = String(moaSystem || "").toUpperCase();
    if (!moaSystemOptions.includes(cur)) setMoaSystem(moaSystemOptions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moaSystemOptions.join("|")]);

  // ---------- plan filtering ----------
  const planVisible = useMemo(() => {
    const sys = String(moaSystem).toUpperCase();
    const sorted = (planRows || []).slice().sort((a, b) => Number(a?.priority) - Number(b?.priority));

    const anyHasSystem = sorted.some((r) => {
      const g = moaGroupById.get(Number(r?.moa_group_id));
      const rowSys = String(r?.moa_system || g?.moa_system || "").toUpperCase();
      return !!rowSys;
    });
    if (!anyHasSystem) return sorted;

    return sorted.filter((r) => {
      const g = moaGroupById.get(Number(r?.moa_group_id));
      const rowSys = String(r?.moa_system || g?.moa_system || "").toUpperCase();
      return rowSys === sys;
    });
  }, [planRows, moaSystem, moaGroupById]);

  const planSorted = useMemo(() => {
    return (planVisible || [])
      .slice()
      .sort((a, b) => Number(a?.priority) - Number(b?.priority))
      .map((r) => {
        const gid = Number(r?.moa_group_id);
        const g = moaGroupById.get(gid);
        return {
          ...r,
          moa_group_id: gid,
          moa_code: r?.moa_code ?? g?.moa_code ?? "",
          moa_group_name: r?.moa_group_name ?? g?.group_name ?? g?.moa_group_name ?? "",
        };
      });
  }, [planVisible, moaGroupById]);

  // allowed filter by current system
  const allowedForSystem = useMemo(() => {
    const sys = String(moaSystem).toUpperCase();
    return (allowed || []).filter((row) => {
      const g = moaGroupById.get(Number(row?.moa_group_id));
      const rowSys = String(row?.moa_system || g?.moa_system || "").toUpperCase();
      return rowSys === sys;
    });
  }, [allowed, moaSystem, moaGroupById]);

  // ---------- load master data ----------
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingMaster(true);
      setErrorMsg("");
      try {
        const chemsPromise = (async () => {
          // ✅ รองรับชื่อฟังก์ชันที่ต่างกันในแต่ละเวอร์ชัน (กัน error export ไม่ตรง)
          if (typeof chemicalsApi.readChemicalsMini === "function") return chemicalsApi.readChemicalsMini();
          if (typeof chemicalsApi.readChemicals === "function") return chemicalsApi.readChemicals();
          if (typeof chemicalsApi.readChemicalsApi === "function") return chemicalsApi.readChemicalsApi();
          if (typeof chemicalsApi.default === "function") return chemicalsApi.default();
          return apiFetch("/chemicals/read_chemicals.php"); // fallback
        })();

        const [diseasesRes, riskRes, groupsRes, chemsRes] = await Promise.all([
          apiFetch("/diseases/read_diseases.php"),
          readDiseaseRiskLevels(),
          readMoaGroups(),
          chemsPromise,
        ]);

        if (!alive) return;
        setDiseases(unwrapList(diseasesRes));
        setRiskLevels(unwrapList(riskRes));
        setMoaGroupsAll(unwrapList(groupsRes));
        setChemicalsMini(unwrapList(chemsRes));

        // set default disease if empty
        if (!diseaseId) {
          const firstDisease = unwrapList(diseasesRes)?.[0];
          const did = firstDisease?.disease_id;
          if (did != null) setDiseaseId(String(did));
        }
      } catch (e) {
        if (!alive) return;
        setErrorMsg(e?.message || "โหลดข้อมูลเริ่มต้นไม่สำเร็จ");
      } finally {
        if (alive) setLoadingMaster(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- load plan+allowed when selection changes ----------
  useEffect(() => {
    let alive = true;

    (async () => {
      planLoadedRef.current = false;
      planDirtyRef.current = false;

      setErrorMsg("");
      setPlanRows([]);
      setDeletedPlanIds([]);
      setAllowed([]);

      if (!anchorRiskLevelId) return;

      setLoadingPlan(true);
      setLoadingAllowed(true);
      try {
        const [planRes, allowedRes] = await Promise.all([
          readRiskLevelMoaPlan(String(anchorRiskLevelId)),
          readRiskLevelMoaChemicals(String(anchorRiskLevelId)),
        ]);

        if (!alive) return;

        // plan normalize
        const rows = unwrapList(planRes);
        const normalizedPlan = rows.map((r) => {
          const gid = Number(r?.moa_group_id);
          const g = moaGroupById.get(gid);
          return {
            ...r,
            plan_id: r?.plan_id ?? r?.id ?? null,
            risk_level_id: Number(r?.risk_level_id ?? anchorRiskLevelId),
            moa_group_id: gid,
            priority: Number(r?.priority ?? 0),
            moa_code: r?.moa_code ?? g?.moa_code ?? "",
            moa_group_name: r?.moa_group_name ?? r?.group_name ?? g?.moa_group_name ?? g?.group_name ?? "",
            moa_system: r?.moa_system ?? g?.moa_system ?? "",
          };
        });
        setPlanRows(normalizedPlan);

        // allowed normalize
        const allowRows = unwrapList(allowedRes).map((r) => {
          const gid = toInt(r?.moa_group_id);
          const cid = toInt(r?.chemical_id);
          const g = moaGroupById.get(gid);
          const c = chemicalById.get(cid);
          return {
            ...r,
            id: toInt(r?.id || r?.mapping_id),
            risk_level_id: toInt(r?.risk_level_id || anchorRiskLevelId),
            moa_group_id: gid,
            chemical_id: cid,
            priority: toInt(r?.priority, 1),
            moa_system: toStr(r?.moa_system || g?.moa_system || ""),
            moa_code: toStr(r?.moa_code || g?.moa_code || ""),
            chemical_name: chemicalNameFromRow(r) || chemicalNameFromRow(c) || "-",
          };
        });
        setAllowed(allowRows);

        planLoadedRef.current = true;
      } catch (e) {
        if (!alive) return;
        setErrorMsg(e?.message || "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        if (alive) {
          setLoadingPlan(false);
          setLoadingAllowed(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [anchorRiskLevelId, moaGroupById, chemicalById]);


  // ---------- auto sync plan (หลังเพิ่ม/แก้ไข/ลบ) ----------
  useEffect(() => {
    if (!planLoadedRef.current) return;
    if (!planDirtyRef.current) return;
    planDirtyRef.current = false;
    syncPlanToDisease();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planRows]);


  // ---------- plan handlers ----------
  const openAddModal = () => {
    setErrorMsg("");
    setAddMoaGroupId("");
    const next = (planVisible?.length || 0) + 1;
    setAddPriority(String(next));
    setIsAddOpen(true);
  };


  const openEditPlanModal = (row) => {
    setErrorMsg("");
    setEditPlanRow(row);
    setEditPriority(String(row?.priority ?? ""));
    setIsEditOpen(true);
  };

  const submitEditPlan = () => {
    setErrorMsg("");
    if (!editPlanRow) return;

    // ✅ ผู้ใช้กรอก "ลำดับ" = ตำแหน่งที่ต้องการ (1..n)
    // เดิมใช้ sort+tie-break ทำให้กรอก 1/2 แล้วไม่ย้ายตำแหน่ง (เพราะค่า priority ซ้ำ)
    // เลยเปลี่ยนเป็น: เอาแถวนั้นออก -> แทรกกลับตามตำแหน่ง -> renumber ใหม่
    const desiredPos = Number(editPriority);
    if (!Number.isFinite(desiredPos) || desiredPos <= 0) {
      setErrorMsg("กรุณากรอกลำดับ (priority) เป็นตัวเลขมากกว่า 0");
      return;
    }

    const list = planVisible.slice().sort((a, b) => Number(a?.priority) - Number(b?.priority));
    if (!list.length) {
      setIsEditOpen(false);
      return;
    }

    const targetGid = Number(editPlanRow?.moa_group_id);
    const curIdx = list.findIndex((r) => Number(r?.moa_group_id) === targetGid);
    if (curIdx < 0) {
      setIsEditOpen(false);
      return;
    }

    const newIdx = Math.max(0, Math.min(list.length - 1, Math.floor(desiredPos) - 1));
    const copy = list.slice();
    const [picked] = copy.splice(curIdx, 1);
    copy.splice(newIdx, 0, picked);

    const renumbered = copy.map((r, i) => ({ ...r, priority: i + 1 }));
    const prByGid = new Map(renumbered.map((r) => [Number(r?.moa_group_id), Number(r?.priority)]));

    planDirtyRef.current = true;
    setPlanRows((prevAll) =>
      (prevAll || []).map((r) => {
        const gid = Number(r?.moa_group_id);
        if (!prByGid.has(gid)) return r;
        return { ...r, priority: prByGid.get(gid) };
      })
    );

    setIsEditOpen(false);
  };

  const addGroupToPlan = () => {
    setErrorMsg("");

    if (!anchorRiskLevelId) {
      setErrorMsg("กรุณาเลือกโรคก่อน");
      return;
    }

    const gid = Number(addMoaGroupId);
    if (!gid) {
      setErrorMsg("กรุณาเลือกกลุ่ม MOA");
      return;
    }

    const pr = Number(addPriority);
    if (!Number.isFinite(pr) || pr <= 0) {
      setErrorMsg("กรุณากรอกลำดับ (priority) เป็นตัวเลขมากกว่า 0");
      return;
    }

    const exists = (planRows || []).some((r) => Number(r?.moa_group_id) === gid);
    if (exists) {
      setErrorMsg("มี MOA group นี้ในแผนแล้ว");
      return;
    }

    const g = moaGroupById.get(gid);
    const sys = String(moaSystem).toUpperCase();
    const rowSys = String(g?.moa_system || "").toUpperCase();
    if (rowSys && rowSys !== sys) {
      setErrorMsg(`กลุ่มนี้อยู่ในระบบ ${rowSys} แต่คุณเลือก ${sys}`);
      return;
    }

    const newRow = {
      plan_id: null,
      risk_level_id: Number(anchorRiskLevelId),
      moa_group_id: gid,
      priority: pr,
      moa_code: g?.moa_code ?? "",
      moa_group_name: g?.group_name ?? g?.moa_group_name ?? "",
      moa_system: g?.moa_system ?? moaSystem,
    };

    const merged = [...(planRows || []), newRow];
    merged.sort((a, b) => Number(a?.priority) - Number(b?.priority));

    // renumber เฉพาะ visible system
    const sysUpper = String(moaSystem).toUpperCase();
    const visible = merged.filter((r) => {
      const g0 = moaGroupById.get(Number(r?.moa_group_id));
      const s0 = String(r?.moa_system || g0?.moa_system || "").toUpperCase();
      return !s0 || s0 === sysUpper;
    });

    const renumberedVisible = visible.map((r, i) => ({ ...r, priority: i + 1 }));

    planDirtyRef.current = true;

    setPlanRows((prevAll) => {
      const prev = prevAll || [];
      const key = (r) => `${r.plan_id ?? "new"}:${r.moa_group_id}`;
      const visibleKey = new Set(renumberedVisible.map((r) => key(r)));

      const updated = prev.map((r) => {
        const k = key(r);
        if (!visibleKey.has(k)) return r;
        const nv = renumberedVisible.find((x) => key(x) === k);
        return nv || r;
      });

      renumberedVisible.forEach((nv) => {
        const k = key(nv);
        const has = updated.some((r) => key(r) === k);
        if (!has) updated.push(nv);
      });

      return updated;
    });

    setIsAddOpen(false);
  };

  const moveRow = (row, direction) => {
    setErrorMsg("");

    const list = planVisible.slice().sort((a, b) => Number(a?.priority) - Number(b?.priority));
    const idx = list.findIndex((r) => r === row);
    if (idx < 0) return;

    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= list.length) return;

    const copy = list.slice();
    const tmp = copy[idx];
    copy[idx] = copy[newIdx];
    copy[newIdx] = tmp;

    const renumbered = copy.map((r, i) => ({ ...r, priority: i + 1 }));

    setPlanRows((prevAll) => {
      const prev = prevAll || [];
      const key = (r) => `${r.plan_id ?? "new"}:${r.moa_group_id}`;
      const vkey = new Set(renumbered.map((r) => key(r)));

      const updated = prev.map((r) => {
        const k = key(r);
        if (!vkey.has(k)) return r;
        const nv = renumbered.find((x) => key(x) === k);
        return nv || r;
      });

      renumbered.forEach((nv) => {
        const k = key(nv);
        const has = updated.some((r) => key(r) === k);
        if (!has) updated.push(nv);
      });

      return updated;
    });
  };

  const removePlanRow = (row) => {
    setErrorMsg("");
    planDirtyRef.current = true;
    const pid = row?.plan_id;
    const gid = Number(row?.moa_group_id);

    // แถวในตารางมาจาก planSorted ซึ่งเป็น object ใหม่ (map {...r})
    // ถ้าลบด้วย reference (r !== row) จะลบไม่ออก จึงลบด้วย moa_group_id แทน
    setPlanRows((prev) => (prev || []).filter((r) => Number(r?.moa_group_id) !== gid));

    if (pid) {
      setDeletedPlanIds((prev) => [...new Set([...(prev || []), pid])]);
    }
  };

  async function syncPlanToDisease() {
    setErrorMsg("");

    if (!anchorRiskLevelId || !diseaseRiskLevelIds.length) {
      setErrorMsg("กรุณาเลือกโรคก่อน");
      return;
    }

    setSavingPlan(true);
    try {
      const sys = String(moaSystem).toUpperCase();

      const desiredGroupIds = planVisible
        .slice()
        .sort((a, b) => Number(a?.priority) - Number(b?.priority))
        .map((r) => toInt(r?.moa_group_id))
        .filter((n) => Number.isFinite(n) && n > 0);

      for (const rlId of diseaseRiskLevelIds) {
        // 1) อ่านแผนเดิมของแต่ละ risk_level (เฉพาะระบบ MOA ที่เลือก)
        const res0 = await readRiskLevelMoaPlan(String(rlId));
        const rows0 = unwrapList(res0);

        const existingMap0 = new Map(); // moa_group_id -> plan_id
        rows0.forEach((r) => {
          const gid = toInt(r?.moa_group_id);
          if (!gid) return;
          const g = moaGroupById.get(gid);
          const rowSys = String(r?.moa_system || g?.moa_system || "").toUpperCase();
          if (!rowSys || rowSys === sys) {
            const pid = r?.plan_id ?? r?.id ?? null;
            existingMap0.set(gid, pid);
          }
        });

        // 2) ลบรายการที่ไม่อยู่ในแผนใหม่
        const deletedIds = [];
        for (const [gid, pid] of existingMap0.entries()) {
          if (!desiredGroupIds.includes(gid) && pid) deletedIds.push(pid);
        }

        // ถ้าแผนว่าง -> ลบอย่างเดียวพอ
        if (!desiredGroupIds.length) {
          await saveRiskLevelMoaPlan(Number(rlId), [], deletedIds);
          continue;
        }

        // 3) FIX 409 (duplicate_or_fk_error):
        //    ตารางมี unique (risk_level_id, moa_system, priority) ทำให้การ update ทีละแถวชนกัน
        //    วิธีแก้: ทำ 2 pass -> ตั้งค่า priority ชั่วคราว (1000+) ก่อน แล้วค่อยตั้งค่าจริง (1..n)
        const tempItems = desiredGroupIds.map((gid, idx) => ({
          plan_id: existingMap0.get(gid) || null,
          moa_group_id: gid,
          priority: 1000 + (idx + 1),
        }));

        await saveRiskLevelMoaPlan(Number(rlId), tempItems, deletedIds);

        // 4) re-read เพื่อได้ plan_id ของรายการที่เพิ่งสร้างใหม่ แล้วค่อย set priority จริง
        const res1 = await readRiskLevelMoaPlan(String(rlId));
        const rows1 = unwrapList(res1);

        const existingMap1 = new Map(); // moa_group_id -> plan_id
        rows1.forEach((r) => {
          const gid = toInt(r?.moa_group_id);
          if (!gid) return;
          const g = moaGroupById.get(gid);
          const rowSys = String(r?.moa_system || g?.moa_system || "").toUpperCase();
          if (!rowSys || rowSys === sys) {
            const pid = r?.plan_id ?? r?.id ?? null;
            existingMap1.set(gid, pid);
          }
        });

        const finalItems = desiredGroupIds.map((gid, idx) => ({
          plan_id: existingMap1.get(gid) || null,
          moa_group_id: gid,
          priority: idx + 1,
        }));

        await saveRiskLevelMoaPlan(Number(rlId), finalItems, []);
      }

      // reload plan from anchor risk_level_id
      const reload = await readRiskLevelMoaPlan(String(anchorRiskLevelId));
      const rows = unwrapList(reload).map((r) => {
        const gid = toInt(r?.moa_group_id);
        const g = moaGroupById.get(gid);
        return {
          ...r,
          plan_id: r?.plan_id ?? r?.id ?? null,
          risk_level_id: toInt(r?.risk_level_id || anchorRiskLevelId),
          moa_group_id: gid,
          priority: toInt(r?.priority, 0),
          moa_code: toStr(r?.moa_code || g?.moa_code),
          moa_group_name: toStr(r?.moa_group_name || r?.group_name || g?.moa_group_name || g?.group_name),
          moa_system: toStr(r?.moa_system || g?.moa_system),
        };
      });

      setPlanRows(rows);
      setDeletedPlanIds([]);
    } catch (e) {
      const msg = e?.message || "บันทึกแผนไม่สำเร็จ";
      // ให้ข้อความดูเข้าใจง่ายขึ้นเมื่อชน unique key
      if (String(msg).includes("duplicate_or_fk_error") || String(msg).includes("409")) {
        setErrorMsg("บันทึกลำดับไม่สำเร็จ (ลำดับซ้ำชั่วคราว) — ระบบกำลังจัดลำดับใหม่ให้ ลองกดบันทึกอีกครั้ง");
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setSavingPlan(false);
    }
  }


  // ---------- allowed chemicals handlers ----------
  const openAddAllowedModal = () => {
    setErrorMsg("");
    setAddAllowedForm({ moaGroupId: "", chemicalId: "", priority: 1 });
    setShowAddAllowed(true);
  };

  const openEditAllowedModal = (row) => {
    setErrorMsg("");
    setEditAllowedOrigin({ moaGroupId: String(row?.moa_group_id), chemicalId: String(row?.chemical_id) });
    setEditAllowedForm({
      id: String(row?.id || ""),
      moaGroupId: String(row?.moa_group_id || ""),
      chemicalId: String(row?.chemical_id || ""),
      priority: toInt(row?.priority, 1),
    });
    setShowEditAllowed(true);
  };

  async function loadAllowedForRiskLevel(rlId) {
    const res = await readRiskLevelMoaChemicals(String(rlId));
    return unwrapList(res).map((r) => {
      return {
        id: toInt(r?.id || r?.mapping_id),
        risk_level_id: toInt(r?.risk_level_id || rlId),
        moa_group_id: toInt(r?.moa_group_id),
        chemical_id: toInt(r?.chemical_id),
        priority: toInt(r?.priority, 1),
      };
    });
  }

  async function reloadAnchorAllowed() {
    if (!anchorRiskLevelId) return;
    setLoadingAllowed(true);
    try {
      const allowedRes = await readRiskLevelMoaChemicals(String(anchorRiskLevelId));
      const allowRows = unwrapList(allowedRes).map((r) => {
        const gid = toInt(r?.moa_group_id);
        const cid = toInt(r?.chemical_id);
        const g = moaGroupById.get(gid);
        const c = chemicalById.get(cid);
        return {
          ...r,
          id: toInt(r?.id || r?.mapping_id),
          risk_level_id: toInt(r?.risk_level_id || anchorRiskLevelId),
          moa_group_id: gid,
          chemical_id: cid,
          priority: toInt(r?.priority, 1),
          moa_system: toStr(r?.moa_system || g?.moa_system || ""),
          moa_code: toStr(r?.moa_code || g?.moa_code || ""),
          chemical_name: chemicalNameFromRow(r) || chemicalNameFromRow(c) || "-",
        };
      });
      setAllowed(allowRows);
    } finally {
      setLoadingAllowed(false);
    }
  }

  async function submitAddAllowed(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!anchorRiskLevelId || !diseaseRiskLevelIds.length) {
      setErrorMsg("กรุณาเลือกโรคก่อน");
      return;
    }

    const gid = toInt(addAllowedForm.moaGroupId);
    const cid = toInt(addAllowedForm.chemicalId);
    const pr = toInt(addAllowedForm.priority, 1);

    if (!gid) return setErrorMsg("กรุณาเลือก MOA group");
    if (!cid) return setErrorMsg("กรุณาเลือกสารเคมี");
    if (pr <= 0) return setErrorMsg("priority ต้องมากกว่า 0");

    setSavingAllowed(true);
    try {
      for (const rlId of diseaseRiskLevelIds) {
        const cur = await loadAllowedForRiskLevel(rlId);
        const exists = cur.some((r) => r.moa_group_id === gid && r.chemical_id === cid);
        if (exists) continue;
        await createRiskLevelMoaChemical({
          risk_level_id: Number(rlId),
          moa_group_id: gid,
          chemical_id: cid,
          priority: pr,
        });
      }

      setShowAddAllowed(false);
      await reloadAnchorAllowed();
    } catch (e2) {
      setErrorMsg(e2?.message || "เพิ่มสารที่อนุญาตไม่สำเร็จ");
    } finally {
      setSavingAllowed(false);
    }
  }

  async function submitEditAllowed(e) {
    e.preventDefault();
    setErrorMsg("");

    if (!anchorRiskLevelId || !diseaseRiskLevelIds.length) {
      setErrorMsg("กรุณาเลือกโรคก่อน");
      return;
    }

    const newGid = toInt(editAllowedForm.moaGroupId);
    const newCid = toInt(editAllowedForm.chemicalId);
    const newPr = toInt(editAllowedForm.priority, 1);

    if (!newGid) return setErrorMsg("กรุณาเลือก MOA group");
    if (!newCid) return setErrorMsg("กรุณาเลือกสารเคมี");
    if (newPr <= 0) return setErrorMsg("priority ต้องมากกว่า 0");

    const origin = editAllowedOrigin;
    if (!origin) return setErrorMsg("ไม่พบข้อมูลเดิมของรายการ");

    const oldGid = toInt(origin.moaGroupId);
    const oldCid = toInt(origin.chemicalId);

    setSavingAllowed(true);
    try {
      for (const rlId of diseaseRiskLevelIds) {
        const cur = await loadAllowedForRiskLevel(rlId);
        const found = cur.find((r) => r.moa_group_id === oldGid && r.chemical_id === oldCid);

        // กันกรณีเลือกสารซ้ำในกลุ่มเดียวกัน
        if (found?.id) {
          const dupChem = cur.find(
            (r) => r.moa_group_id === newGid && r.chemical_id === newCid && Number(r.id) !== Number(found.id)
          );
          if (dupChem) {
            throw new Error(
              `สารนี้ถูกกำหนดไว้แล้วในกลุ่มเดียวกัน (risk_level_id: ${rlId})` // ชน unique (risk_level_id, moa_group_id, chemical_id)
            );
          }

          // ถ้า priority ชน ให้ทำการสลับแบบปลอดภัย (ใช้ temp priority)
          const conflict = cur.find(
            (r) => r.moa_group_id === newGid && Number(r.priority) === Number(newPr) && Number(r.id) !== Number(found.id)
          );

          if (conflict?.id) {
            const groupRows = cur.filter((r) => r.moa_group_id === newGid);
            const maxPr = Math.max(0, ...groupRows.map((r) => Number(r.priority) || 0));
            const tempPr = maxPr + 1000; // ให้แน่ใจว่าไม่ชน

            // 1) ย้ายตัวที่ชนไป temp
            await updateRiskLevelMoaChemical({
              id: Number(conflict.id),
              risk_level_id: Number(rlId),
              moa_group_id: Number(conflict.moa_group_id),
              chemical_id: Number(conflict.chemical_id),
              priority: Number(tempPr),
            });

            // 2) อัปเดตตัวที่แก้ไข ให้ได้ลำดับใหม่
            await updateRiskLevelMoaChemical({
              id: Number(found.id),
              risk_level_id: Number(rlId),
              moa_group_id: newGid,
              chemical_id: newCid,
              priority: newPr,
            });

            // 3) ย้ายตัวที่ชนกลับไปยังลำดับเดิมของรายการที่ถูกแก้ไข (ถ้าชนอีกให้ไล่หาลำดับว่าง)
            const usedAfter = new Set(
              cur
                .filter(
                  (r) =>
                    r.moa_group_id === newGid &&
                    Number(r.id) !== Number(conflict.id) &&
                    Number(r.id) !== Number(found.id)
                )
                .map((r) => Number(r.priority))
            );
            usedAfter.add(Number(newPr));

            let conflictFinal = Number(found.priority);
            while (usedAfter.has(conflictFinal)) conflictFinal += 1;

            await updateRiskLevelMoaChemical({
              id: Number(conflict.id),
              risk_level_id: Number(rlId),
              moa_group_id: Number(conflict.moa_group_id),
              chemical_id: Number(conflict.chemical_id),
              priority: Number(conflictFinal),
            });
          } else {
            // ไม่ชน priority -> อัปเดตได้เลย
            await updateRiskLevelMoaChemical({
              id: Number(found.id),
              risk_level_id: Number(rlId),
              moa_group_id: newGid,
              chemical_id: newCid,
              priority: newPr,
            });
          }
        } else {
          // ไม่พบใน risk level นี้ -> สร้างใหม่ (ถ้าซ้ำจะถูก API ปฏิเสธ)
          const exists2 = cur.some((r) => r.moa_group_id === newGid && r.chemical_id === newCid);
          if (!exists2) {
            await createRiskLevelMoaChemical({
              risk_level_id: Number(rlId),
              moa_group_id: newGid,
              chemical_id: newCid,
              priority: newPr,
            });
          }
        }
      }

      setShowEditAllowed(false);
      await reloadAnchorAllowed();
    } catch (e2) {
      const raw = e2?.message || "";
      if (raw.includes("duplicate_or_fk_error") || raw.includes("409")) {
        setErrorMsg("บันทึกไม่สำเร็จ: ลำดับ (priority) ซ้ำ หรือมีการกำหนดสารซ้ำในกลุ่มเดียวกัน");
      } else {
        setErrorMsg(raw || "แก้ไขสารที่อนุญาตไม่สำเร็จ");
      }
    } finally {
      setSavingAllowed(false);
    }
  }

  async function onDeleteAllowed(row) {
    if (!row) return;
    if (!window.confirm("ยืนยันลบรายการสารที่อนุญาตนี้?")) return;

    setErrorMsg("");

    if (!anchorRiskLevelId || !diseaseRiskLevelIds.length) {
      setErrorMsg("กรุณาเลือกโรคก่อน");
      return;
    }

    const gid = toInt(row?.moa_group_id);
    const cid = toInt(row?.chemical_id);

    setSavingAllowed(true);
    try {
      for (const rlId of diseaseRiskLevelIds) {
        const cur = await loadAllowedForRiskLevel(rlId);
        const matches = cur.filter((r) => r.moa_group_id === gid && r.chemical_id === cid);
        for (const m of matches) {
          await deleteRiskLevelMoaChemical(Number(m.id));
        }
      }

      await reloadAnchorAllowed();
    } catch (e2) {
      setErrorMsg(e2?.message || "ลบรายการไม่สำเร็จ");
    } finally {
      setSavingAllowed(false);
    }
  }

  // ---------- styles (ให้เหมือนกับหน้า AdminChemicalsAndMOAGroupsPage) ----------
  const { user, logout } = useAuth();

  const centerCell = { textAlign: "center", verticalAlign: "middle" };

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


  // ✅ ใช้กับ <select> native ของ "สารเคมี" เพื่อให้ dropdown เปิดลงข้างล่าง (เพิ่มพื้นที่ด้านล่าง)
  const modalStyleForNativeChemicalSelect = {
    ...modalStyle,
    transform: "translateY(-160px)", // ปรับค่าได้ ถ้ายังเด้งขึ้นบน
  };

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

  // ---------- render ----------
  const selectedDiseaseName = diseaseNameById.get(Number(diseaseId)) || "";

  return (
    <div className="page">
      <header className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="/admin" className="btn ghost">
            ← กลับหน้าหลัก
          </a>
          <h1 style={{ margin: 0 }}>แผนหมุนเวียน MOA + สารที่อนุญาต</h1>
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
    style={tab === "plan" ? activeTabBtn : tabBtn}
    onClick={() => setTab("plan")}
    type="button"
  >
    จัดการแผนหมุนเวียน MOA
  </button>
  <button
    className="btn"
    style={tab === "allowed" ? activeTabBtn : tabBtn}
    onClick={() => setTab("allowed")}
    type="button"
  >
    จัดการสารที่อนุญาต
  </button>
</div>

      {errorMsg && <div className="alert error">{errorMsg}</div>}

      {/* ===== ตัวเลือกโรค + ระบบ MOA + ปุ่มการทำงาน ===== */}
      <div className="card">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 10,
            alignItems: "end",
          }}
        >
          <div>
            <label className="t-label">เลือกโรค (ไม่แบ่งระดับ)</label>
            <select
              className="input"
              value={diseaseId}
              onChange={(e) => setDiseaseId(e.target.value)}
              disabled={loadingMaster}
            >
              <option value="">-- เลือกโรค --</option>
              {diseases.map((d) => (
                <option key={d.disease_id} value={String(d.disease_id)}>
                  {diseaseNameFromRow(d) || `โรค#${d.disease_id}`}
                </option>
              ))}
            </select>

            
          </div>

          <div>
            <label className="t-label">ระบบ MOA</label>
            <select
              className="input"
              value={moaSystem}
              onChange={(e) => setMoaSystem(e.target.value)}
              disabled={loadingMaster}
            >
              {moaSystemOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {tab === "plan" && (
              <>
                <button
                  className="btn"
                  onClick={openAddModal}
                  disabled={!anchorRiskLevelId || savingPlan || loadingPlan}
                  type="button"
                >
                  + เพิ่ม MOA group ในแผน
                </button>
              </>
            )}
</div>
        </div>


        {diseaseId && (
          <div style={{ marginTop: 8, color: "#6b7280" }}>
            risk_level ของโรคนี้:{" "}
            {diseaseRiskLevelIds.length ? diseaseRiskLevelIds.join(", ") : "(ไม่พบ)"}
          </div>
        )}
        <div style={{ marginTop: 10, color: "#374151" }}>
          โรคที่เลือก: <b>{selectedDiseaseName || "-"}</b> | ใช้ข้อมูลแก้ไขบน risk_level_id:{" "}
          <b>{anchorRiskLevelId || "-"}</b>
        </div>
      </div>

{tab === "plan" && (
  <>
    {/* ========= Rotation Plan ========= */}
    <div className="card">
        <h2 style={{ marginTop: 0 }}>
          1) แผนหมุนเวียน MOA ({String(moaSystem).toUpperCase()})
        </h2>

        {loadingPlan ? (
          <div>กำลังโหลด...</div>
        ) : planSorted.length === 0 ? (
          <div style={{ color: "#6b7280" }}>
            ยังไม่มีแผนสำหรับ {String(moaSystem).toUpperCase()} ({selectedDiseaseName || "-"})
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={centerCell}>ลำดับ</th>
                <th>MOA</th>
                <th style={centerCell} className="actionsHeader">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {planSorted.map((row, idx) => {
                const gid = Number(row?.moa_group_id);
                const g = moaGroupById.get(gid);
                const label = [toStr(g?.moa_system), toStr(g?.moa_code)]
                  .filter(Boolean)
                  .join(" ")
                  .trim();
                const name = toStr(g?.group_name || g?.moa_group_name || "");
                const show =
                  name && label && name !== label ? `${label} - ${name}` : label || name || `ID ${gid}`;

                return (
                  <tr key={`${gid}:${idx}`}>
                    <td style={centerCell}>{idx + 1}</td>
                    <td style={{ whiteSpace: "pre-wrap" }}>{show}</td>
                    <td style={{ ...centerCell, whiteSpace: "nowrap" }} className="actionsCell">
                        <div className="actionButtons">
                          <button
                            className="btn btn-edit"
                            type="button"
                            onClick={() => openEditPlanModal(row)}
                            disabled={savingPlan || loadingPlan}
                          >
                            แก้ไข
                          </button>
                          <button
                            className="btn btn-delete"
                            type="button"
                            onClick={() => removePlanRow(row)}
                            disabled={savingPlan || loadingPlan}
                          >
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

        <div className="t-muted" style={{ marginTop: 10 }}>
          * เมื่อเพิ่ม/แก้ไข/ลบ ระบบจะ sync เฉพาะระบบที่เลือก (เช่น FRAC) ไปทุก risk_level ของโรคนี้
        </div>
          </div>
  </>
)}

{tab === "allowed" && (
  <>
    {/* ========= Allowed Chemicals ========= */}
    <div className="card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ margin: 0 }}>
            2) สารที่อนุญาตต่อกลุ่ม ({String(moaSystem).toUpperCase()})
          </h2>
          <button
            className="btn"
            onClick={openAddAllowedModal}
            disabled={!anchorRiskLevelId || savingAllowed || loadingAllowed}
            type="button"
          >
            + เพิ่มสารที่อนุญาต
          </button>
        </div>

        {loadingAllowed ? (
          <div style={{ marginTop: 10 }}>กำลังโหลด...</div>
        ) : planSorted.length === 0 ? (
          <div className="t-muted" style={{ marginTop: 10 }}>
            ยังไม่มีแผนหมุนเวียนของระบบนี้ เลยไม่สามารถผูกสารได้
          </div>
        ) : (
          <div style={{ marginTop: 10 }}>
            <div className="t-muted" style={{ marginBottom: 10 }}>
              * รายการนี้จะ sync ไปทุก risk_level ของโรคนี้เช่นกัน
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>MOA (ตามแผน)</th>
                  <th>สารที่อนุญาต</th>
                  <th style={centerCell}>ลำดับ</th>
                  <th style={centerCell} className="actionsHeader">จัดการ</th>
                </tr>
              </thead>

              <tbody>
                {planSorted.map((p) => {
                  const gid = Number(p?.moa_group_id);
                  const g = moaGroupById.get(gid);
                  const groupLabel = [toStr(g?.moa_system), toStr(g?.moa_code)]
                    .filter(Boolean)
                    .join(" ")
                    .trim();

                  const rows = allowedForSystem
                    .filter((a) => Number(a?.moa_group_id) === gid)
                    .slice()
                    .sort((a, b) => toInt(a?.priority) - toInt(b?.priority));

                  return (
                    <tr key={`g-${gid}`}>
                      <td style={{ whiteSpace: "pre-wrap" }}>
                        <b>{groupLabel || `MOA#${gid}`}</b>
                        {g?.group_name ? (
                          <div className="t-muted">{g.group_name}</div>
                        ) : null}
                      </td>

                      <td>
                        {rows.length === 0 ? (
                          <span style={{ color: "#9ca3af" }}>ยังไม่กำหนด</span>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {rows.map((r) => (
                              <div
                                key={`a-${r.id}`}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 10,
                                  border: "1px solid #eee",
                                  borderRadius: 12,
                                  padding: "8px 10px",
                                  background: "#fff",
                                }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, whiteSpace: "pre-wrap" }}>
                                    {r.chemical_name || "-"}
                                  </div>
                                  <div className="t-muted">
                                    priority: {toInt(r.priority, 1)}
                                  </div>
                                </div>


                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      <td style={centerCell}>
                        {rows.length ? rows.map((r) => toInt(r.priority, 1)).join(", ") : "-"}
                      </td>

                      <td style={{ whiteSpace: "nowrap", verticalAlign: "middle" }} className="actionsCell">
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", justifyContent: "center", height: "100%" }}>
                          <button
                            className="btn xs ghost"
                            type="button"
                            onClick={() => {
                              setShowAddAllowed(true);
                              setAddAllowedForm({ moaGroupId: String(gid), chemicalId: "", priority: 1 });
                            }}
                          >
                            + เพิ่มในกลุ่มนี้
                          </button>

                          {rows.length ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                              {rows.map((r) => (
                                <div key={`act-${r.id}`} className="actionButtons">
                                  <button
                                    className="btn btn-edit"
                                    type="button"
                                    onClick={() => openEditAllowedModal(r)}
                                  >
                                    แก้ไข
                                  </button>
                                  <button
                                    className="btn btn-delete"
                                    type="button"
                                    onClick={() => onDeleteAllowed(r)}
                                  >
                                    ลบ
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </div>
  </>
)}

{/* ===== Modal: Add MOA group to plan ===== */}
      {isAddOpen && (
        <div style={overlayStyle} onMouseDown={() => setIsAddOpen(false)}>
          <div className="card" style={modalStyle} onMouseDown={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <h2 style={{ margin: 0 }}>เพิ่ม MOA group ในแผน</h2>
              <button className="btn ghost" type="button" onClick={() => setIsAddOpen(false)}>
                ปิด
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addGroupToPlan();
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 10,
                }}
              >
                <div>
                  <label className="t-label">
                    MOA group ({String(moaSystem).toUpperCase()})
                  </label>
                  <select
                    className="input"
                    value={addMoaGroupId}
                    onChange={(e) => setAddMoaGroupId(e.target.value)}
                  >
                    <option value="">-- เลือก MOA group --</option>
                    {(moaGroupsAll || [])
                      .filter(
                        (g) =>
                          String(g?.moa_system || "").toUpperCase() ===
                          String(moaSystem).toUpperCase()
                      )
                      .sort((a, b) =>
                        String(a?.moa_code || "").localeCompare(String(b?.moa_code || ""))
                      )
                      .map((g) => {
                        const label = [toStr(g?.moa_system), toStr(g?.moa_code)]
                          .filter(Boolean)
                          .join(" ")
                          .trim();
                        const name = toStr(g?.group_name || g?.moa_group_name || "");
                        const text =
                          name && label && name !== label
                            ? `${label} - ${name}`
                            : label || name || `ID ${g.moa_group_id}`;
                        return (
                          <option key={g.moa_group_id} value={String(g.moa_group_id)}>
                            {text}
                          </option>
                        );
                      })}
                  </select>
                </div>

                <div>
                  <label className="t-label">ลำดับ (priority)</label>
                  <input
                    className="input"
                    value={addPriority}
                    onChange={(e) => setAddPriority(e.target.value)}
                    placeholder="เช่น 1"
                  />
                </div>

                <div className="formActions" style={{ gridColumn: "1 / -1", marginTop: 6 }}>
                      <button className="btnBase btnSave" type="submit">
                    เพิ่ม
                  </button>
                      <button
                    className="btnBase btnCancel"
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                  >
                    ยกเลิก
                  </button>
                  
                  
                </div>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ===== Modal: Edit Plan Row ===== */}
      {isEditOpen && (
        <div style={overlayStyle} onMouseDown={() => setIsEditOpen(false)}>
          <div className="card" style={modalStyle} onMouseDown={(e) => e.stopPropagation()}>
            <div className="card-content" style={{ padding: 18 }}>
              <h2 style={{ marginTop: 0, marginBottom: 12 }}>แก้ไขลำดับ MOA group ในแผน</h2>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div className="t-muted" style={{ marginBottom: 6 }}>MOA group</div>
                  <input
                    className="input"
                    value={(() => {
                      const gid = Number(editPlanRow?.moa_group_id);
                      const g = moaGroupById.get(gid);
                      const label = [toStr(g?.moa_system), toStr(g?.moa_code)]
                        .filter(Boolean)
                        .join(" ")
                        .trim();
                      const name = toStr(g?.group_name || g?.moa_group_name || "");
                      return name && label && name !== label ? `${label} - ${name}` : label || name || (gid ? `ID ${gid}` : "");
                    })()}
                    disabled
                    readOnly
                  />
                </div>

                <div>
                  <div className="t-muted" style={{ marginBottom: 6 }}>ลำดับ (priority)</div>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                  />
                </div>

                <div className="formActions" style={{ gridColumn: "1 / -1", marginTop: 6 }}>
                      <button
                    className="btnBase btnSave"
                    type="button"
                    onClick={submitEditPlan}
                    disabled={savingPlan || loadingPlan}
                  >
                    บันทึก
                  </button>
                      <button
                    className="btnBase btnCancel"
                    type="button"
                    onClick={() => setIsEditOpen(false)}
                  >
                    ยกเลิก
                  </button>
                  
                  
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ===== Modal: Add Allowed Chemical ===== */}
      {showAddAllowed && (
        <div style={overlayStyle} onMouseDown={() => setShowAddAllowed(false)}>
          <div className="card" style={modalStyleForNativeChemicalSelect} onMouseDown={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <h2 style={{ margin: 0 }}>เพิ่มสารที่อนุญาต</h2>
              <button className="btn ghost" type="button" onClick={() => setShowAddAllowed(false)}>
                ปิด
              </button>
            </div>

            <form onSubmit={submitAddAllowed}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 10,
                }}
              >
                <div>
                  <label className="t-label">
                    MOA group ({String(moaSystem).toUpperCase()})
                  </label>
                  <select
                    className="input"
                    value={addAllowedForm.moaGroupId}
                    onChange={(e) => setAddAllowedForm((s) => ({ ...s, moaGroupId: e.target.value }))}
                  >
                    <option value="">-- เลือก MOA group --</option>
                    {planSorted.map((p) => {
                      const gid = Number(p?.moa_group_id);
                      const g = moaGroupById.get(gid);
                      const label = [toStr(g?.moa_system), toStr(g?.moa_code)]
                        .filter(Boolean)
                        .join(" ")
                        .trim();
                      const name = toStr(g?.group_name || g?.moa_group_name || "");
                      const text =
                        name && label && name !== label ? `${label} - ${name}` : label || name || `ID ${gid}`;
                      return (
                        <option key={`p-${gid}`} value={String(gid)}>
                          {text}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="t-label">สารเคมี</label>
                  <select
                    className="input"
                    value={addAllowedForm.chemicalId}
                    onChange={(e) => setAddAllowedForm((s) => ({ ...s, chemicalId: e.target.value }))}
                  >
                    <option value="">-- เลือกสารเคมี --</option>
                    {chemicalOptions.map((opt) => (
                      <option key={String(opt.value)} value={String(opt.value)}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="t-label">ลำดับ (priority)</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={addAllowedForm.priority}
                    onChange={(e) => setAddAllowedForm((s) => ({ ...s, priority: e.target.value }))}
                  />
                </div>

                <div className="formActions" style={{ gridColumn: "1 / -1", marginTop: 6 }}>
                      <button className="btnBase btnSave" type="submit" disabled={savingAllowed}>
                    {savingAllowed ? "กำลังบันทึก..." : "บันทึก"}
                  </button>
                      <button
                    className="btnBase btnCancel"
                    type="button"
                    onClick={() => setShowAddAllowed(false)}
                    disabled={savingAllowed}
                  >
                    ยกเลิก
                  </button>
                  
                  
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Modal: Edit Allowed Chemical ===== */}
      {showEditAllowed && (
        <div style={overlayStyle} onMouseDown={() => setShowEditAllowed(false)}>
          <div className="card" style={modalStyleForNativeChemicalSelect} onMouseDown={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <h2 style={{ margin: 0 }}>แก้ไขสารที่อนุญาต</h2>
              <button className="btn ghost" type="button" onClick={() => setShowEditAllowed(false)}>
                ปิด
              </button>
            </div>

            <form onSubmit={submitEditAllowed}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 10,
                }}
              >
                <div>
                  <label className="t-label">
                    MOA group ({String(moaSystem).toUpperCase()})
                  </label>
                  <select
                    className="input"
                    value={editAllowedForm.moaGroupId}
                    onChange={(e) => setEditAllowedForm((s) => ({ ...s, moaGroupId: e.target.value }))}
                  >
                    <option value="">-- เลือก MOA group --</option>
                    {planSorted.map((p) => {
                      const gid = Number(p?.moa_group_id);
                      const g = moaGroupById.get(gid);
                      const label = [toStr(g?.moa_system), toStr(g?.moa_code)]
                        .filter(Boolean)
                        .join(" ")
                        .trim();
                      const name = toStr(g?.group_name || g?.moa_group_name || "");
                      const text =
                        name && label && name !== label ? `${label} - ${name}` : label || name || `ID ${gid}`;
                      return (
                        <option key={`ep-${gid}`} value={String(gid)}>
                          {text}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="t-label">สารเคมี</label>
                  <select
                    className="input"
                    value={editAllowedForm.chemicalId}
                    onChange={(e) => setEditAllowedForm((s) => ({ ...s, chemicalId: e.target.value }))}
                  >
                    <option value="">-- เลือกสารเคมี --</option>
                    {chemicalOptions.map((opt) => (
                      <option key={String(opt.value)} value={String(opt.value)}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="t-label">ลำดับ (priority)</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={editAllowedForm.priority}
                    onChange={(e) => setEditAllowedForm((s) => ({ ...s, priority: e.target.value }))}
                  />
                </div>

                <div className="formActions" style={{ gridColumn: "1 / -1", marginTop: 6 }}>
                      <button className="btnBase btnSave" type="submit" disabled={savingAllowed}>
                    {savingAllowed ? "กำลังบันทึก..." : "บันทึก"}
                  </button>
                      <button
                    className="btnBase btnCancel"
                    type="button"
                    onClick={() => setShowEditAllowed(false)}
                    disabled={savingAllowed}
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
