import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Supabase ───
const SB_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const DB_OK = !!(SB_URL && SB_KEY);
const hdrs = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };
const api = (table) => ({
  select: async () => {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?select=*&order=created_at.desc`, { headers: hdrs });
    const d = await r.json(); return r.ok ? { data: d } : { data: null, error: d };
  },
  insert: async (rows) => {
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, { method: "POST", headers: { ...hdrs, Prefer: "return=representation" }, body: JSON.stringify(rows) });
    const d = await r.json(); return r.ok ? { data: d } : { data: null, error: d };
  },
  del: async (id) => {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, { method: "DELETE", headers: hdrs });
    return { error: r.ok ? null : "delete failed" };
  },
  update: async (id, row) => {
    const r = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, { method: "PATCH", headers: { ...hdrs, Prefer: "return=representation" }, body: JSON.stringify(row) });
    const d = await r.json(); return r.ok ? { data: d } : { data: null, error: d };
  },
});

// ─── 常數 ───
const FORK_OPTS = [
  { value: "inverted", label: "倒叉" }, { value: "conventional", label: "正叉" },
  { value: "macpherson", label: "麥花臣" }, { value: "double_wishbone", label: "雙A臂" },
  { value: "multi_link", label: "多連桿" }, { value: "other", label: "其他" },
];
const DRIVE_OPTS = [
  { value: "fwd", label: "前驅 FF" }, { value: "rwd", label: "後驅 FR" },
  { value: "awd", label: "四驅 AWD" },
];
const SYMPTOMS = [
  { id: "bouncy", label: "跳跳車（多次餘震）", icon: "🔄" },
  { id: "roll", label: "左右搖晃（側傾大）", icon: "↔️" },
  { id: "pitch", label: "煞車點頭 / 加速抬頭", icon: "↕️" },
  { id: "harsh", label: "路感太脆（碎震明顯）", icon: "💥" },
  { id: "float", label: "高速漂浮感", icon: "🌊" },
  { id: "bottom", label: "過坑觸底（行程不足）", icon: "⬇️" },
];

const EMPTY = {
  license_plate: "", customer_name: "", customer_phone: "", car_model: "", shock_model: "",
  fork_type_front: "inverted", fork_type_rear: "conventional",
  drive_type: "fwd", vehicle_weight: "", odometer: "",
  spring_rate_front: "", spring_rate_rear: "",
  ride_height_fingers: "", tire_pressure_front: "", tire_pressure_rear: "",
  damping_rebound_front: "", damping_rebound_rear: "",
  damping_compression_front: "", damping_compression_rear: "",
  damping_max_clicks: "32",
  preload_front: "", preload_rear: "",
  sway_bar_front: "", sway_bar_rear: "",
  camber_front: "", camber_rear: "", toe_front: "", toe_rear: "",
  symptoms: [], issue_description: "", adjustment_notes: "", technician: "",
};
const REQUIRED = {
  license_plate: "車牌號碼", customer_name: "車主姓名", car_model: "車型",
  shock_model: "避震型號", spring_rate_front: "彈簧（前）", spring_rate_rear: "彈簧（後）",
  damping_rebound_front: "伸側阻尼（前）", damping_compression_front: "壓側阻尼（前）",
  preload_front: "預載（前）",
};

// ─── 快速範本（修正為更合理的實測值）───
const PRESETS = [
  { name: "MG HS 1.5T 舒適", car_model: "MG HS 1.5T", fork_type_front: "macpherson", fork_type_rear: "multi_link", drive_type: "fwd", vehicle_weight: "1548",
    spring_rate_front: "6", spring_rate_rear: "5.5", damping_rebound_front: "14", damping_rebound_rear: "12",
    damping_compression_front: "12", damping_compression_rear: "10", preload_front: "6", preload_rear: "5",
    ride_height_fingers: "3", tire_pressure_front: "2.5", tire_pressure_rear: "2.4" },
  { name: "MG HS 1.5T 穩定", car_model: "MG HS 1.5T", fork_type_front: "macpherson", fork_type_rear: "multi_link", drive_type: "fwd", vehicle_weight: "1548",
    spring_rate_front: "7", spring_rate_rear: "6.5", damping_rebound_front: "18", damping_rebound_rear: "16",
    damping_compression_front: "16", damping_compression_rear: "14", preload_front: "8", preload_rear: "6",
    ride_height_fingers: "2.5", tire_pressure_front: "2.5", tire_pressure_rear: "2.5" },
  { name: "Focus MK4 街道", car_model: "Ford Focus MK4", fork_type_front: "macpherson", fork_type_rear: "multi_link", drive_type: "fwd", vehicle_weight: "1390",
    spring_rate_front: "6", spring_rate_rear: "5", damping_rebound_front: "14", damping_rebound_rear: "12",
    damping_compression_front: "12", damping_compression_rear: "10", preload_front: "7", preload_rear: "5",
    ride_height_fingers: "3", tire_pressure_front: "2.4", tire_pressure_rear: "2.3" },
  { name: "Civic FE 運動", car_model: "Honda Civic FE", fork_type_front: "macpherson", fork_type_rear: "multi_link", drive_type: "fwd", vehicle_weight: "1356",
    spring_rate_front: "7", spring_rate_rear: "6", damping_rebound_front: "18", damping_rebound_rear: "16",
    damping_compression_front: "16", damping_compression_rear: "14", preload_front: "8", preload_rear: "6",
    ride_height_fingers: "2", tire_pressure_front: "2.5", tire_pressure_rear: "2.4" },
  { name: "86/BRZ 甩尾", car_model: "Toyota 86 / Subaru BRZ", fork_type_front: "macpherson", fork_type_rear: "multi_link", drive_type: "rwd", vehicle_weight: "1270",
    spring_rate_front: "7", spring_rate_rear: "5.5", damping_rebound_front: "16", damping_rebound_rear: "12",
    damping_compression_front: "14", damping_compression_rear: "10", preload_front: "8", preload_rear: "5",
    ride_height_fingers: "2", tire_pressure_front: "2.5", tire_pressure_rear: "2.3" },
];
const STEP_MAP = {
  spring_rate_front: 0.5, spring_rate_rear: 0.5, vehicle_weight: 10, odometer: 100,
  damping_rebound_front: 1, damping_rebound_rear: 1,
  damping_compression_front: 1, damping_compression_rear: 1,
  damping_max_clicks: 1, preload_front: 1, preload_rear: 1, ride_height_fingers: 0.5,
  tire_pressure_front: 0.1, tire_pressure_rear: 0.1,
  camber_front: 0.1, camber_rear: 0.1, toe_front: 0.05, toe_rear: 0.05,
};

// ─── 常用備註 ───
const QUICK_NOTES = [
  "增加回彈阻尼 2 段，改善餘震",
  "降低壓縮阻尼 1 段，改善碎震",
  "預載增加 2mm，壓住車頭浮動",
  "建議下次升磅至前 7 / 後 6.5",
  "前後阻尼歸中位重新路試",
  "路試 200km 後回報",
  "加裝前防傾桿後再評估",
  "胎壓回正常值 2.5bar 再觀察",
  "車主滿意，結案",
];

// ─── 輸入範圍警告 ───
function getFieldWarning(field, value, form) {
  const v = Number(value);
  if (!value || isNaN(v)) return null;
  const max = Number(form.damping_max_clicks) || 32;
  const warns = {
    spring_rate_front: v < 3 ? "偏軟，可能晃動明顯" : v > 12 ? "極硬，確認阻尼筒能否配合" : null,
    spring_rate_rear: v < 3 ? "偏軟" : v > 12 ? "極硬" : null,
    damping_rebound_front: v > max ? `超過總段數 ${max}` : v < 1 ? "幾乎無阻尼" : null,
    damping_rebound_rear: v > max ? `超過總段數 ${max}` : null,
    damping_compression_front: v > max ? `超過總段數 ${max}` : null,
    damping_compression_rear: v > max ? `超過總段數 ${max}` : null,
    tire_pressure_front: v < 1.8 ? "過低，影響操控" : v > 3.2 ? "過高，抓地力下降" : null,
    tire_pressure_rear: v < 1.8 ? "過低" : v > 3.2 ? "過高" : null,
    preload_front: v > 20 ? "預載極高，確認是否正確" : null,
    ride_height_fingers: v < 1 ? "極低，注意刮底" : null,
  };
  return warns[field] || null;
}

// ─── 阻尼視覺化進度條 ───
function DampingBar({ value, max }) {
  const v = Number(value) || 0;
  const m = Number(max) || 32;
  const pct = Math.min(100, Math.max(0, (v / m) * 100));
  // 甜蜜點 40-60% 綠色，太軟/太硬偏移
  const color = pct > 85 ? "#ef4444" : pct > 65 ? "#f59e0b" : pct >= 35 ? "#22c55e" : pct >= 15 ? "#3b82f6" : "#64748b";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
      <div style={{ flex: 1, height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden", position: "relative" }}>
        {/* 甜蜜點參考區間 40-60% */}
        <div style={{ position: "absolute", left: "40%", width: "20%", height: "100%", background: "#22c55e11", borderLeft: "1px dashed #22c55e44", borderRight: "1px dashed #22c55e44" }} />
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
      <span style={{ color: "#64748b", fontSize: 10, fontFamily: "'JetBrains Mono'", minWidth: 36 }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

// ─── CSV 匯出 ───
function exportCSV(records) {
  const fields = ["id","created_at","license_plate","customer_name","customer_phone","car_model","shock_model","fork_type_front","fork_type_rear","drive_type","vehicle_weight","odometer","spring_rate_front","spring_rate_rear","damping_rebound_front","damping_rebound_rear","damping_compression_front","damping_compression_rear","damping_max_clicks","preload_front","preload_rear","ride_height_fingers","tire_pressure_front","tire_pressure_rear","sway_bar_front","sway_bar_rear","camber_front","camber_rear","toe_front","toe_rear","symptoms","issue_description","adjustment_notes","technician"];
  const header = fields.join(",");
  const rows = records.map(r => fields.map(f => {
    let v = r[f] ?? "";
    if (typeof v === "object") v = JSON.stringify(v);
    v = String(v).replace(/"/g, '""');
    return `"${v}"`;
  }).join(","));
  const bom = "\uFEFF";
  const csv = bom + header + "\r\n" + rows.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `避震調校紀錄_${new Date().toLocaleDateString("zh-TW").replace(/\//g, "")}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── 草稿自動儲存（localStorage）───
const DRAFT_KEY = "susp_tuner_draft_v1";
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 天
function saveDraft(form) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, ts: Date.now() })); } catch {}
}
function loadDraft() {
  try {
    const d = localStorage.getItem(DRAFT_KEY); if (!d) return null;
    const parsed = JSON.parse(d);
    // 過期草稿自動清除
    if (!parsed.ts || (Date.now() - parsed.ts) > DRAFT_MAX_AGE_MS) { localStorage.removeItem(DRAFT_KEY); return null; }
    return parsed;
  } catch { return null; }
}
function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch {} }

// ─── 分享報告圖 ───
async function shareReport(rec) {
  const c = document.createElement("canvas");
  c.width = 800; c.height = 1000;
  await renderReportCanvas(c, rec);
  // 嘗試使用 Web Share API
  if (navigator.share && navigator.canShare) {
    try {
      const blob = await new Promise(r => c.toBlob(r, "image/png"));
      const file = new File([blob], `調校報告_${rec.license_plate}.png`, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `${rec.license_plate} 避震調校報告`, text: `${rec.customer_name} · ${rec.car_model}` });
        return true;
      }
    } catch (e) { if (e.name === "AbortError") return false; }
  }
  // Fallback: 下載
  const link = document.createElement("a");
  link.download = `調校報告_${rec.license_plate}_${new Date(rec.created_at).toLocaleDateString("zh-TW").replace(/\//g,"")}.png`;
  link.href = c.toDataURL("image/png");
  link.click();
  return true;
}

async function renderReportCanvas(c, rec) {
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#0b0f1a"; ctx.fillRect(0, 0, 800, 1000);
  ctx.fillStyle = "#f59e0b"; ctx.font = "bold 28px 'Noto Sans TC',sans-serif"; ctx.textAlign = "center";
  ctx.fillText("⚡ 避震調校報告", 400, 50);
  ctx.fillStyle = "#64748b"; ctx.font = "14px 'Noto Sans TC'";
  ctx.fillText(new Date(rec.created_at).toLocaleString("zh-TW"), 400, 75);
  ctx.textAlign = "left"; ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 20px 'Noto Sans TC'";
  ctx.fillText(`${rec.license_plate}  ${rec.customer_name}`, 40, 120);
  ctx.fillStyle = "#94a3b8"; ctx.font = "16px 'Noto Sans TC'";
  ctx.fillText(`${rec.car_model} · ${rec.shock_model}${rec.vehicle_weight?` · ${rec.vehicle_weight}kg`:""}${rec.technician?` · 技師: ${rec.technician}`:""}`, 40, 148);
  ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(40, 168); ctx.lineTo(760, 168); ctx.stroke();
  const params = [
    ["彈簧（前）", rec.spring_rate_front, "kg/mm", "彈簧（後）", rec.spring_rate_rear, "kg/mm"],
    ["伸側阻尼（前）", rec.damping_rebound_front, "段", "伸側阻尼（後）", rec.damping_rebound_rear, "段"],
    ["壓側阻尼（前）", rec.damping_compression_front, "段", "壓側阻尼（後）", rec.damping_compression_rear, "段"],
    ["預載（前）", rec.preload_front, "mm", "預載（後）", rec.preload_rear, "mm"],
    ["車高", rec.ride_height_fingers, "指", "胎壓", `${rec.tire_pressure_front||"—"}/${rec.tire_pressure_rear||"—"}`, "bar"],
  ];
  let py = 200;
  params.forEach(([l1, v1, u1, l2, v2, u2]) => {
    ctx.fillStyle = "#111827"; ctx.beginPath(); ctx.roundRect(40, py, 340, 48, 8); ctx.fill();
    ctx.beginPath(); ctx.roundRect(420, py, 340, 48, 8); ctx.fill();
    ctx.fillStyle = "#64748b"; ctx.font = "13px 'Noto Sans TC'";
    ctx.fillText(l1, 56, py+20); ctx.fillText(l2, 436, py+20);
    ctx.fillStyle = "#f59e0b"; ctx.font = "bold 18px 'JetBrains Mono',monospace"; ctx.textAlign = "right";
    ctx.fillText(`${v1||"—"} ${u1}`, 364, py+36); ctx.fillText(`${v2||"—"} ${u2}`, 744, py+36);
    ctx.textAlign = "left"; py += 58;
  });
  if (rec.issue_description) {
    py += 10; ctx.fillStyle = "#f59e0b"; ctx.font = "bold 15px 'Noto Sans TC'";
    ctx.fillText("車主反映問題", 40, py); py += 24;
    ctx.fillStyle = "#cbd5e1"; ctx.font = "14px 'Noto Sans TC'";
    const text = rec.issue_description.slice(0, 300);
    let line = "";
    for (const ch of text) {
      if (ch === "\n" || line.length >= 80) { ctx.fillText(line, 40, py); py += 20; line = ch === "\n" ? "" : ch; }
      else line += ch;
    }
    if (line) { ctx.fillText(line, 40, py); py += 20; }
  }
  if (rec.symptoms && rec.symptoms.length > 0) {
    let syms = [];
    try { syms = typeof rec.symptoms === "string" ? JSON.parse(rec.symptoms || "[]") : (rec.symptoms || []); } catch {}
    if (syms.length > 0) {
      py += 10; ctx.fillStyle = "#f59e0b"; ctx.font = "bold 15px 'Noto Sans TC'";
      ctx.fillText("症狀", 40, py); py += 20;
      ctx.fillStyle = "#94a3b8"; ctx.font = "13px 'Noto Sans TC'";
      ctx.fillText(syms.map(s => SYMPTOMS.find(x => x.id === s)?.label || s).join("、"), 40, py);
    }
  }
  ctx.fillStyle = "#334155"; ctx.font = "12px 'Noto Sans TC'"; ctx.textAlign = "center";
  ctx.fillText("Suspension Tuning System", 400, 975);
}

// ═══════════════════════════════════════
//  彈簧率建議計算器
// ═══════════════════════════════════════
function calcSpringRecommendation(weight, driveType) {
  if (!weight || weight <= 0) return null;
  const w = Number(weight);
  // 前軸荷重比
  const frontRatio = driveType === "fwd" ? 0.60 : driveType === "rwd" ? 0.50 : 0.55;
  const rearRatio = 1 - frontRatio;
  const frontAxleWeight = w * frontRatio;
  const rearAxleWeight = w * rearRatio;

  // 目標自然頻率 1.2~1.8Hz（街道舒適~運動）
  // K = (2π·f)² · m / 2  (每邊彈簧，m 是半軸荷重)
  // 單位轉換：kg → N 要 ×9.81，結果 N/mm → kg/mm 要 /9.81
  const calcK = (axleWeight, freq) => {
    const halfWeight = axleWeight / 2; // 單邊
    const massKg = halfWeight;
    const omega = 2 * Math.PI * freq;
    const kNm = omega * omega * massKg; // N/m
    const kKgMm = kNm / 9810; // kg/mm
    return Math.round(kKgMm * 2) / 2; // 取 0.5 步進
  };

  return {
    front_comfort: calcK(frontAxleWeight, 1.2),
    front_balanced: calcK(frontAxleWeight, 1.5),
    front_sport: calcK(frontAxleWeight, 1.8),
    rear_comfort: calcK(rearAxleWeight, 1.2),
    rear_balanced: calcK(rearAxleWeight, 1.5),
    rear_sport: calcK(rearAxleWeight, 1.8),
    frontAxleWeight: Math.round(frontAxleWeight),
    rearAxleWeight: Math.round(rearAxleWeight),
  };
}

function SpringAdvisor({ weight, driveType, currentFront, currentRear, symptoms }) {
  const rec = calcSpringRecommendation(weight, driveType);
  if (!rec) return null;

  const cf = Number(currentFront) || 0;
  const cr = Number(currentRear) || 0;
  const syms = symptoms || [];

  // 診斷建議
  let diagnosis = [];
  if (cf > 0 && cf < rec.front_comfort) diagnosis.push({ type: "warn", text: `前彈簧 ${cf}kg 低於舒適最低值 ${rec.front_comfort}kg，車頭容易浮動搖晃` });
  if (cr > 0 && cr < rec.rear_comfort) diagnosis.push({ type: "warn", text: `後彈簧 ${cr}kg 低於舒適最低值 ${rec.rear_comfort}kg，後軸支撐不足` });
  if (cf > 0 && cr > 0 && Math.abs(cf - cr) > 2.5) diagnosis.push({ type: "warn", text: `前後落差 ${Math.abs(cf - cr).toFixed(1)}kg 偏大（建議 ≤2kg），可能造成操控失衡` });
  if (cf > rec.front_sport) diagnosis.push({ type: "info", text: `前彈簧 ${cf}kg 超過運動上限 ${rec.front_sport}kg，需確認阻尼筒能否配合` });

  if (syms.includes("bouncy")) diagnosis.push({ type: "fix", text: "跳跳車 → 彈簧率不足或阻尼回彈（Rebound）太弱，建議升磅數 + 增加回彈阻尼" });
  if (syms.includes("roll")) diagnosis.push({ type: "fix", text: "側傾大 → 彈簧率偏軟 + 防傾桿不足，建議前後同步升磅 + 考慮加裝防傾桿" });
  if (syms.includes("harsh")) diagnosis.push({ type: "fix", text: "路感太脆 → 壓縮阻尼可能太硬或彈簧過硬，建議降低壓縮阻尼 1~2 段" });
  if (syms.includes("pitch")) diagnosis.push({ type: "fix", text: "點頭/抬頭 → 前後剛性不平衡，建議前略硬於後 0.5~1.5kg" });
  if (syms.includes("float")) diagnosis.push({ type: "fix", text: "高速漂浮 → 回彈阻尼太弱 + 彈簧偏軟，建議增加回彈阻尼 + 升磅" });
  if (syms.includes("bottom")) diagnosis.push({ type: "fix", text: "觸底 → 行程不足或預載太低，建議增加預載或升磅數" });

  return (
    <div style={S.card}>
      <h3 style={S.secTitle}>🧮 彈簧率建議（依車重 {weight}kg 計算）</h3>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
        前軸荷重 ≈ {rec.frontAxleWeight}kg（{driveType === "fwd" ? "60%" : driveType === "rwd" ? "50%" : "55%"}）· 後軸 ≈ {rec.rearAxleWeight}kg
      </div>
      <div style={S.recGrid}>
        <div /><div style={S.recHead}>舒適 (1.2Hz)</div><div style={S.recHead}>均衡 (1.5Hz)</div><div style={S.recHead}>運動 (1.8Hz)</div>
        <div style={S.recLabel}>前彈簧</div>
        <RecCell v={rec.front_comfort} cur={cf} u="kg" />
        <RecCell v={rec.front_balanced} cur={cf} u="kg" hi />
        <RecCell v={rec.front_sport} cur={cf} u="kg" />
        <div style={S.recLabel}>後彈簧</div>
        <RecCell v={rec.rear_comfort} cur={cr} u="kg" />
        <RecCell v={rec.rear_balanced} cur={cr} u="kg" hi />
        <RecCell v={rec.rear_sport} cur={cr} u="kg" />
      </div>
      {cf > 0 && (
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 8, textAlign: "center" }}>
          ● = 目前設定位置（前 {cf}kg / 後 {cr || "—"}kg）
        </div>
      )}
      {diagnosis.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ color: "#f59e0b", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📋 診斷建議</div>
          {diagnosis.map((d, i) => (
            <div key={i} style={{
              padding: "8px 12px", borderRadius: 8, marginBottom: 6, fontSize: 12, lineHeight: 1.5,
              background: d.type === "warn" ? "#ef444418" : d.type === "fix" ? "#3b82f618" : "#f59e0b18",
              borderLeft: `3px solid ${d.type === "warn" ? "#ef4444" : d.type === "fix" ? "#3b82f6" : "#f59e0b"}`,
              color: "#cbd5e1",
            }}>
              {d.type === "warn" ? "⚠️" : d.type === "fix" ? "🔧" : "ℹ️"} {d.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RecCell({ v, cur, u, hi }) {
  const inRange = cur > 0 && Math.abs(cur - v) < 0.75;
  return (
    <div style={{
      padding: "6px 8px", borderRadius: 6, textAlign: "center", fontSize: 13, fontWeight: 700,
      fontFamily: "'JetBrains Mono'",
      background: inRange ? "#f59e0b22" : hi ? "#1e293b" : "#0f172a",
      border: inRange ? "1px solid #f59e0b" : "1px solid #1e293b",
      color: inRange ? "#f59e0b" : "#e2e8f0",
    }}>
      {v}{u} {inRange && "●"}
    </div>
  );
}

// ═══════════════════════════════════════
//  InputField
// ═══════════════════════════════════════
function InputField({ label, field, value, onChange, type, unit, placeholder, half, required, error, step, form: formCtx }) {
  const isNum = type === "number";
  const sv = step || STEP_MAP[field] || 1;
  // 保護：DB 回來可能是 null 或 number，React input 必須用字串
  const displayValue = value == null ? "" : String(value);
  const holdRef = useRef({ timeout: null, interval: null });
  const apply = (delta) => { const v = parseFloat(displayValue) || 0; onChange(field, String(Math.round((v + delta) * 100) / 100)); };
  const startHold = (delta) => {
    apply(delta);
    // 長按 0.4 秒後開始連續加減
    holdRef.current.timeout = setTimeout(() => {
      let accel = 1;
      holdRef.current.interval = setInterval(() => {
        apply(delta * accel);
        // 連按 1 秒後加速
        if (accel < 5) accel += 0.2;
      }, 80);
    }, 400);
  };
  const endHold = () => {
    clearTimeout(holdRef.current.timeout);
    clearInterval(holdRef.current.interval);
    holdRef.current.timeout = null; holdRef.current.interval = null;
  };
  useEffect(() => () => endHold(), []);
  const warn = formCtx ? getFieldWarning(field, displayValue, formCtx) : null;
  return (
    <div style={{ flex: half ? "1 1 45%" : "1 1 100%", minWidth: half ? 140 : 200 }} data-error={error ? "true" : undefined}>
      <label style={S.label}>{label}{required && <span style={S.req}>*</span>}</label>
      <div style={S.inputWrap}>
        {isNum && <button type="button" onMouseDown={() => startHold(-sv)} onMouseUp={endHold} onMouseLeave={endHold} onTouchStart={(e) => { e.preventDefault(); startHold(-sv); }} onTouchEnd={endHold} style={S.stepBtn} tabIndex={-1}>−</button>}
        <input type={type || "text"} value={displayValue} onChange={(e) => onChange(field, e.target.value)}
          placeholder={placeholder || label} step={isNum ? sv : undefined}
          style={{ ...S.input, ...(error ? S.inputErr : {}), ...(isNum ? S.inputNum : {}), ...(warn ? S.inputWarn : {}) }} />
        {isNum && <button type="button" onMouseDown={() => startHold(sv)} onMouseUp={endHold} onMouseLeave={endHold} onTouchStart={(e) => { e.preventDefault(); startHold(sv); }} onTouchEnd={endHold} style={S.stepBtn} tabIndex={-1}>+</button>}
        {unit && <span style={S.unit}>{unit}</span>}
      </div>
      {error && <div style={S.errText}>{error}</div>}
      {!error && warn && <div style={S.warnText}>⚠ {warn}</div>}
    </div>
  );
}
function TextArea({ label, field, value, onChange, placeholder, rows }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={S.label}>{label}</label>
      <textarea value={value == null ? "" : value} onChange={(e) => onChange(field, e.target.value)} placeholder={placeholder} style={S.textarea} rows={rows || 3} />
    </div>
  );
}

// ═══════════════════════════════════════
//  懸吊模擬（加入車重因素）
// ═══════════════════════════════════════
//  懸吊物理模型（前後分離 + 串聯輪胎剛性 + 非對稱阻尼）
// ═══════════════════════════════════════
function usePhysics(params) {
  return useMemo(() => {
    const wt = Number(params.vehicle_weight) || 1400;
    const ht = Number(params.ride_height_fingers) || 4;
    const maxClicks = Number(params.damping_max_clicks) || 32;
    // 前驅 60%、後驅 50%、四驅 55%
    const driveType = params.drive_type || "fwd";
    const frontRatio = driveType === "fwd" ? 0.60 : driveType === "rwd" ? 0.50 : 0.55;

    // 計算單軸物理量
    const calcAxis = (springRate, reboundClicks, compClicks, preload, tirePressure, axleWeightKg) => {
      const sp = Math.max(0.1, Number(springRate) || 6);
      const dr = Math.max(0, Number(reboundClicks) || 0);
      const dc = Math.max(0, Number(compClicks) || 0);
      const pl = Math.max(0, Number(preload) || 0);
      const tp = Math.max(0.5, Number(tirePressure) || 2.4); // bar
      const axleMass = Math.max(50, axleWeightKg); // 避免車重為 0

      // 彈簧剛性 kg/mm
      const k_spring = sp;
      // 輪胎剛性隨胎壓變化，每 bar 約 150 kg/mm，2.4bar 基準
      const k_tire = Math.max(50, 150 + (tp - 2.4) * 60);
      // 串聯剛性：1/K_total = 1/K_spring + 1/K_tire
      const k_total = 1 / (1 / k_spring + 1 / k_tire);

      // 單邊彈簧承重（每輪 = 軸重 / 2）
      const mass = axleMass / 2;
      // 自然頻率 f = (1/2π) · sqrt(K/m)，K 單位轉 N/m = kg/mm × 9810
      const natFreq = Math.sqrt(k_total * 9810 / mass) / (2 * Math.PI);

      // 阻尼正規化：以總段數的百分比計算實際阻尼係數
      // 臨界阻尼 Cc = 2·sqrt(K·m)
      const critical = 2 * Math.sqrt(k_total * 9810 * mass);
      // 假設滿段數對應臨界阻尼的 1.0 倍
      const dampingRebound = (dr / maxClicks) * critical;
      const dampingComp = (dc / maxClicks) * critical;
      // 平均阻尼比（用於整體衰減）
      const dampingRatio = Math.min(0.95, Math.max(0.05, ((dampingRebound + dampingComp) / 2) / critical));

      // 輸入振幅：預載高 → 初始位移吸收，胎壓影響初始剛性
      const baseAmp = Math.max(3, 55 - pl * 1.5 - (dr + dc) * 0.6);

      // 預估回彈次數（振幅衰減到 5% 所需週期）= ln(0.05)/(-ζ·2π)
      const oscillations = dampingRatio > 0.02 ? Math.max(1, Math.round(Math.log(0.05) / (-dampingRatio * 2 * Math.PI))) : 99;

      return { k_spring, k_tire, k_total, natFreq, dampingRatio, dampingRebound, dampingComp, critical, baseAmp, oscillations, sp, dr, dc, pl, tp };
    };

    const front = calcAxis(params.spring_rate_front, params.damping_rebound_front, params.damping_compression_front, params.preload_front, params.tire_pressure_front, wt * frontRatio);
    const rear = calcAxis(params.spring_rate_rear || params.spring_rate_front, params.damping_rebound_rear || params.damping_rebound_front, params.damping_compression_rear || params.damping_compression_front, params.preload_rear || params.preload_front, params.tire_pressure_rear || params.tire_pressure_front, wt * (1 - frontRatio));

    return {
      front, rear,
      heightOffset: (4 - ht) * 12,
      weight: wt,
      // 前後頻率差 — 越接近越協調，差太多會點頭
      freqMismatch: Math.abs(front.natFreq - rear.natFreq),
    };
  }, [
    params.damping_rebound_front, params.damping_compression_front, params.spring_rate_front, params.preload_front, params.tire_pressure_front,
    params.damping_rebound_rear, params.damping_compression_rear, params.spring_rate_rear, params.preload_rear, params.tire_pressure_rear,
    params.ride_height_fingers, params.vehicle_weight, params.damping_max_clicks, params.drive_type,
  ]);
}

// 非對稱阻尼自由振盪計算（壓縮/伸展各用不同阻尼）
function asymmetricOscillation(t, axisPhysics) {
  const { natFreq, dampingRebound, dampingComp, critical, baseAmp } = axisPhysics;
  const omega = natFreq * 2 * Math.PI;
  const mass = 1; // 已正規化
  // 依當下速度方向選擇阻尼（速度 > 0 表示向上伸展，用 rebound；< 0 用 compression）
  // 但為了近似解析解，我們用平均阻尼比
  const zeta = Math.min(0.95, ((dampingRebound + dampingComp) / 2) / critical);
  const omegaD = omega * Math.sqrt(Math.max(0.001, 1 - zeta * zeta));
  const decay = Math.exp(-zeta * omega * t);
  // 位移
  const x = baseAmp * decay * Math.sin(omegaD * t);
  // 速度 → 判定當下是壓縮還是伸展
  const v = baseAmp * decay * (-zeta * omega * Math.sin(omegaD * t) + omegaD * Math.cos(omegaD * t));
  return { x, v };
}

function SuspensionSim({ params, label, compact, autoReplay }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const stRef = useRef({ time: 0, bumping: false, bumpStart: 0 });
  const physics = usePhysics(params);
  const lastSigRef = useRef("");
  const [continuousOn, setContinuousOn] = useState(false);

  const triggerBump = useCallback(() => { stRef.current.bumping = true; stRef.current.bumpStart = stRef.current.time; stRef.current.continuous = false; setContinuousOn(false); }, []);
  const triggerContinuous = useCallback(() => {
    const wasContinuous = stRef.current.continuous;
    if (wasContinuous) {
      stRef.current.continuous = false;
      stRef.current.bumping = false;
      setContinuousOn(false);
    } else {
      stRef.current.bumping = true;
      stRef.current.bumpStart = stRef.current.time;
      stRef.current.continuous = true;
      setContinuousOn(true);
    }
  }, []);

  // 當主要參數變化時，自動觸發衝擊測試（讓使用者立即看到差異）
  useEffect(() => {
    if (!autoReplay) return;
    const sig = `${params.spring_rate_front}|${params.damping_rebound_front}|${params.damping_compression_front}|${params.preload_front}|${params.vehicle_weight}`;
    const hasParams = params.spring_rate_front || params.damping_rebound_front;
    if (lastSigRef.current !== sig) {
      // 連續模式中不要重置單次衝擊
      const t = setTimeout(() => { if (hasParams && !stRef.current.continuous) triggerBump(); }, lastSigRef.current ? 300 : 600);
      lastSigRef.current = sig;
      return () => clearTimeout(t);
    }
  }, [params.spring_rate_front, params.damping_rebound_front, params.damping_compression_front, params.preload_front, params.vehicle_weight, autoReplay, triggerBump]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const draw = () => {
      const W = canvas.width, H = canvas.height, st = stRef.current, t = st.time;
      const { front, rear, heightOffset, weight, freqMismatch } = physics;
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#0c101c"; ctx.fillRect(0, 0, W, H);

      // 計算前後獨立位移（不同相位、不同頻率 = 真實的點頭/抬頭）
      const roadY = H * 0.80, baseCarY = H * 0.35 + heightOffset, cx = W * 0.5;
      let frontDisp = 0, rearDisp = 0, frontVel = 0, rearVel = 0;
      let frontWheelDisp = 0, rearWheelDisp = 0;

      if (st.bumping) {
        const el = t - st.bumpStart;
        // 連續模式：每 1.2 秒重新觸發一次衝擊（像連續減速島）
        let elFront = el, elRear = Math.max(0, el - 0.2);
        if (st.continuous) {
          const period = 1.2;
          elFront = el % period;
          elRear = Math.max(0, (el - 0.2) % period);
        }
        const fResult = asymmetricOscillation(elFront, front);
        const rResult = asymmetricOscillation(elRear, rear);
        frontDisp = fResult.x; frontVel = fResult.v;
        rearDisp = rResult.x; rearVel = rResult.v;
        // 輪子位移
        frontWheelDisp = front.baseAmp * 0.25 * Math.exp(-front.dampingRatio * front.natFreq * 2 * Math.PI * elFront) * Math.sin(front.natFreq * 2 * Math.PI * elFront * 1.8);
        rearWheelDisp = rear.baseAmp * 0.25 * Math.exp(-rear.dampingRatio * rear.natFreq * 2 * Math.PI * elRear) * Math.sin(rear.natFreq * 2 * Math.PI * elRear * 1.8);
        // 停止條件（非連續模式）
        if (!st.continuous && el > 6 && Math.abs(frontDisp) < 0.3 && Math.abs(rearDisp) < 0.3) st.bumping = false;
      } else {
        // 待機微震
        frontDisp = Math.sin(t * 2) * 0.8;
        rearDisp = Math.sin(t * 2 + 0.3) * 0.7;
        frontWheelDisp = Math.sin(t * 3.5) * 0.4;
        rearWheelDisp = Math.sin(t * 3.2) * 0.35;
      }

      // 車身傾斜：前後位移不同 → 車頭抬高或壓低（點頭效應）
      const pitch = (rearDisp - frontDisp) * 0.3; // 弧度感
      const carY = baseCarY + (frontDisp + rearDisp) / 2;
      const wYfront = roadY - 20 + frontWheelDisp * 0.3;
      const wYrear = roadY - 20 + rearWheelDisp * 0.3;

      // Road
      ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2; ctx.beginPath();
      for (let x = 0; x < W; x++) ctx.lineTo(x, roadY + Math.sin((x + t * 20) * 0.05) * 3);
      ctx.stroke(); ctx.fillStyle = "#0a0e18"; ctx.fillRect(0, roadY + 6, W, H);
      ctx.strokeStyle = "#f59e0b22"; ctx.lineWidth = 2; ctx.setLineDash([16, 24]);
      ctx.beginPath(); ctx.moveTo(0, roadY + 14); ctx.lineTo(W, roadY + 14); ctx.stroke(); ctx.setLineDash([]);

      // 衝擊波標示（前輪先、後輪後）
      if (st.bumping) {
        const el = t - st.bumpStart;
        if (st.continuous) {
          // 連續路面的波浪凸起，視覺上像移動的減速島
          ctx.fillStyle = "#f59e0b66";
          for (let i = 0; i < 5; i++) {
            const bx = ((i * 160 + t * 60) % (W + 80)) - 40;
            ctx.beginPath();
            ctx.moveTo(bx - 20, roadY);
            ctx.quadraticCurveTo(bx, roadY - 10, bx + 20, roadY);
            ctx.fill();
          }
        } else {
          if (el < 0.3) {
            ctx.fillStyle = "#ef444488"; ctx.beginPath();
            ctx.moveTo(cx + 50, roadY); ctx.quadraticCurveTo(cx + 80, roadY - 18, cx + 110, roadY); ctx.fill();
          }
          if (el > 0.15 && el < 0.45) {
            ctx.fillStyle = "#ef444488"; ctx.beginPath();
            ctx.moveTo(cx - 110, roadY); ctx.quadraticCurveTo(cx - 80, roadY - 18, cx - 50, roadY); ctx.fill();
          }
        }
      }

      // 車身位置（加入傾斜）
      const frontY = carY + pitch * 30;
      const rearY = carY - pitch * 30;

      // 繪製懸吊柱（壓縮/伸展用顏色區別）
      const drawStrut = (x, carAttachY, wheelY, velocity, axisData) => {
        const top = carAttachY + 42, bot = wheelY - 8;
        const len = bot - top;
        // 阻尼筒顏色：壓縮=紅、伸展=藍、靜止=灰
        let strutColor = "#64748b";
        if (st.bumping) {
          if (velocity > 1) strutColor = "#3b82f6"; // 伸展（往上拉）
          else if (velocity < -1) strutColor = "#ef4444"; // 壓縮（被壓）
        }
        ctx.strokeStyle = strutColor; ctx.lineWidth = 9; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + len * 0.4); ctx.stroke();
        ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, top + len * 0.4); ctx.lineTo(x, bot); ctx.stroke();
        // 彈簧
        const coils = Math.max(4, 8 - Math.floor(axisData.sp / 3));
        ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
        for (let i = 0; i <= coils * 2; i++) {
          const py = top + (len * i) / (coils * 2), px = x + (i % 2 === 0 ? -15 : 15);
          i === 0 ? ctx.moveTo(x, py) : ctx.lineTo(px, py);
        }
        ctx.lineTo(x, bot); ctx.stroke();
      };
      drawStrut(cx + 80, frontY, wYfront, frontVel, front); // 前輪在右（車頭朝右）
      drawStrut(cx - 80, rearY, wYrear, rearVel, rear);

      // Car（加入 pitch 傾斜）
      ctx.save();
      ctx.translate(cx, carY);
      ctx.rotate(pitch * 0.02);
      ctx.translate(-cx, -carY);

      ctx.fillStyle = "#00000044"; ctx.beginPath(); ctx.ellipse(cx, roadY + 2, 105, 6, 0, 0, Math.PI * 2); ctx.fill();
      const grd = ctx.createLinearGradient(cx - 120, carY - 40, cx + 120, carY + 45);
      grd.addColorStop(0, "#1e293b"); grd.addColorStop(0.5, "#253349"); grd.addColorStop(1, "#1a2332");
      ctx.fillStyle = grd; ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(cx-115,carY+32); ctx.lineTo(cx-105,carY+5); ctx.lineTo(cx-65,carY-22); ctx.lineTo(cx-32,carY-42);
      ctx.lineTo(cx+38,carY-42); ctx.lineTo(cx+72,carY-22); ctx.lineTo(cx+112,carY+5); ctx.lineTo(cx+118,carY+32);
      ctx.lineTo(cx+112,carY+44); ctx.lineTo(cx-108,carY+44); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#0ea5e918"; ctx.strokeStyle = "#0ea5e933"; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(cx-58,carY-18); ctx.lineTo(cx-30,carY-38); ctx.lineTo(cx+34,carY-38); ctx.lineTo(cx+65,carY-18); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fbbf24"; ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 15;
      ctx.beginPath(); ctx.ellipse(cx+112,carY+16,5,9,0,0,Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = "#ef4444"; ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.ellipse(cx-107,carY+16,4,8,0,0,Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.restore();

      // Wheels
      const drawWheel = (x, y) => {
        ctx.fillStyle = "#0f172a"; ctx.strokeStyle = "#334155"; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#475569"; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "#64748b"; ctx.lineWidth = 1.5;
        for (let i = 0; i < 5; i++) { const a = (Math.PI*2*i)/5 + t*2;
          ctx.beginPath(); ctx.moveTo(x+Math.cos(a)*6, y+Math.sin(a)*6); ctx.lineTo(x+Math.cos(a)*14, y+Math.sin(a)*14); ctx.stroke(); }
      };
      drawWheel(cx + 80, wYfront); drawWheel(cx - 80, wYrear);

      // 觸底警告（壓縮行程超過 80% 時閃紅）
      const frontCompRatio = Math.max(0, -frontDisp) / front.baseAmp;
      const rearCompRatio = Math.max(0, -rearDisp) / rear.baseAmp;
      if (st.bumping && (frontCompRatio > 0.9 || rearCompRatio > 0.9)) {
        ctx.fillStyle = `rgba(239,68,68,${0.2 + Math.sin(t * 20) * 0.2})`;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#ef4444"; ctx.font = "bold 13px 'Noto Sans TC'"; ctx.textAlign = "center";
        ctx.fillText("⚠ 觸底！行程不足", W / 2, H / 2);
      }

      // HUD
      const totalMag = Math.max(Math.abs(frontDisp), Math.abs(rearDisp));
      const clr = totalMag > 25 ? "#ef4444" : totalMag > 12 ? "#f59e0b" : "#22c55e";
      ctx.fillStyle = clr; ctx.font = "bold 13px 'JetBrains Mono',monospace"; ctx.textAlign = "left";
      ctx.fillText(`前: ${Math.abs(frontDisp).toFixed(1)}mm  後: ${Math.abs(rearDisp).toFixed(1)}mm`, 14, 22);
      ctx.fillStyle = "#1e293b"; ctx.beginPath(); ctx.roundRect(14, 28, 140, 8, 4); ctx.fill();
      ctx.fillStyle = clr; ctx.beginPath(); ctx.roundRect(14, 28, Math.min(140, totalMag*2.8), 8, 4); ctx.fill();
      const stat = totalMag > 25 ? "⚠ 過度晃動" : totalMag > 12 ? "△ 偏軟" : "✓ 穩定";
      ctx.fillStyle = clr; ctx.font = "bold 11px 'Noto Sans TC',sans-serif"; ctx.fillText(stat, 14, 52);
      // 點頭指示
      if (Math.abs(pitch) > 0.05) {
        ctx.fillStyle = "#fbbf24"; ctx.font = "10px 'Noto Sans TC'";
        ctx.fillText(pitch > 0 ? "↗ 車頭抬升" : "↘ 車頭下壓", 14, 68);
      }
      if (st.bumping) {
        ctx.fillStyle = "#94a3b8"; ctx.font = "10px 'JetBrains Mono'";
        const maxOsc = Math.max(front.oscillations, rear.oscillations);
        ctx.fillText(`預估回彈 ${maxOsc === 99 ? "∞" : `≈ ${maxOsc}`} 次`, 14, 84);
      }
      if (!compact) {
        ctx.fillStyle = "#64748b"; ctx.font = "10px 'JetBrains Mono',monospace"; ctx.textAlign = "right";
        ctx.fillText(`${weight}kg | 前 ${front.sp}kg·${front.natFreq.toFixed(2)}Hz·ζ${front.dampingRatio.toFixed(2)}`, W-14, 22);
        ctx.fillText(`後 ${rear.sp}kg·${rear.natFreq.toFixed(2)}Hz·ζ${rear.dampingRatio.toFixed(2)}`, W-14, 36);
        if (freqMismatch > 0.3) {
          ctx.fillStyle = "#fbbf24";
          ctx.fillText(`⚠ 前後頻率差 ${freqMismatch.toFixed(2)}Hz（建議 <0.3）`, W-14, 50);
        }
      }
      if (label) { ctx.fillStyle = label === "調整前" ? "#ef4444" : "#22c55e"; ctx.font = "bold 14px 'Noto Sans TC'"; ctx.textAlign = "center"; ctx.fillText(label, W/2, H-10); }

      // 阻尼方向指示（壓縮/伸展箭頭）
      if (st.bumping && !compact) {
        const showArrow = (x, vel) => {
          if (Math.abs(vel) < 2) return;
          const up = vel > 0;
          ctx.fillStyle = up ? "#3b82f6" : "#ef4444";
          ctx.font = "bold 16px sans-serif"; ctx.textAlign = "center";
          ctx.fillText(up ? "↑" : "↓", x, carY - 50);
          ctx.font = "9px 'Noto Sans TC'";
          ctx.fillText(up ? "伸" : "壓", x, carY - 66);
        };
        showArrow(cx + 80, frontVel);
        showArrow(cx - 80, rearVel);
      }

      st.time += 0.02; animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [physics, label, compact]);

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={canvasRef} width={600} height={compact ? 240 : 320} style={{ width: "100%", height: "auto", borderRadius: 12, border: "1px solid #1e293b", display: "block" }} />
      <div style={{position:"absolute",bottom:12,right:12,display:"flex",gap:6}}>
        <button onClick={triggerContinuous} style={{...S.contBumpBtn, ...(continuousOn ? {background:"#3b82f6",color:"#fff",borderColor:"#3b82f6"}:{})}} title={continuousOn?"點擊停止":"連續路面（減速島、碎震路）"}>🌊{continuousOn ? " ON" : ""}</button>
        <button onClick={triggerBump} style={S.bumpBtn}>💥 衝擊測試</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  比較波形
// ═══════════════════════════════════════
function CompareWaveform({ before, after }) {
  const canvasRef = useRef(null);
  const calc = (p) => {
    const sp = Number(p.spring_rate_front) || 6;
    const wt = Number(p.vehicle_weight) || 1400;
    const dr = Number(p.damping_rebound_front) || 0;
    const dc = Number(p.damping_compression_front) || 0;
    const pl = Number(p.preload_front) || 0;
    const tp = Number(p.tire_pressure_front) || 2.4;
    const maxClicks = Number(p.damping_max_clicks) || 32;
    const driveType = p.drive_type || "fwd";
    const frontRatio = driveType === "fwd" ? 0.60 : driveType === "rwd" ? 0.50 : 0.55;
    const mass = wt * frontRatio / 2;
    const k_tire = 150 + (tp - 2.4) * 60;
    const k_total = 1 / (1 / sp + 1 / k_tire);
    const f = Math.sqrt(k_total * 9810 / mass) / (2 * Math.PI);
    const critical = 2 * Math.sqrt(k_total * 9810 * mass);
    const z = Math.min(0.95, Math.max(0.05, ((dr + dc) / 2 / maxClicks * critical) / critical));
    const a = Math.max(3, 55 - pl * 1.5 - (dr + dc) * 0.6);
    return { z, f, a };
  };
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"), W = c.width, H = c.height;
    ctx.clearRect(0,0,W,H); ctx.fillStyle = "#0c101c"; ctx.fillRect(0,0,W,H);
    for (let y = 0; y < H; y += 40) { ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    ctx.strokeStyle = "#334155"; ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();
    [{p:calc(before),c:"#ef4444",n:"調整前"},{p:calc(after),c:"#22c55e",n:"調整後"}].forEach(({p,c:clr,n},i) => {
      const w = p.f*Math.PI*2, wd = w*Math.sqrt(Math.max(0.001,1-p.z*p.z));
      ctx.strokeStyle = clr; ctx.lineWidth = 2.5; ctx.beginPath();
      for (let x=0;x<W;x++){const t=(x/W)*4;const y=H/2-p.a*Math.exp(-p.z*w*t)*Math.sin(wd*t)*(H*0.008);x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);} ctx.stroke();
      ctx.strokeStyle = clr+"44"; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
      ctx.beginPath(); for(let x=0;x<W;x++){const t=(x/W)*4;ctx.lineTo(x,H/2-p.a*Math.exp(-p.z*w*t)*(H*0.008));} ctx.stroke();
      ctx.beginPath(); for(let x=0;x<W;x++){const t=(x/W)*4;ctx.lineTo(x,H/2+p.a*Math.exp(-p.z*w*t)*(H*0.008));} ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = clr; ctx.font = "bold 13px 'Noto Sans TC'"; ctx.textAlign = "left"; ctx.fillText(`● ${n}`,10,i===0?22:42);
      ctx.fillStyle = "#94a3b8"; ctx.font = "11px 'JetBrains Mono'"; ctx.fillText(`振幅${p.a.toFixed(0)}mm ζ=${p.z.toFixed(2)} f=${p.f.toFixed(1)}Hz`,90,i===0?22:42);
    });
    ctx.fillStyle = "#475569"; ctx.font = "10px 'JetBrains Mono'"; ctx.textAlign = "center";
    for (let s=0;s<=4;s++) ctx.fillText(`${s}s`,(s/4)*W,H-4);
  }, [before, after]);
  return <canvas ref={canvasRef} width={600} height={220} style={{width:"100%",height:"auto",borderRadius:12,border:"1px solid #1e293b",display:"block"}} />;
}

// ═══════════════════════════════════════
//  Sparkline + Stats + ParamItem + ParamMini + ExportReport
// ═══════════════════════════════════════
function Sparkline({records,field,label,unit,color}){
  const canvasRef = useRef(null);
  const vals = useMemo(() => records.map(r => Number(r[field]) || 0).reverse(), [records, field]);
  useEffect(()=>{const c=canvasRef.current;if(!c||vals.length<2)return;const ctx=c.getContext("2d"),W=c.width,H=c.height;const mn=Math.min(...vals),mx=Math.max(...vals),rng=mx-mn||1;ctx.clearRect(0,0,W,H);
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();vals.forEach((v,i)=>{const x=(i/(vals.length-1))*W,y=H-4-((v-mn)/rng)*(H-8);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)});ctx.stroke();
    vals.forEach((v,i)=>{const x=(i/(vals.length-1))*W,y=H-4-((v-mn)/rng)*(H-8);ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill()});},[vals,color]);
  if(vals.length<2)return null;
  return(<div style={{flex:"1 1 120px",minWidth:120}}><div style={{color:"#64748b",fontSize:10,marginBottom:2}}>{label}</div><canvas ref={canvasRef} width={120} height={40} style={{width:"100%",height:40,display:"block"}}/><div style={{color:"#94a3b8",fontSize:10,display:"flex",justifyContent:"space-between"}}><span>{vals[0]}{unit}</span><span>{vals[vals.length-1]}{unit}</span></div></div>);
}

function StatsDashboard({records}){const now=new Date();const tm=records.filter(r=>{const d=new Date(r.created_at);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()});
  const plates=new Set(records.map(r=>r.license_plate));const rp=[...plates].filter(p=>records.filter(r=>r.license_plate===p).length>1);
  return(<div style={S.statsGrid}>{[{l:"總紀錄",v:records.length,i:"📊"},{l:"不同車輛",v:plates.size,i:"🚗"},{l:"本月調校",v:tm.length,i:"📅"},{l:"回訪車輛",v:rp.length,i:"🔄"}].map(s=>(<div key={s.l} style={S.statCard}><div style={{fontSize:20}}>{s.i}</div><div style={{fontSize:22,fontWeight:800,color:"#f59e0b",fontFamily:"'JetBrains Mono'"}}>{s.v}</div><div style={{fontSize:11,color:"#64748b"}}>{s.l}</div></div>))}</div>);}

function ParamItem({label,value,unit}){return(<div style={S.paramItem}><div style={S.paramLabel}>{label}</div><div style={S.paramValue}>{value||"—"}{value&&unit&&<span style={S.paramUnit}>{unit}</span>}</div></div>);}
function ParamMini({rec}){return(<div style={{fontSize:12,color:"#94a3b8"}}>{[["彈簧前/後",`${rec.spring_rate_front||"—"}/${rec.spring_rate_rear||"—"} kg`],["伸側阻尼前/後",`${rec.damping_rebound_front||"—"}/${rec.damping_rebound_rear||"—"}`],["壓側阻尼前/後",`${rec.damping_compression_front||"—"}/${rec.damping_compression_rear||"—"}`],["預載前/後",`${rec.preload_front||"—"}/${rec.preload_rear||"—"} mm`],["車高",`${rec.ride_height_fingers||"—"} 指`]].map(([k,v])=>(<div key={k} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #1e293b"}}><span>{k}</span><span style={{color:"#e2e8f0"}}>{v}</span></div>))}</div>);}

async function exportReport(rec) {
  const c = document.createElement("canvas");
  c.width = 800; c.height = 1000;
  await renderReportCanvas(c, rec);
  const link = document.createElement("a");
  link.download = `調校報告_${rec.license_plate}_${new Date(rec.created_at).toLocaleDateString("zh-TW").replace(/\//g,"")}.png`;
  link.href = c.toDataURL("image/png"); link.click();
}

// ═══════════════════════════════════════
//  主程式
// ═══════════════════════════════════════
export default function App() {
  const [page, setPage] = useState("form");
  const [form, setForm] = useState({ ...EMPTY });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [records, setRecords] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [selected, setSelected] = useState(null);
  const [compareA, setCompareA] = useState(null);
  const [compareB, setCompareB] = useState(null);
  const [showCompare, setShowCompare] = useState(false);
  const [expandedPlate, setExpandedPlate] = useState(null);
  const [showPresets, setShowPresets] = useState(false);
  const [delConfirm, setDelConfirm] = useState(null);
  const [continueMode, setContinueMode] = useState(false);
  const [plateMatch, setPlateMatch] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [dateFilter, setDateFilter] = useState("");
  const [draftAvailable, setDraftAvailable] = useState(false);
  const [customerSelected, setCustomerSelected] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [showTopBtn, setShowTopBtn] = useState(false);
  const HISTORY_PAGE_SIZE = 20;

  const toastTimerRef = useRef(null);
  const showToast = (msg, type = "success") => {
    // 觸覺回饋（行動裝置）
    if (navigator.vibrate) navigator.vibrate(type === "error" ? [30, 50, 30] : 20);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => { setToast(null); toastTimerRef.current = null; }, type === "error" ? 6000 : 3200);
  };
  const handleChange = useCallback((field, value) => {
    // 車牌自動轉大寫
    if (field === "license_plate") value = value.toUpperCase();
    // 電話自動格式化：0912345678 → 0912-345-678
    if (field === "customer_phone") {
      const digits = value.replace(/\D/g, "");
      if (digits.length > 4 && digits.length <= 7) value = `${digits.slice(0, 4)}-${digits.slice(4)}`;
      else if (digits.length > 7) value = `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 10)}`;
      else value = digits;
    }
    setForm(p => ({ ...p, [field]: value }));
    setTouched(p => ({ ...p, [field]: true }));
    setErrors(p => { if (p[field] && value.toString().trim()) { const n = { ...p }; delete n[field]; return n; } return p; });
    // 車牌自動帶入偵測
    if (field === "license_plate" && value.length >= 3) {
      const match = records.find(r => (r.license_plate || "").toUpperCase() === value.toUpperCase());
      setPlateMatch(match && !editingId ? match : null);
    } else if (field === "license_plate") { setPlateMatch(null); }
  }, [records, editingId]);
  const autoFillPlate = useCallback(() => {
    if (!plateMatch) return;
    const keep = ["license_plate","customer_name","customer_phone","car_model","shock_model","fork_type_front","fork_type_rear","drive_type","vehicle_weight","damping_max_clicks"];
    const filled = {};
    keep.forEach(k => { if (plateMatch[k] != null && plateMatch[k] !== "") filled[k] = plateMatch[k]; });
    setForm(p => ({ ...p, ...filled }));
    setPlateMatch(null);
    showToast("已帶入車主資料");
  }, [plateMatch]);
  const toggleSymptom = useCallback((id) => {
    setForm(p => { const curr = Array.isArray(p.symptoms) ? p.symptoms : []; return { ...p, symptoms: curr.includes(id) ? curr.filter(s => s !== id) : [...curr, id] }; });
  }, []);
  const validate = useCallback(() => {
    const e = {}; Object.entries(REQUIRED).forEach(([f, l]) => { if (!form[f] || !form[f].toString().trim()) e[f] = `${l} 為必填`; });
    setErrors(e); const allT = {}; Object.keys(REQUIRED).forEach(k => (allT[k] = true)); setTouched(p => ({ ...p, ...allT }));
    return Object.keys(e).length === 0;
  }, [form]);
  const applyFilters = useCallback((src, q, dateF) => {
    let result = Array.isArray(src) ? src : [];
    const qq = (q || "").trim().toLowerCase();
    if (qq) {
      result = result.filter(r =>
        [r.license_plate, r.customer_name, r.car_model, r.shock_model, r.customer_phone, r.technician]
          .some(s => (s || "").toLowerCase().includes(qq))
      );
    }
    if (dateF) {
      const days = dateF === "7d" ? 7 : dateF === "30d" ? 30 : dateF === "90d" ? 90 : 0;
      if (days > 0) { const start = new Date(Date.now() - days * 864e5); result = result.filter(r => new Date(r.created_at) >= start); }
    }
    return result;
  }, []);
  const fetchRecords = useCallback(async () => { if (!DB_OK) return; setLoading(true); const { data } = await api("suspension_records").select(); if (data) { setRecords(data); setFiltered(applyFilters(data, search, dateFilter)); } setLoading(false); }, [applyFilters, search, dateFilter]);
  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // 草稿偵測
  useEffect(() => {
    const d = loadDraft();
    if (d && d.form && d.form.license_plate) { setDraftAvailable(true); }
  }, []);

  // 自動儲存草稿（只在表單頁、非編輯模式、有填內容時）
  useEffect(() => {
    if (page !== "form" || editingId) return;
    const hasContent = form.license_plate || form.customer_name || form.car_model;
    if (!hasContent) return;
    const t = setTimeout(() => saveDraft(form), 800);
    return () => clearTimeout(t);
  }, [form, page, editingId]);

  const restoreDraft = () => {
    const d = loadDraft();
    if (d && d.form) { setForm(d.form); setDraftAvailable(false); showToast("已還原草稿"); }
  };
  const discardDraft = () => { clearDraft(); setDraftAvailable(false); showToast("已捨棄草稿"); };

  // Back-to-top 按鈕顯示邏輯
  useEffect(() => {
    const onScroll = () => setShowTopBtn(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 未儲存資料離開警告
  useEffect(() => {
    const hasUnsaved = editingId || (page === "form" && (form.license_plate || form.car_model));
    if (!hasUnsaved) return;
    const beforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [editingId, page, form.license_plate, form.car_model]);

  // 無限滾動偵測（歷史頁）
  const loadMoreRef = useRef(null);
  useEffect(() => {
    if (page !== "history") return;
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setHistoryPage(p => p + 1);
    }, { rootMargin: "200px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [page, historyPage, filtered.length]);
  const handleSearch = val => { setSearch(val); setFiltered(applyFilters(records, val, dateFilter)); setHistoryPage(1); };
  const handleDateFilter = val => { setDateFilter(val); setFiltered(applyFilters(records, search, val)); setHistoryPage(1); };
  const handleSave = async () => {
    if (!validate()) { showToast("請填寫所有必填欄位（標示 * 的欄位）", "error"); setTimeout(() => { document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 100); return; }
    const resetForm = () => {
      if (continueMode) {
        // 保留車輛基本資料，清空調校參數
        const keep = { license_plate: form.license_plate, customer_name: form.customer_name, customer_phone: form.customer_phone, car_model: form.car_model, shock_model: form.shock_model, fork_type_front: form.fork_type_front, fork_type_rear: form.fork_type_rear, drive_type: form.drive_type, vehicle_weight: form.vehicle_weight, damping_max_clicks: form.damping_max_clicks, technician: form.technician };
        setForm({ ...EMPTY, ...keep });
      } else { setForm({ ...EMPTY }); }
      setErrors({}); setTouched({});
    };
    setSaving(true); const payload = cleanNumericFields({ ...form, symptoms: Array.isArray(form.symptoms) ? form.symptoms : [], created_at: new Date().toISOString() });
    if (!DB_OK) { const nr = { ...payload, id: Date.now() }; setRecords(p => [nr, ...p]); setFiltered(p => [nr, ...p]); resetForm(); clearDraft(); showToast("已儲存（本地模式）"); window.scrollTo({ top: 0, behavior: "smooth" }); setSaving(false); return; }
    const { error } = await api("suspension_records").insert([payload]);
    if (error) showToast("儲存失敗", "error"); else { showToast("紀錄已儲存！"); resetForm(); clearDraft(); fetchRecords(); window.scrollTo({ top: 0, behavior: "smooth" }); } setSaving(false);
  };
  const handleDelete = async (id) => {
    // 清除相關狀態，避免幽靈引用
    const rec = records.find(r => r.id === id);
    if (compareA?.id === id) setCompareA(null);
    if (compareB?.id === id) setCompareB(null);
    if (selected?.id === id) { setSelected(null); if (page === "detail") setPage("history"); }
    if (editingId === id) { setEditingId(null); setForm({ ...EMPTY }); }
    // 若刪除的是該車牌的最後一筆且目前在客戶詳情頁，返回列表
    if (rec && customerSelected === rec.license_plate) {
      const remaining = records.filter(r => r.license_plate === rec.license_plate && r.id !== id);
      if (remaining.length === 0 && page === "customerDetail") { setCustomerSelected(null); setPage("customers"); }
    }
    if (!DB_OK) { setRecords(p => p.filter(r => r.id !== id)); setFiltered(p => p.filter(r => r.id !== id)); showToast("已刪除"); setDelConfirm(null); return; }
    const { error } = await api("suspension_records").del(id); if (error) showToast("刪除失敗", "error"); else { showToast("已刪除"); fetchRecords(); } setDelConfirm(null);
  };
  const cleanNumericFields = (obj) => {
    const numFields = ["vehicle_weight","odometer","spring_rate_front","spring_rate_rear","damping_rebound_front","damping_rebound_rear","damping_compression_front","damping_compression_rear","damping_max_clicks","preload_front","preload_rear","ride_height_fingers","tire_pressure_front","tire_pressure_rear","camber_front","camber_rear","toe_front","toe_rear"];
    const out = { ...obj };
    for (const f of numFields) {
      if (out[f] === "" || out[f] === undefined) out[f] = null;
      else if (typeof out[f] === "string") { const n = Number(out[f]); if (!isNaN(n)) out[f] = n; }
    }
    return out;
  };
  const safeParseSymptoms = (s) => { try { return typeof s === "string" ? JSON.parse(s || "[]") : (s || []); } catch { return []; } };
  const handleCopy = rec => { const { id, created_at, ...rest } = rec; const syms = safeParseSymptoms(rest.symptoms);
    if (rest.fork_type && !rest.fork_type_front) { rest.fork_type_front = rest.fork_type; rest.fork_type_rear = "conventional"; }
    setForm({ ...EMPTY, ...rest, symptoms: syms }); setErrors({}); setTouched({}); setPage("form"); showToast("已載入紀錄到表單"); };
  const applyPreset = preset => { const { name, ...vals } = preset; setForm(p => ({ ...p, ...vals })); setShowPresets(false); window.scrollTo({ top: 0, behavior: "smooth" }); showToast(`已套用「${name}」`); };
  const handleEdit = rec => { const { id, created_at, ...rest } = rec; const syms = safeParseSymptoms(rest.symptoms);
    if (rest.fork_type && !rest.fork_type_front) { rest.fork_type_front = rest.fork_type; rest.fork_type_rear = "conventional"; }
    setForm({ ...EMPTY, ...rest, symptoms: syms }); setEditingId(id); setErrors({}); setTouched({}); setPage("form"); showToast("編輯模式 — 修改後點儲存"); };
  const handleUpdate = async () => {
    if (!validate()) { showToast("請填寫必填欄位", "error"); return; }
    setSaving(true); const payload = cleanNumericFields({ ...form, symptoms: Array.isArray(form.symptoms) ? form.symptoms : [] });
    const syncState = (updatedRec) => {
      // 同步 compare/selected 引用，避免拿到舊資料
      if (compareA?.id === editingId) setCompareA(updatedRec);
      if (compareB?.id === editingId) setCompareB(updatedRec);
      if (selected?.id === editingId) setSelected(updatedRec);
    };
    const done = () => { setEditingId(null); setForm({ ...EMPTY }); setErrors({}); setTouched({}); window.scrollTo({ top: 0, behavior: "smooth" }); };
    if (!DB_OK) {
      const updatedRec = { ...records.find(r => r.id === editingId), ...payload };
      setRecords(p => p.map(r => r.id === editingId ? updatedRec : r));
      setFiltered(p => p.map(r => r.id === editingId ? updatedRec : r));
      syncState(updatedRec);
      done(); showToast("已更新（本地模式）"); setSaving(false); return;
    }
    const { data, error } = await api("suspension_records").update(editingId, payload);
    if (error) showToast("更新失敗", "error"); else {
      const updatedRec = Array.isArray(data) ? data[0] : data;
      if (updatedRec) syncState(updatedRec);
      showToast("紀錄已更新！"); done(); fetchRecords();
    } setSaving(false);
  };

  const kbRef = useRef({});
  kbRef.current = { handleSave, handleUpdate, editingId, page, saving, delConfirm, showCompare };
  useEffect(() => {
    const onKey = (e) => {
      const s = kbRef.current;
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (s.page === "form" && !s.saving) { s.editingId ? s.handleUpdate() : s.handleSave(); }
      }
      else if ((e.ctrlKey || e.metaKey) && e.key === "n" && !e.shiftKey) {
        e.preventDefault();
        setPage("form"); setForm({ ...EMPTY }); setEditingId(null); setErrors({}); setTouched({});
      }
      else if (e.key === "Escape") {
        if (s.delConfirm) { setDelConfirm(null); return; }
        if (s.showCompare) { setShowCompare(false); return; }
        if (s.page === "detail") setPage("history");
        else if (s.page === "customerDetail") setPage("customers");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const errFor = f => (touched[f] && errors[f]) ? errors[f] : null;
  const missingN = Object.keys(REQUIRED).filter(k => !form[k] || !form[k].toString().trim()).length;
  const parseSymptoms = rec => safeParseSymptoms(rec?.symptoms);

  // ─── FORM ───
  const renderForm = () => (
    <div style={S.page}>
      {draftAvailable && !editingId && <div style={S.draftBanner}>
        <span>💾 偵測到未完成的草稿</span>
        <div style={{display:"flex",gap:8}}>
          <button onClick={restoreDraft} style={S.compareTrigger}>還原</button>
          <button onClick={discardDraft} style={S.cancelBtn}>捨棄</button>
        </div>
      </div>}
      <div style={S.card}><h3 style={S.secTitle}>⚡ 即時懸吊模擬</h3><p style={S.secDesc}>輸入或調整參數後會自動衝擊測試，也可手動點右下按鈕</p><SuspensionSim params={form} autoReplay /></div>
      {/* 範本 */}
      <div style={S.card}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><h3 style={{...S.secTitle,marginBottom:0}}>🏎️ 快速範本</h3><button onClick={()=>setShowPresets(!showPresets)} style={S.toggleBtn}>{showPresets?"收合 ▲":"展開 ▼"}</button></div>
        {showPresets&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>{PRESETS.map(p=>(<button key={p.name} onClick={()=>applyPreset(p)} style={S.presetBtn}><div style={{fontWeight:700,fontSize:13}}>{p.name}</div><div style={{fontSize:10,color:"#64748b",marginTop:2}}>前{p.spring_rate_front}/後{p.spring_rate_rear}kg {p.vehicle_weight}kg</div></button>))}</div>}
      </div>
      {/* 基本資料 */}
      <div style={S.card}><h3 style={S.secTitle}>🚗 車輛與基本資料</h3>
        <div style={S.row}>
          <div style={{flex:"1 1 45%",minWidth:140,position:"relative"}}>
            <InputField label="車牌號碼" field="license_plate" value={form.license_plate} onChange={handleChange} placeholder="ABC-1234" required error={errFor("license_plate")} />
            {plateMatch && <button onClick={autoFillPlate} style={S.autoFillBtn}>🔄 帶入「{plateMatch.customer_name}」的資料</button>}
          </div>
          <InputField label="車主姓名" field="customer_name" value={form.customer_name} onChange={handleChange} placeholder="王大明" half required error={errFor("customer_name")} />
        </div>
        <div style={S.row}><InputField label="電話" field="customer_phone" value={form.customer_phone} onChange={handleChange} placeholder="0912-345-678" half /><InputField label="里程數" field="odometer" value={form.odometer} onChange={handleChange} type="number" unit="km" placeholder="35000" half /></div>
        <div style={S.row}><InputField label="車型" field="car_model" value={form.car_model} onChange={handleChange} placeholder="MG HS 1.5T" half required error={errFor("car_model")} /><InputField label="避震型號" field="shock_model" value={form.shock_model} onChange={handleChange} placeholder="BC BR / KW V3..." half required error={errFor("shock_model")} /></div>
        <div style={S.row}><InputField label="車重" field="vehicle_weight" value={form.vehicle_weight} onChange={handleChange} type="number" unit="kg" placeholder="1548" half /><InputField label="阻尼總段數" field="damping_max_clicks" value={form.damping_max_clicks} onChange={handleChange} type="number" unit="段" half /></div>
        <div style={{marginBottom:12}}><label style={S.label}>驅動方式</label><div style={S.chipRow}>{DRIVE_OPTS.map(o=>(<button key={o.value} onClick={()=>handleChange("drive_type",o.value)} style={{...S.chip,...(form.drive_type===o.value?S.chipOn:{})}}>{o.label}</button>))}</div></div>
        <div style={{marginBottom:12}}><label style={S.label}>前懸吊型式</label><div style={S.chipRow}>{FORK_OPTS.map(o=>(<button key={o.value} onClick={()=>handleChange("fork_type_front",o.value)} style={{...S.chip,...(form.fork_type_front===o.value?S.chipOn:{})}}>{o.label}</button>))}</div></div>
        <div style={{marginBottom:12}}><label style={S.label}>後懸吊型式</label><div style={S.chipRow}>{FORK_OPTS.map(o=>(<button key={o.value} onClick={()=>handleChange("fork_type_rear",o.value)} style={{...S.chip,...(form.fork_type_rear===o.value?S.chipOn:{})}}>{o.label}</button>))}</div></div>
        <div style={{position:"relative"}}>
          <InputField label="技師" field="technician" value={form.technician} onChange={handleChange} placeholder="技師名稱" />
          {form.technician && [...new Set(records.map(r=>r.technician).filter(t=>t && t.toLowerCase().includes(form.technician.toLowerCase()) && t !== form.technician))].slice(0,5).length > 0 && (
            <div style={S.suggestions}>
              {[...new Set(records.map(r=>r.technician).filter(t=>t && t.toLowerCase().includes(form.technician.toLowerCase()) && t !== form.technician))].slice(0,5).map(t=>(
                <div key={t} onClick={()=>handleChange("technician",t)} style={S.suggestItem}>{t}</div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* 彈簧率建議 */}
      {form.vehicle_weight && <SpringAdvisor weight={form.vehicle_weight} driveType={form.drive_type} currentFront={form.spring_rate_front} currentRear={form.spring_rate_rear} symptoms={form.symptoms} />}
      {/* 彈簧車高 */}
      <div style={S.card}><h3 style={S.secTitle}>🔧 彈簧與車高</h3>
        <div style={S.row}><InputField label="彈簧磅數（前）" field="spring_rate_front" value={form.spring_rate_front} onChange={handleChange} type="number" unit="kg/mm" half required error={errFor("spring_rate_front")} form={form} /><InputField label="彈簧磅數（後）" field="spring_rate_rear" value={form.spring_rate_rear} onChange={handleChange} type="number" unit="kg/mm" half required error={errFor("spring_rate_rear")} form={form} /></div>
        <div style={S.row}><InputField label="車高（剩餘指數）" field="ride_height_fingers" value={form.ride_height_fingers} onChange={handleChange} type="number" unit="指" half form={form} /><InputField label="胎壓（前）" field="tire_pressure_front" value={form.tire_pressure_front} onChange={handleChange} type="number" unit="bar" half form={form} /></div>
        <div style={S.row}><InputField label="胎壓（後）" field="tire_pressure_rear" value={form.tire_pressure_rear} onChange={handleChange} type="number" unit="bar" half form={form} /></div>
      </div>
      {/* 阻尼 */}
      <div style={S.card}><h3 style={S.secTitle}>⚙️ 阻尼設定</h3>
        {form.damping_max_clicks && <div style={{color:"#475569",fontSize:11,marginBottom:12,marginTop:-8}}>總段數: {form.damping_max_clicks} 段 — 數字越大越硬（最硬={form.damping_max_clicks}）</div>}
        <div style={S.row}><InputField label="伸側阻尼（前）" field="damping_rebound_front" value={form.damping_rebound_front} onChange={handleChange} type="number" unit={`/${form.damping_max_clicks||32}`} half required error={errFor("damping_rebound_front")} form={form} /><InputField label="伸側阻尼（後）" field="damping_rebound_rear" value={form.damping_rebound_rear} onChange={handleChange} type="number" unit={`/${form.damping_max_clicks||32}`} half form={form} /></div>
        <div style={{display:"flex",gap:12,marginBottom:12}}><div style={{flex:1}}><DampingBar value={form.damping_rebound_front} max={form.damping_max_clicks} /></div><div style={{flex:1}}><DampingBar value={form.damping_rebound_rear} max={form.damping_max_clicks} /></div></div>
        <div style={S.row}><InputField label="壓側阻尼（前）" field="damping_compression_front" value={form.damping_compression_front} onChange={handleChange} type="number" unit={`/${form.damping_max_clicks||32}`} half required error={errFor("damping_compression_front")} form={form} /><InputField label="壓側阻尼（後）" field="damping_compression_rear" value={form.damping_compression_rear} onChange={handleChange} type="number" unit={`/${form.damping_max_clicks||32}`} half form={form} /></div>
        <div style={{display:"flex",gap:12,marginBottom:12}}><div style={{flex:1}}><DampingBar value={form.damping_compression_front} max={form.damping_max_clicks} /></div><div style={{flex:1}}><DampingBar value={form.damping_compression_rear} max={form.damping_max_clicks} /></div></div>
        <div style={S.row}><InputField label="預載（前）" field="preload_front" value={form.preload_front} onChange={handleChange} type="number" unit="mm" half required error={errFor("preload_front")} form={form} /><InputField label="預載（後）" field="preload_rear" value={form.preload_rear} onChange={handleChange} type="number" unit="mm" half /></div>
      </div>
      {/* 防傾桿 */}
      <div style={S.card}><h3 style={S.secTitle}>🔗 防傾桿 (Anti-Roll Bar)</h3>
        <div style={S.row}><InputField label="前防傾桿" field="sway_bar_front" value={form.sway_bar_front} onChange={handleChange} placeholder="原廠/加粗/品牌型號" half /><InputField label="後防傾桿" field="sway_bar_rear" value={form.sway_bar_rear} onChange={handleChange} placeholder="原廠/加粗/品牌型號" half /></div>
      </div>
      {/* 定位 */}
      <div style={S.card}><h3 style={S.secTitle}>📐 定位角度</h3>
        <div style={S.row}><InputField label="外傾角（前）" field="camber_front" value={form.camber_front} onChange={handleChange} type="number" unit="°" half /><InputField label="外傾角（後）" field="camber_rear" value={form.camber_rear} onChange={handleChange} type="number" unit="°" half /></div>
        <div style={S.row}><InputField label="束角（前）" field="toe_front" value={form.toe_front} onChange={handleChange} type="number" unit="°" half /><InputField label="束角（後）" field="toe_rear" value={form.toe_rear} onChange={handleChange} type="number" unit="°" half /></div>
      </div>
      {/* 症狀 */}
      <div style={S.card}><h3 style={S.secTitle}>🩺 車主反映症狀</h3>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
          {SYMPTOMS.map(s=>(<button key={s.id} onClick={()=>toggleSymptom(s.id)} style={{...S.symptomBtn,...(form.symptoms.includes(s.id)?S.symptomOn:{})}}><span>{s.icon}</span> {s.label}</button>))}
        </div>
        <TextArea label="詳細問題描述" field="issue_description" value={form.issue_description} onChange={handleChange} placeholder="例：路面不平時搖晃次數多、快速回彈、觸發晃動搖超過2-3下..." />
        <TextArea label="調整備註" field="adjustment_notes" value={form.adjustment_notes} onChange={handleChange} placeholder="調整內容、建議、後續追蹤事項..." />
        <div style={{marginTop:8}}><label style={S.label}>💬 常用備註（點擊插入）</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{QUICK_NOTES.map(n=>(<button key={n} onClick={()=>handleChange("adjustment_notes", (form.adjustment_notes ? form.adjustment_notes+"\n" : "")+n)} style={S.quickNote}>{n}</button>))}</div>
        </div>
      </div>
      {Object.keys(errors).length > 0 && <div style={S.errBanner} data-error="true">⚠ 尚有 {Object.keys(errors).length} 個必填未填：{Object.values(errors).join("、")}</div>}
      {editingId && <div style={{background:"#3b82f618",border:"1px solid #3b82f644",borderRadius:10,padding:"10px 16px",marginBottom:8,color:"#93c5fd",fontSize:13,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span>✏️ 編輯模式 — 修改後點下方儲存</span>
        <button onClick={()=>{setEditingId(null);setForm({...EMPTY});setErrors({});setTouched({})}} style={S.cancelBtn}>取消編輯</button>
      </div>}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8,marginTop:8}}>
        {!editingId && <button onClick={()=>setContinueMode(!continueMode)} style={{...S.chip,...(continueMode?S.chipOn:{}),fontSize:12,padding:"6px 12px"}}>
          {continueMode?"🔁 連續模式 ON":"🔁 連續模式"}
        </button>}
        {!editingId && <span style={{color:"#475569",fontSize:11}}>開啟後儲存時保留車輛資料</span>}
      </div>
      <button onClick={editingId ? handleUpdate : handleSave} disabled={saving} style={{...S.saveBtn,...(editingId?{background:"linear-gradient(135deg,#3b82f6,#2563eb)"}:{})}}>
        {saving ? "儲存中..." : editingId ? "✏️ 更新紀錄" : "💾 儲存紀錄"}{missingN > 0 && !saving && <span style={S.missBadge}>{missingN} 個必填未填</span>}
      </button>
    </div>
  );

  // ─── HISTORY ───
  const renderHistory = () => {
    const groups = {}; filtered.forEach(r => { const p = r.license_plate || "未知"; if (!groups[p]) groups[p] = []; groups[p].push(r); });
    const allPlates = Object.entries(groups);
    const totalPages = Math.ceil(allPlates.length / HISTORY_PAGE_SIZE);
    const visiblePlates = allPlates.slice(0, historyPage * HISTORY_PAGE_SIZE);
    const hasMore = visiblePlates.length < allPlates.length;
    return (
      <div style={S.page}>
        {records.length > 0 && <StatsDashboard records={records} />}
        <div style={S.searchBox}><span style={S.searchIcon}>🔍</span><input value={search} onChange={e=>handleSearch(e.target.value)} placeholder="搜尋車牌、姓名、車型、避震型號..." style={S.searchInput} />{search && <button onClick={()=>handleSearch("")} style={S.clearBtn}>✕</button>}</div>
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
          <select value={dateFilter} onChange={e=>handleDateFilter(e.target.value)} style={S.selectFilter}>
            <option value="">全部時間</option><option value="7d">最近 7 天</option><option value="30d">最近 30 天</option><option value="90d">最近 90 天</option>
          </select>
          <button onClick={()=>exportCSV(records)} style={S.exportBtn}>📥 匯出 CSV</button>
          <span style={{color:"#475569",fontSize:11,marginLeft:"auto"}}>{filtered.length} 筆紀錄</span>
        </div>
        {(compareA||compareB)&&<div style={S.compareBar}><span style={{color:"#94a3b8",flex:1}}>比較: {compareA?<span style={{color:"#ef4444"}}>A {compareA.license_plate}</span>:"選A"}{" ↔ "}{compareB?<span style={{color:"#22c55e"}}>B {compareB.license_plate}</span>:"選B"}</span>{compareA&&compareB&&<button onClick={()=>setShowCompare(true)} style={S.compareTrigger}>🔀 查看</button>}<button onClick={()=>{setCompareA(null);setCompareB(null);setShowCompare(false)}} style={S.cancelBtn}>取消</button></div>}
        {showCompare&&compareA&&compareB&&<div style={S.card}><h3 style={S.secTitle}>🔀 調整前後比較</h3><CompareWaveform before={compareA} after={compareB} /><div style={{display:"flex",gap:16,marginTop:16,flexWrap:"wrap"}}><div style={{flex:1,minWidth:200}}><div style={{color:"#ef4444",fontWeight:700,marginBottom:8}}>A: {compareA.license_plate}</div><ParamMini rec={compareA} /></div><div style={{flex:1,minWidth:200}}><div style={{color:"#22c55e",fontWeight:700,marginBottom:8}}>B: {compareB.license_plate}</div><ParamMini rec={compareB} /></div></div><h4 style={{color:"#94a3b8",fontSize:13,marginTop:20,marginBottom:10}}>動態模擬對比</h4><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><div style={{flex:1,minWidth:260}}><SuspensionSim params={compareA} label="調整前" compact /></div><div style={{flex:1,minWidth:260}}><SuspensionSim params={compareB} label="調整後" compact /></div></div></div>}
        {loading?<div style={S.empty}>載入中...</div>:allPlates.length===0?<div style={S.empty}>{search?"找不到符合的紀錄":"尚無紀錄"}</div>:visiblePlates.map(([plate,recs])=>(
          <div key={plate} style={S.plateGroup}><div style={S.plateHead} onClick={()=>setExpandedPlate(expandedPlate===plate?null:plate)}><span style={S.plateBadge}>{plate}</span><span style={S.plateInfo}>{recs[0]?.customer_name} · {recs[0]?.car_model}{recs[0]?.vehicle_weight?` · ${recs[0].vehicle_weight}kg`:""} · {recs.length} 筆</span>{recs.length>=2 && <button onClick={(e)=>{e.stopPropagation();setCompareA(recs[1]);setCompareB(recs[0]);setShowCompare(true);window.scrollTo({top:0,behavior:"smooth"})}} style={S.quickCompareBtn}>🔀 比較最近兩次</button>}<span style={{marginLeft:"auto",color:"#64748b",fontSize:12}}>{expandedPlate===plate?"▲":"▼"}</span></div>
            {expandedPlate===plate&&recs.length>=2&&<div style={{padding:"12px 16px",background:"#0a0e18",borderBottom:"1px solid #1e293b",display:"flex",gap:12,flexWrap:"wrap"}}><Sparkline records={recs} field="spring_rate_front" label="彈簧(前)" unit="kg" color="#f59e0b" /><Sparkline records={recs} field="damping_rebound_front" label="伸側阻尼(前)" unit="段" color="#3b82f6" /><Sparkline records={recs} field="preload_front" label="預載(前)" unit="mm" color="#22c55e" /></div>}
            {(expandedPlate===plate?recs:recs.slice(0,2)).map(rec=>{const syms=parseSymptoms(rec);return(
              <div key={rec.id} style={S.recRow}><div style={{flex:1,minWidth:0}}><div style={S.recDate}>{new Date(rec.created_at).toLocaleDateString("zh-TW",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}</div><div style={S.recTags}>{rec.shock_model&&<span style={S.tag}>{rec.shock_model}</span>}{rec.spring_rate_front&&<span style={S.tag}>前{rec.spring_rate_front}/後{rec.spring_rate_rear}kg</span>}{syms.length>0&&<span style={{...S.tag,background:"#3b82f622",color:"#93c5fd"}}>{syms.length}項症狀</span>}{rec.technician&&<span style={S.tag}>🔧 {rec.technician}</span>}</div>{rec.issue_description&&<div style={S.recIssue}>{rec.issue_description.slice(0,80)}{rec.issue_description.length>80?"...":""}</div>}</div>
                <div style={S.recActions}><button onClick={()=>{setSelected(rec);setPage("detail")}} style={S.actBtn} title="詳情">📋</button><button onClick={()=>handleEdit(rec)} style={S.actBtn} title="編輯">✏️</button><button onClick={()=>handleCopy(rec)} style={S.actBtn} title="複製">📝</button><button onClick={()=>{if(!compareA)setCompareA(rec);else if(!compareB)setCompareB(rec)}} style={{...S.actBtn,...(compareA?.id===rec.id||compareB?.id===rec.id?S.actOn:{})}} title="比較">🔀</button><button onClick={()=>exportReport(rec)} style={S.actBtn} title="匯出">📤</button><button onClick={()=>setDelConfirm(rec.id)} style={{...S.actBtn,...S.actDel}} title="刪除">🗑</button></div></div>)})}
            {expandedPlate!==plate&&recs.length>2&&<div style={{padding:"8px 16px",textAlign:"center"}}><button onClick={()=>setExpandedPlate(plate)} style={S.showMore}>展開其餘 {recs.length-2} 筆 ▼</button></div>}
          </div>))}
        {hasMore && <button ref={loadMoreRef} onClick={()=>setHistoryPage(p=>p+1)} style={S.loadMoreBtn}>載入更多（{visiblePlates.length}/{allPlates.length}）</button>}
        {delConfirm&&<div style={S.overlay}><div style={S.modal}><div style={{fontSize:15,fontWeight:700,marginBottom:12,color:"#ef4444"}}>⚠ 確定刪除？</div><div style={{color:"#94a3b8",fontSize:13,marginBottom:20}}>此操作無法復原</div><div style={{display:"flex",gap:12,justifyContent:"center"}}><button onClick={()=>setDelConfirm(null)} style={S.cancelBtn}>取消</button><button onClick={()=>handleDelete(delConfirm)} style={S.delBtn}>確定刪除</button></div></div></div>}
      </div>
    );
  };

  // ─── DETAIL ───
  const renderDetail = () => {
    if (!selected) return null; const r = selected; const syms = parseSymptoms(r); const sameRecs = records.filter(x => x.license_plate === r.license_plate);
    return (
      <div style={S.page}><button onClick={()=>setPage("history")} style={S.backBtn}>← 返回列表</button>
        <div style={S.card}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}><h3 style={S.secTitle}>{r.license_plate} — {r.customer_name}</h3><div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><button onClick={()=>handleEdit(r)} style={{...S.exportBtn,background:"#3b82f622",borderColor:"#3b82f644",color:"#93c5fd"}}>✏️ 編輯</button><button onClick={()=>shareReport(r)} style={{...S.exportBtn,background:"#22c55e22",borderColor:"#22c55e44",color:"#86efac"}}>📤 分享</button><button onClick={()=>exportReport(r)} style={S.exportBtn}>💾 下載</button><span style={{color:"#64748b",fontSize:12}}>{new Date(r.created_at).toLocaleString("zh-TW")}</span></div></div>
          <div style={{color:"#94a3b8",marginBottom:12}}>{r.car_model} · {r.shock_model}{r.vehicle_weight?` · ${r.vehicle_weight}kg`:""} · {DRIVE_OPTS.find(o=>o.value===r.drive_type)?.label||""}{r.customer_phone?` · 📞 ${r.customer_phone}`:""}{r.odometer?` · ${r.odometer}km`:""}{r.technician?` · 技師: ${r.technician}`:""}</div>
          <div style={{color:"#64748b",fontSize:12,marginBottom:12}}>前懸: {FORK_OPTS.find(o=>o.value===r.fork_type_front)?.label||r.fork_type_front||"—"} · 後懸: {FORK_OPTS.find(o=>o.value===r.fork_type_rear)?.label||r.fork_type_rear||"—"}{r.sway_bar_front?` · 前防傾桿: ${r.sway_bar_front}`:""}{r.sway_bar_rear?` · 後防傾桿: ${r.sway_bar_rear}`:""}</div>
          {syms.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>{syms.map(s=>{const sym=SYMPTOMS.find(x=>x.id===s);return sym?<span key={s} style={{...S.tag,background:"#3b82f622",color:"#93c5fd"}}>{sym.icon} {sym.label}</span>:null})}</div>}
          <SuspensionSim params={r} /></div>
        {r.vehicle_weight&&<SpringAdvisor weight={r.vehicle_weight} driveType={r.drive_type||"fwd"} currentFront={r.spring_rate_front} currentRear={r.spring_rate_rear} symptoms={syms} />}
        <div style={S.card}><h3 style={S.secTitle}>參數總覽</h3><div style={S.paramGrid}>{[["彈簧（前）",r.spring_rate_front,"kg/mm"],["彈簧（後）",r.spring_rate_rear,"kg/mm"],["車高",r.ride_height_fingers,"指"],["胎壓（前）",r.tire_pressure_front,"bar"],["胎壓（後）",r.tire_pressure_rear,"bar"],["伸側阻尼（前）",r.damping_rebound_front,"段"],["伸側阻尼（後）",r.damping_rebound_rear,"段"],["壓側阻尼（前）",r.damping_compression_front,"段"],["壓側阻尼（後）",r.damping_compression_rear,"段"],["預載（前）",r.preload_front,"mm"],["預載（後）",r.preload_rear,"mm"],["外傾角（前）",r.camber_front,"°"],["外傾角（後）",r.camber_rear,"°"],["束角（前）",r.toe_front,"°"],["束角（後）",r.toe_rear,"°"]].map(([l,v,u])=><ParamItem key={l} label={l} value={v} unit={u} />)}</div></div>
        {r.issue_description&&<div style={S.card}><h3 style={S.secTitle}>車主反映問題</h3><p style={S.descText}>{r.issue_description}</p></div>}
        {r.adjustment_notes&&<div style={S.card}><h3 style={S.secTitle}>調整備註</h3><p style={S.descText}>{r.adjustment_notes}</p></div>}
        {sameRecs.length>=2&&<div style={S.card}><h3 style={S.secTitle}>📈 歷次調校趨勢</h3><div style={{display:"flex",gap:12,flexWrap:"wrap"}}><Sparkline records={sameRecs} field="spring_rate_front" label="彈簧(前)" unit="kg" color="#f59e0b" /><Sparkline records={sameRecs} field="damping_rebound_front" label="伸側阻尼(前)" unit="段" color="#3b82f6" /><Sparkline records={sameRecs} field="preload_front" label="預載(前)" unit="mm" color="#22c55e" /></div></div>}
        <button onClick={()=>handleCopy(r)} style={S.saveBtn}>📝 以此紀錄為基底新增調校</button>
      </div>
    );
  };

  // ─── CUSTOMERS ───
  const renderCustomers = () => {
    const customersMap = {};
    records.forEach(r => {
      const key = r.license_plate;
      if (!customersMap[key]) {
        customersMap[key] = { license_plate: r.license_plate, customer_name: r.customer_name, customer_phone: r.customer_phone, car_model: r.car_model, shock_model: r.shock_model, visits: 0, latest: r.created_at, records: [] };
      }
      customersMap[key].records.push(r);
      customersMap[key].visits += 1;
      if (new Date(r.created_at) > new Date(customersMap[key].latest)) customersMap[key].latest = r.created_at;
    });
    const customers = Object.values(customersMap).sort((a, b) => new Date(b.latest) - new Date(a.latest));
    const filteredCust = search ? customers.filter(c => [c.license_plate, c.customer_name, c.car_model, c.customer_phone].some(s => (s || "").toLowerCase().includes(search.toLowerCase()))) : customers;

    return (
      <div style={S.page}>
        <div style={S.searchBox}><span style={S.searchIcon}>🔍</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜尋車牌、姓名、電話、車型..." style={S.searchInput} />{search && <button onClick={()=>setSearch("")} style={S.clearBtn}>✕</button>}</div>
        <div style={{color:"#475569",fontSize:12,marginBottom:12}}>共 {filteredCust.length} 位客戶</div>
        {filteredCust.length === 0 ? <div style={S.empty}>尚無客戶</div> : filteredCust.map(c => {
          const days = Math.floor((new Date() - new Date(c.latest)) / 864e5);
          const badge = days <= 30 ? { text: "活躍", color: "#22c55e" } : days <= 90 ? { text: "一般", color: "#f59e0b" } : { text: "沉睡", color: "#64748b" };
          return (
            <div key={c.license_plate} style={S.customerCard} onClick={() => { setCustomerSelected(c.license_plate); setPage("customerDetail"); }}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                <span style={S.plateBadge}>{c.license_plate}</span>
                <span style={{color:"#e2e8f0",fontSize:15,fontWeight:700}}>{c.customer_name}</span>
                <span style={{background:badge.color+"22",color:badge.color,padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700}}>● {badge.text}</span>
                <span style={{marginLeft:"auto",color:"#64748b",fontSize:11}}>{c.visits} 次來店</span>
              </div>
              <div style={{color:"#94a3b8",fontSize:12,marginBottom:4}}>{c.car_model} · {c.shock_model}</div>
              <div style={{color:"#64748b",fontSize:11}}>{c.customer_phone ? `📞 ${c.customer_phone} · ` : ""}最近: {days === 0 ? "今天" : `${days} 天前`}</div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── CUSTOMER DETAIL ───
  const renderCustomerDetail = () => {
    if (!customerSelected) return null;
    const recs = records.filter(r => r.license_plate === customerSelected).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (recs.length === 0) return <div style={S.empty}>找不到客戶</div>;
    const c = recs[0];
    return (
      <div style={S.page}>
        <button onClick={() => setPage("customers")} style={S.backBtn}>← 返回客戶列表</button>
        <div style={S.card}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,flexWrap:"wrap"}}>
            <span style={S.plateBadge}>{c.license_plate}</span>
            <h3 style={{...S.secTitle,marginBottom:0}}>{c.customer_name}</h3>
          </div>
          <div style={{color:"#94a3b8",fontSize:13,marginBottom:4}}>{c.car_model} · {c.shock_model}{c.vehicle_weight?` · ${c.vehicle_weight}kg`:""}</div>
          {c.customer_phone && <div style={{color:"#94a3b8",fontSize:13,marginBottom:4}}>📞 <a href={`tel:${c.customer_phone}`} style={{color:"#f59e0b",textDecoration:"none"}}>{c.customer_phone}</a></div>}
          <div style={{color:"#64748b",fontSize:12,marginTop:8}}>總來店 {recs.length} 次 · 最近 {new Date(recs[0].created_at).toLocaleDateString("zh-TW")}</div>
        </div>
        {recs.length >= 2 && <div style={S.card}>
          <h3 style={S.secTitle}>📈 調校趨勢</h3>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <Sparkline records={recs} field="spring_rate_front" label="彈簧(前)" unit="kg" color="#f59e0b" />
            <Sparkline records={recs} field="damping_rebound_front" label="伸側阻尼(前)" unit="段" color="#3b82f6" />
            <Sparkline records={recs} field="preload_front" label="預載(前)" unit="mm" color="#22c55e" />
          </div>
        </div>}
        <div style={S.card}>
          <h3 style={S.secTitle}>📋 歷次紀錄</h3>
          {recs.map((r, i) => (
            <div key={r.id} style={{padding:"10px 0",borderBottom:i<recs.length-1?"1px solid #1e293b":"none",cursor:"pointer"}} onClick={() => { setSelected(r); setPage("detail"); }}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div style={{color:"#e2e8f0",fontSize:13,fontWeight:600}}>{new Date(r.created_at).toLocaleString("zh-TW",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {r.spring_rate_front && <span style={S.tag}>前{r.spring_rate_front}/後{r.spring_rate_rear}kg</span>}
                  {r.technician && <span style={S.tag}>🔧 {r.technician}</span>}
                </div>
              </div>
              {r.adjustment_notes && <div style={{color:"#64748b",fontSize:12,marginTop:4}}>{r.adjustment_notes.slice(0, 60)}...</div>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── STATS ───
  const renderStats = () => {
    if (records.length === 0) return <div style={S.page}><div style={S.empty}>尚無資料</div></div>;
    // 技師排行
    const techStats = {};
    records.forEach(r => { const t = r.technician || "未指定"; techStats[t] = (techStats[t] || 0) + 1; });
    const techRank = Object.entries(techStats).sort((a, b) => b[1] - a[1]).slice(0, 10);
    // 車型排行
    const modelStats = {};
    records.forEach(r => { const m = r.car_model || "未知"; modelStats[m] = (modelStats[m] || 0) + 1; });
    const modelRank = Object.entries(modelStats).sort((a, b) => b[1] - a[1]).slice(0, 10);
    // 症狀統計
    const symStats = {};
    records.forEach(r => {
      const syms = typeof r.symptoms === "string" ? (() => { try { return JSON.parse(r.symptoms || "[]"); } catch { return []; } })() : (r.symptoms || []);
      syms.forEach(s => { symStats[s] = (symStats[s] || 0) + 1; });
    });
    const symRank = Object.entries(symStats).sort((a, b) => b[1] - a[1]);
    // 月度統計（過去 6 個月）
    const now = new Date();
    const monthly = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key = `${d.getFullYear()}/${d.getMonth() + 1}`;
      const count = records.filter(r => { const rd = new Date(r.created_at); return rd.getFullYear() === d.getFullYear() && rd.getMonth() === d.getMonth(); }).length;
      return { month: key, count };
    });
    const maxMonthly = Math.max(...monthly.map(m => m.count), 1);

    return (
      <div style={S.page}>
        <StatsDashboard records={records} />
        <div style={S.card}>
          <h3 style={S.secTitle}>📅 近 6 月業務量</h3>
          <div style={{display:"flex",alignItems:"flex-end",gap:8,height:140,padding:"10px 0"}}>
            {monthly.map(m => (
              <div key={m.month} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{color:"#e2e8f0",fontSize:12,fontWeight:700,fontFamily:"'JetBrains Mono'"}}>{m.count}</div>
                <div style={{width:"100%",height:`${(m.count/maxMonthly)*100}%`,minHeight:2,background:"linear-gradient(180deg,#f59e0b,#d97706)",borderRadius:"4px 4px 0 0"}} />
                <div style={{color:"#64748b",fontSize:10}}>{m.month}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={S.card}>
          <h3 style={S.secTitle}>🔧 技師排行</h3>
          {techRank.map(([t, n], i) => {
            const pct = (n / techRank[0][1]) * 100;
            return (
              <div key={t} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{color:"#e2e8f0",fontSize:13}}>{i === 0 ? "🏆 " : `${i + 1}. `}{t}</span>
                  <span style={{color:"#f59e0b",fontSize:13,fontWeight:700,fontFamily:"'JetBrains Mono'"}}>{n} 次</span>
                </div>
                <div style={{height:6,background:"#1e293b",borderRadius:3,overflow:"hidden"}}>
                  <div style={{width:`${pct}%`,height:"100%",background:i === 0 ? "#f59e0b" : "#3b82f6",borderRadius:3}} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={S.card}>
          <h3 style={S.secTitle}>🚗 熱門車型 TOP 10</h3>
          {modelRank.map(([m, n], i) => (
            <div key={m} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<modelRank.length-1?"1px solid #1e293b":"none"}}>
              <span style={{color:"#e2e8f0",fontSize:13}}>{i + 1}. {m}</span>
              <span style={{color:"#94a3b8",fontSize:13,fontFamily:"'JetBrains Mono'"}}>{n} 次</span>
            </div>
          ))}
        </div>
        {symRank.length > 0 && <div style={S.card}>
          <h3 style={S.secTitle}>🩺 常見症狀分析</h3>
          {symRank.map(([s, n]) => {
            const sym = SYMPTOMS.find(x => x.id === s);
            const pct = (n / records.length) * 100;
            return (
              <div key={s} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{color:"#e2e8f0",fontSize:13}}>{sym?.icon} {sym?.label || s}</span>
                  <span style={{color:"#93c5fd",fontSize:13,fontWeight:700,fontFamily:"'JetBrains Mono'"}}>{n} 次 ({pct.toFixed(0)}%)</span>
                </div>
                <div style={{height:6,background:"#1e293b",borderRadius:3,overflow:"hidden"}}>
                  <div style={{width:`${pct}%`,height:"100%",background:"#3b82f6",borderRadius:3}} />
                </div>
              </div>
            );
          })}
        </div>}
      </div>
    );
  };

  return (
    <div style={S.app}>
      <header style={S.header}><div style={S.headerInner}><div style={S.logo}><span style={{fontSize:28}}>⚡</span><div><div style={S.logoT}>SUSPENSION</div><div style={S.logoS}>TUNING SYSTEM</div></div></div>{!DB_OK&&<div style={S.demo}>DEMO — 請至 Netlify 設定環境變數</div>}</div></header>
      <nav style={S.nav}>{[{id:"form",icon:"🔧",text:"新增"},{id:"history",icon:"📋",text:"紀錄"},{id:"customers",icon:"👥",text:"客戶"},{id:"stats",icon:"📊",text:"統計"}].map(t=>(<button key={t.id} onClick={()=>{if(editingId && page === "form" && t.id !== "form"){if(!confirm("編輯中的內容尚未儲存，確定離開？"))return;setEditingId(null);setForm({...EMPTY})}setPage(t.id)}} style={{...S.navBtn,...(page===t.id||(page==="detail"&&t.id==="history")||(page==="customerDetail"&&t.id==="customers")?S.navOn:{})}}><span>{t.icon}</span> {t.text}{t.id==="history"&&records.length>0&&<span style={S.badge}>{records.length}</span>}</button>))}</nav>
      <main style={{paddingBottom:80}}>{page==="form"&&renderForm()}{page==="history"&&renderHistory()}{page==="detail"&&renderDetail()}{page==="customers"&&renderCustomers()}{page==="customerDetail"&&renderCustomerDetail()}{page==="stats"&&renderStats()}</main>
      {toast&&<div onClick={()=>{if(toastTimerRef.current){clearTimeout(toastTimerRef.current);toastTimerRef.current=null}setToast(null)}} style={{...S.toast,borderColor:toast.type==="error"?"#ef4444":"#22c55e",color:toast.type==="error"?"#fca5a5":"#86efac",cursor:"pointer"}} title="點擊關閉">{toast.msg} <span style={{opacity:0.5,marginLeft:8}}>✕</span></div>}
      {showTopBtn&&<button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} style={S.topBtn} title="回頂部">↑</button>}
    </div>
  );
}

// ═══════════════════════════════════════
//  Styles
// ═══════════════════════════════════════
const S={
  app:{fontFamily:"'Noto Sans TC','JetBrains Mono',-apple-system,sans-serif",background:"#0b0f1a",color:"#e2e8f0",minHeight:"100vh",maxWidth:720,margin:"0 auto"},
  header:{background:"linear-gradient(135deg,#0f172a,#1a1a2e)",borderBottom:"1px solid #f59e0b33",padding:"14px 20px",position:"sticky",top:0,zIndex:100},
  headerInner:{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8},
  logo:{display:"flex",alignItems:"center",gap:10},logoT:{fontSize:18,fontWeight:900,letterSpacing:3,color:"#f59e0b",lineHeight:1.1},logoS:{fontSize:9,letterSpacing:5,color:"#64748b",fontWeight:600},
  demo:{background:"#f59e0b22",color:"#f59e0b",padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:600},
  nav:{display:"flex",background:"#0f172a",borderBottom:"1px solid #1e293b",position:"sticky",top:56,zIndex:99},
  navBtn:{flex:1,padding:"12px 16px",background:"transparent",border:"none",borderBottom:"2px solid transparent",color:"#64748b",fontSize:14,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6},
  navOn:{color:"#f59e0b",borderBottomColor:"#f59e0b",background:"#f59e0b08"},badge:{background:"#f59e0b",color:"#0f172a",padding:"1px 7px",borderRadius:10,fontSize:11,fontWeight:700,marginLeft:4},
  page:{padding:16},card:{background:"#111827",border:"1px solid #1e293b",borderRadius:12,padding:20,marginBottom:16},
  secTitle:{color:"#f59e0b",fontSize:15,fontWeight:700,marginBottom:16,marginTop:0},secDesc:{color:"#475569",fontSize:12,margin:"-8px 0 16px 0"},
  row:{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap"},label:{display:"block",color:"#94a3b8",fontSize:12,fontWeight:600,marginBottom:4},
  req:{color:"#ef4444",marginLeft:3,fontWeight:700},inputWrap:{display:"flex",alignItems:"center",gap:0,position:"relative"},
  input:{width:"100%",padding:"10px 12px",background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,color:"#e2e8f0",fontSize:14,outline:"none",boxSizing:"border-box",transition:"border-color 0.2s"},
  inputNum:{textAlign:"center",paddingLeft:36,paddingRight:50},inputErr:{borderColor:"#ef4444",background:"#1a0808"},
  inputWarn:{borderColor:"#f59e0b66"},
  errText:{color:"#f87171",fontSize:11,marginTop:3},
  warnText:{color:"#fbbf24",fontSize:11,marginTop:3},
  unit:{position:"absolute",right:38,top:"50%",transform:"translateY(-50%)",color:"#475569",fontSize:11,fontWeight:600,pointerEvents:"none"},
  stepBtn:{width:32,height:38,background:"#1e293b",border:"1px solid #334155",color:"#f59e0b",fontSize:18,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:6,flexShrink:0,lineHeight:1,userSelect:"none"},
  textarea:{width:"100%",padding:"10px 12px",background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,color:"#e2e8f0",fontSize:14,outline:"none",resize:"vertical",fontFamily:"inherit",boxSizing:"border-box"},
  chipRow:{display:"flex",gap:8,flexWrap:"wrap"},chip:{padding:"6px 14px",background:"#0f172a",border:"1px solid #1e293b",borderRadius:20,color:"#94a3b8",fontSize:13,cursor:"pointer"},chipOn:{background:"#f59e0b22",borderColor:"#f59e0b",color:"#f59e0b"},
  symptomBtn:{padding:"8px 14px",background:"#0f172a",border:"1px solid #1e293b",borderRadius:10,color:"#94a3b8",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6,transition:"all 0.2s"},
  symptomOn:{background:"#3b82f622",borderColor:"#3b82f6",color:"#93c5fd"},
  errBanner:{background:"#ef444418",border:"1px solid #ef444466",borderRadius:10,padding:"12px 16px",color:"#fca5a5",fontSize:13,fontWeight:600,marginBottom:12,lineHeight:1.5},
  saveBtn:{width:"100%",padding:"14px",background:"linear-gradient(135deg,#f59e0b,#d97706)",border:"none",borderRadius:10,color:"#0f172a",fontSize:16,fontWeight:700,cursor:"pointer",letterSpacing:1,marginTop:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8},
  missBadge:{background:"#0f172a44",padding:"2px 10px",borderRadius:8,fontSize:11,fontWeight:600},
  bumpBtn:{padding:"8px 16px",background:"linear-gradient(135deg,#f59e0b,#d97706)",border:"none",borderRadius:8,color:"#0f172a",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:"0 2px 12px #f59e0b44"},
  contBumpBtn:{padding:"8px 12px",background:"#1e293b",border:"1px solid #3b82f666",borderRadius:8,color:"#93c5fd",fontSize:14,fontWeight:700,cursor:"pointer"},
  toggleBtn:{background:"transparent",border:"1px solid #1e293b",borderRadius:6,color:"#64748b",padding:"4px 12px",fontSize:12,cursor:"pointer"},
  presetBtn:{background:"#0f172a",border:"1px solid #1e293b",borderRadius:10,padding:"10px 16px",cursor:"pointer",color:"#e2e8f0",textAlign:"left",minWidth:160},
  exportBtn:{background:"#1e293b",border:"1px solid #334155",borderRadius:8,color:"#e2e8f0",padding:"6px 14px",fontSize:13,fontWeight:600,cursor:"pointer"},
  quickNote:{padding:"4px 10px",background:"#0f172a",border:"1px solid #1e293b",borderRadius:6,color:"#94a3b8",fontSize:11,cursor:"pointer",transition:"all 0.15s",whiteSpace:"nowrap"},
  selectFilter:{padding:"8px 12px",background:"#111827",border:"1px solid #1e293b",borderRadius:8,color:"#e2e8f0",fontSize:13,outline:"none",cursor:"pointer"},
  draftBanner:{background:"#f59e0b18",border:"1px solid #f59e0b44",borderRadius:10,padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",color:"#fbbf24",fontSize:13,fontWeight:600,gap:8,flexWrap:"wrap"},
  customerCard:{background:"#111827",border:"1px solid #1e293b",borderRadius:12,padding:16,marginBottom:10,cursor:"pointer",transition:"all 0.2s"},
  suggestions:{position:"absolute",top:"100%",left:0,right:0,background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,marginTop:4,zIndex:50,maxHeight:200,overflowY:"auto"},
  suggestItem:{padding:"8px 12px",color:"#e2e8f0",fontSize:13,cursor:"pointer",borderBottom:"1px solid #1e293b22"},
  loadMoreBtn:{width:"100%",padding:"12px",background:"#111827",border:"1px solid #1e293b",borderRadius:10,color:"#f59e0b",fontSize:14,fontWeight:600,cursor:"pointer",marginTop:8},
  topBtn:{position:"fixed",bottom:24,right:24,width:44,height:44,borderRadius:22,background:"#111827",border:"1px solid #f59e0b66",color:"#f59e0b",fontSize:22,fontWeight:700,cursor:"pointer",zIndex:998,boxShadow:"0 4px 16px rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center"},
  quickCompareBtn:{padding:"4px 10px",background:"#f59e0b22",border:"1px solid #f59e0b44",borderRadius:6,color:"#f59e0b",fontSize:11,fontWeight:600,cursor:"pointer"},
  recGrid:{display:"grid",gridTemplateColumns:"auto 1fr 1fr 1fr",gap:6,alignItems:"center"},
  recHead:{color:"#64748b",fontSize:11,fontWeight:600,textAlign:"center"},recLabel:{color:"#94a3b8",fontSize:12,fontWeight:600},
  statsGrid:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:16},statCard:{background:"#111827",border:"1px solid #1e293b",borderRadius:10,padding:"12px 8px",textAlign:"center"},
  searchBox:{position:"relative",marginBottom:16},searchIcon:{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:16},
  searchInput:{width:"100%",padding:"12px 40px",background:"#111827",border:"1px solid #1e293b",borderRadius:10,color:"#e2e8f0",fontSize:14,outline:"none",boxSizing:"border-box"},
  clearBtn:{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:16},
  compareBar:{background:"#111827",border:"1px solid #f59e0b33",borderRadius:10,padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",fontSize:13},
  compareTrigger:{padding:"6px 14px",background:"#f59e0b",border:"none",borderRadius:6,color:"#0f172a",fontWeight:700,fontSize:12,cursor:"pointer"},
  cancelBtn:{padding:"6px 14px",background:"transparent",border:"1px solid #475569",borderRadius:6,color:"#94a3b8",fontSize:12,cursor:"pointer"},
  plateGroup:{background:"#111827",border:"1px solid #1e293b",borderRadius:12,marginBottom:12,overflow:"hidden"},
  plateHead:{padding:"12px 16px",background:"#0f172a",borderBottom:"1px solid #1e293b",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",cursor:"pointer"},
  plateBadge:{background:"#f59e0b",color:"#0f172a",padding:"3px 12px",borderRadius:6,fontSize:14,fontWeight:800,fontFamily:"'JetBrains Mono'",letterSpacing:1},
  plateInfo:{color:"#64748b",fontSize:13},recRow:{padding:"12px 16px",borderBottom:"1px solid #1e293b22",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12},
  recDate:{color:"#94a3b8",fontSize:12,fontFamily:"'JetBrains Mono'",marginBottom:4},recTags:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:4},
  tag:{background:"#1e293b",color:"#94a3b8",padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:600},recIssue:{color:"#475569",fontSize:12,marginTop:4},
  recActions:{display:"flex",gap:4,flexShrink:0,flexWrap:"wrap"},actBtn:{padding:"6px 8px",background:"#0f172a",border:"1px solid #1e293b",borderRadius:6,cursor:"pointer",fontSize:14},
  actOn:{background:"#f59e0b33",borderColor:"#f59e0b"},actDel:{borderColor:"#ef444433"},showMore:{background:"transparent",border:"none",color:"#f59e0b",fontSize:12,cursor:"pointer",fontWeight:600},
  empty:{textAlign:"center",color:"#475569",padding:"60px 20px",fontSize:14},backBtn:{background:"none",border:"none",color:"#f59e0b",fontSize:14,cursor:"pointer",padding:"0 0 12px 0",fontWeight:600},
  paramGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8},paramItem:{background:"#0f172a",borderRadius:8,padding:"10px 12px"},
  paramLabel:{color:"#475569",fontSize:11,marginBottom:4},paramValue:{color:"#e2e8f0",fontSize:16,fontWeight:700,fontFamily:"'JetBrains Mono'"},paramUnit:{color:"#475569",fontSize:11,fontWeight:400,marginLeft:4},
  descText:{color:"#cbd5e1",fontSize:14,lineHeight:1.7,margin:0,whiteSpace:"pre-wrap"},
  toast:{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",background:"#111827",border:"1px solid",borderRadius:10,padding:"10px 24px",fontSize:14,fontWeight:600,zIndex:999,boxShadow:"0 8px 32px rgba(0,0,0,0.5)",whiteSpace:"nowrap"},
  overlay:{position:"fixed",top:0,left:0,right:0,bottom:0,background:"#00000088",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center"},
  modal:{background:"#111827",border:"1px solid #1e293b",borderRadius:16,padding:28,maxWidth:340,width:"90%",textAlign:"center"},
  delBtn:{padding:"8px 20px",background:"#ef4444",border:"none",borderRadius:8,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer"},
  autoFillBtn:{position:"absolute",bottom:-28,left:0,right:0,padding:"4px 10px",background:"#f59e0b22",border:"1px solid #f59e0b44",borderRadius:6,color:"#f59e0b",fontSize:11,fontWeight:600,cursor:"pointer",textAlign:"center",zIndex:10,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"},
};
