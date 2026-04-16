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
  const pct = Math.min(100, (v / m) * 100);
  const color = pct > 75 ? "#ef4444" : pct > 50 ? "#f59e0b" : pct > 25 ? "#3b82f6" : "#22c55e";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
      <div style={{ flex: 1, height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.3s" }} />
      </div>
      <span style={{ color: "#64748b", fontSize: 10, fontFamily: "'JetBrains Mono'", minWidth: 36 }}>{pct.toFixed(0)}%</span>
    </div>
  );
}

// ─── CSV 匯出 ───
function exportCSV(records) {
  const fields = ["license_plate","customer_name","customer_phone","car_model","shock_model","fork_type_front","fork_type_rear","drive_type","vehicle_weight","odometer","spring_rate_front","spring_rate_rear","damping_rebound_front","damping_rebound_rear","damping_compression_front","damping_compression_rear","damping_max_clicks","preload_front","preload_rear","ride_height_fingers","tire_pressure_front","tire_pressure_rear","sway_bar_front","sway_bar_rear","camber_front","camber_rear","toe_front","toe_rear","symptoms","issue_description","adjustment_notes","technician","created_at"];
  const header = fields.join(",");
  const rows = records.map(r => fields.map(f => {
    let v = r[f] ?? "";
    if (typeof v === "object") v = JSON.stringify(v);
    v = String(v).replace(/"/g, '""');
    return `"${v}"`;
  }).join(","));
  const bom = "\uFEFF";
  const csv = bom + header + "\n" + rows.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `避震調校紀錄_${new Date().toLocaleDateString("zh-TW").replace(/\//g, "")}.csv`;
  link.click();
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
  const inc = () => { const v = parseFloat(value) || 0; onChange(field, String(Math.round((v + sv) * 100) / 100)); };
  const dec = () => { const v = parseFloat(value) || 0; onChange(field, String(Math.round((v - sv) * 100) / 100)); };
  const warn = formCtx ? getFieldWarning(field, value, formCtx) : null;
  return (
    <div style={{ flex: half ? "1 1 45%" : "1 1 100%", minWidth: half ? 140 : 200 }} data-error={error ? "true" : undefined}>
      <label style={S.label}>{label}{required && <span style={S.req}>*</span>}</label>
      <div style={S.inputWrap}>
        {isNum && <button type="button" onClick={dec} style={S.stepBtn} tabIndex={-1}>−</button>}
        <input type={type || "text"} value={value} onChange={(e) => onChange(field, e.target.value)}
          placeholder={placeholder || label} step={isNum ? sv : undefined}
          style={{ ...S.input, ...(error ? S.inputErr : {}), ...(isNum ? S.inputNum : {}), ...(warn ? S.inputWarn : {}) }} />
        {isNum && <button type="button" onClick={inc} style={S.stepBtn} tabIndex={-1}>+</button>}
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
      <textarea value={value} onChange={(e) => onChange(field, e.target.value)} placeholder={placeholder} style={S.textarea} rows={rows || 3} />
    </div>
  );
}

// ═══════════════════════════════════════
//  懸吊模擬（加入車重因素）
// ═══════════════════════════════════════
function usePhysics(params) {
  return useMemo(() => {
    const dr = Number(params.damping_rebound_front) || 0;
    const dc = Number(params.damping_compression_front) || 0;
    const sp = Number(params.spring_rate_front) || 6;
    const pl = Number(params.preload_front) || 0;
    const ht = Number(params.ride_height_fingers) || 4;
    const wt = Number(params.vehicle_weight) || 1400;
    const da = (dr + dc) / 2;

    // 車重影響：重車 + 軟簧 = 更容易晃
    const massRatio = wt / 1400; // 基準 1400kg
    const dampingRatio = Math.min(0.95, Math.max(0.05, da * 0.03 / Math.sqrt(massRatio)));
    const natFreq = Math.sqrt(sp * 9810 / (wt * 0.3)) / (2 * Math.PI); // 近似自然頻率
    const baseAmp = Math.max(5, (50 * massRatio) - pl * 1.2 - da * 1.0);
    const oscillations = Math.max(1, Math.round(7 - da * 0.15 - (sp / massRatio) * 0.3));

    return { dampingRatio, natFreq, baseAmp, heightOffset: (4 - ht) * 12, oscillations, dampAvg: da, spring: sp, preload: pl, weight: wt };
  }, [params.damping_rebound_front, params.damping_compression_front, params.spring_rate_front, params.preload_front, params.ride_height_fingers, params.vehicle_weight]);
}

function SuspensionSim({ params, label, compact }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const stRef = useRef({ time: 0, bumping: false, bumpStart: 0 });
  const physics = usePhysics(params);

  const triggerBump = useCallback(() => { stRef.current.bumping = true; stRef.current.bumpStart = stRef.current.time; }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const draw = () => {
      const W = canvas.width, H = canvas.height, st = stRef.current, t = st.time;
      const { dampingRatio, natFreq, baseAmp, heightOffset, oscillations, dampAvg, spring, weight } = physics;
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#0c101c"; ctx.fillRect(0, 0, W, H);
      const roadY = H * 0.80, baseCarY = H * 0.35 + heightOffset, cx = W * 0.5;
      let bodyDisp = 0, wheelDisp = 0;
      if (st.bumping) {
        const el = t - st.bumpStart, w = natFreq * Math.PI * 2;
        const wd = w * Math.sqrt(Math.max(0.001, 1 - dampingRatio * dampingRatio));
        const decay = Math.exp(-dampingRatio * w * el);
        bodyDisp = baseAmp * decay * Math.sin(wd * el);
        wheelDisp = baseAmp * 0.3 * decay * Math.sin(wd * el * 1.8);
        if (el > 5 && Math.abs(bodyDisp) < 0.5) st.bumping = false;
      } else { bodyDisp = Math.sin(t * 2) * 1.2; wheelDisp = Math.sin(t * 3.5) * 0.6; }
      const carY = baseCarY + bodyDisp, wY = roadY - 20 + wheelDisp * 0.3;

      // Road
      ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2; ctx.beginPath();
      for (let x = 0; x < W; x++) ctx.lineTo(x, roadY + Math.sin((x + t * 20) * 0.05) * 3);
      ctx.stroke(); ctx.fillStyle = "#0a0e18"; ctx.fillRect(0, roadY + 6, W, H);
      ctx.strokeStyle = "#f59e0b22"; ctx.lineWidth = 2; ctx.setLineDash([16, 24]);
      ctx.beginPath(); ctx.moveTo(0, roadY + 14); ctx.lineTo(W, roadY + 14); ctx.stroke(); ctx.setLineDash([]);
      if (st.bumping && (t - st.bumpStart) < 1.5) {
        ctx.fillStyle = "#f59e0b44"; ctx.beginPath();
        ctx.moveTo(cx - 30, roadY); ctx.quadraticCurveTo(cx, roadY - 18, cx + 30, roadY); ctx.fill();
      }
      // Struts
      const drawStrut = (x) => {
        const top = carY + 42, bot = wY - 8, len = bot - top;
        ctx.strokeStyle = "#64748b"; ctx.lineWidth = 9; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + len * 0.4); ctx.stroke();
        ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, top + len * 0.4); ctx.lineTo(x, bot); ctx.stroke();
        const coils = Math.max(4, 8 - Math.floor(spring / 3));
        ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath();
        for (let i = 0; i <= coils * 2; i++) {
          const py = top + (len * i) / (coils * 2), px = x + (i % 2 === 0 ? -15 : 15);
          i === 0 ? ctx.moveTo(x, py) : ctx.lineTo(px, py);
        } ctx.lineTo(x, bot); ctx.stroke();
      };
      drawStrut(cx - 80); drawStrut(cx + 80);
      // Car
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
      // Wheels
      const drawWheel = (x) => {
        ctx.fillStyle = "#0f172a"; ctx.strokeStyle = "#334155"; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.arc(x, wY, 17, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#475569"; ctx.beginPath(); ctx.arc(x, wY, 6, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "#64748b"; ctx.lineWidth = 1.5;
        for (let i = 0; i < 5; i++) { const a = (Math.PI*2*i)/5 + t*2;
          ctx.beginPath(); ctx.moveTo(x+Math.cos(a)*6, wY+Math.sin(a)*6); ctx.lineTo(x+Math.cos(a)*14, wY+Math.sin(a)*14); ctx.stroke(); }
      };
      drawWheel(cx-80); drawWheel(cx+80);
      // HUD
      const mag = Math.abs(bodyDisp);
      const clr = mag > 20 ? "#ef4444" : mag > 10 ? "#f59e0b" : "#22c55e";
      ctx.fillStyle = clr; ctx.font = "bold 14px 'JetBrains Mono',monospace"; ctx.textAlign = "left";
      ctx.fillText(`位移: ${mag.toFixed(1)}mm`, 14, 24);
      ctx.fillStyle = "#1e293b"; ctx.beginPath(); ctx.roundRect(14, 30, 140, 10, 5); ctx.fill();
      ctx.fillStyle = clr; ctx.beginPath(); ctx.roundRect(14, 30, Math.min(140, mag*3.1), 10, 5); ctx.fill();
      const stat = mag > 20 ? "⚠ 過度晃動" : mag > 10 ? "△ 偏軟需調整" : "✓ 穩定";
      ctx.fillStyle = clr; ctx.font = "bold 12px 'Noto Sans TC',sans-serif"; ctx.fillText(stat, 14, 58);
      if (st.bumping) { ctx.fillStyle = "#94a3b8"; ctx.font = "11px 'JetBrains Mono'"; ctx.fillText(`預估回彈 ≈ ${oscillations} 次`, 14, 74); }
      if (!compact) {
        ctx.fillStyle = "#64748b"; ctx.font = "11px 'JetBrains Mono',monospace"; ctx.textAlign = "right";
        ctx.fillText(`${weight}kg 彈簧:${spring}kg 阻尼:${dampAvg.toFixed(0)}段`, W-14, 22);
        ctx.fillText(`ζ=${dampingRatio.toFixed(2)} f=${natFreq.toFixed(1)}Hz`, W-14, 38);
      }
      if (label) { ctx.fillStyle = label === "調整前" ? "#ef4444" : "#22c55e"; ctx.font = "bold 14px 'Noto Sans TC'"; ctx.textAlign = "center"; ctx.fillText(label, W/2, H-10); }
      st.time += 0.02; animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [physics, label, compact]);

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={canvasRef} width={600} height={compact ? 240 : 320} style={{ width: "100%", height: "auto", borderRadius: 12, border: "1px solid #1e293b", display: "block" }} />
      <button onClick={triggerBump} style={S.bumpBtn}>💥 路面衝擊測試</button>
    </div>
  );
}

// ═══════════════════════════════════════
//  比較波形
// ═══════════════════════════════════════
function CompareWaveform({ before, after }) {
  const canvasRef = useRef(null);
  const calc = (p) => {
    const da = ((Number(p.damping_rebound_front)||0) + (Number(p.damping_compression_front)||0)) / 2;
    const sp = Number(p.spring_rate_front) || 6;
    const wt = Number(p.vehicle_weight) || 1400;
    const f = Math.sqrt(sp * 9810 / (wt * 0.3)) / (2 * Math.PI);
    return { z: Math.min(0.95, Math.max(0.05, da * 0.03 / Math.sqrt(wt / 1400))), f, a: Math.max(5, 50 * wt / 1400 - (Number(p.preload_front)||0) * 1.2 - da) };
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
function Sparkline({records,field,label,unit,color}){const canvasRef=useRef(null);const vals=records.map(r=>Number(r[field])||0).reverse();
  useEffect(()=>{const c=canvasRef.current;if(!c||vals.length<2)return;const ctx=c.getContext("2d"),W=c.width,H=c.height;const mn=Math.min(...vals),mx=Math.max(...vals),rng=mx-mn||1;ctx.clearRect(0,0,W,H);
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();vals.forEach((v,i)=>{const x=(i/(vals.length-1))*W,y=H-4-((v-mn)/rng)*(H-8);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)});ctx.stroke();
    vals.forEach((v,i)=>{const x=(i/(vals.length-1))*W,y=H-4-((v-mn)/rng)*(H-8);ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fill()});},[vals,color]);
  if(vals.length<2)return null;
  return(<div style={{flex:"1 1 120px",minWidth:120}}><div style={{color:"#64748b",fontSize:10,marginBottom:2}}>{label}</div><canvas ref={canvasRef} width={120} height={40} style={{width:"100%",height:40,display:"block"}}/><div style={{color:"#94a3b8",fontSize:10,display:"flex",justifyContent:"space-between"}}><span>{vals[0]}{unit}</span><span>{vals[vals.length-1]}{unit}</span></div></div>);}

function StatsDashboard({records}){const now=new Date();const tm=records.filter(r=>{const d=new Date(r.created_at);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()});
  const plates=new Set(records.map(r=>r.license_plate));const rp=[...plates].filter(p=>records.filter(r=>r.license_plate===p).length>1);
  return(<div style={S.statsGrid}>{[{l:"總紀錄",v:records.length,i:"📊"},{l:"不同車輛",v:plates.size,i:"🚗"},{l:"本月調校",v:tm.length,i:"📅"},{l:"回訪車輛",v:rp.length,i:"🔄"}].map(s=>(<div key={s.l} style={S.statCard}><div style={{fontSize:20}}>{s.i}</div><div style={{fontSize:22,fontWeight:800,color:"#f59e0b",fontFamily:"'JetBrains Mono'"}}>{s.v}</div><div style={{fontSize:11,color:"#64748b"}}>{s.l}</div></div>))}</div>);}

function ParamItem({label,value,unit}){return(<div style={S.paramItem}><div style={S.paramLabel}>{label}</div><div style={S.paramValue}>{value||"—"}{value&&unit&&<span style={S.paramUnit}>{unit}</span>}</div></div>);}
function ParamMini({rec}){return(<div style={{fontSize:12,color:"#94a3b8"}}>{[["彈簧前/後",`${rec.spring_rate_front||"—"}/${rec.spring_rate_rear||"—"} kg`],["伸側阻尼前/後",`${rec.damping_rebound_front||"—"}/${rec.damping_rebound_rear||"—"}`],["壓側阻尼前/後",`${rec.damping_compression_front||"—"}/${rec.damping_compression_rear||"—"}`],["預載前/後",`${rec.preload_front||"—"}/${rec.preload_rear||"—"} mm`],["車高",`${rec.ride_height_fingers||"—"} 指`]].map(([k,v])=>(<div key={k} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"1px solid #1e293b"}}><span>{k}</span><span style={{color:"#e2e8f0"}}>{v}</span></div>))}</div>);}

async function exportReport(rec){const c=document.createElement("canvas");c.width=800;c.height=1000;const ctx=c.getContext("2d");
  ctx.fillStyle="#0b0f1a";ctx.fillRect(0,0,800,1000);ctx.fillStyle="#f59e0b";ctx.font="bold 28px 'Noto Sans TC',sans-serif";ctx.textAlign="center";ctx.fillText("⚡ 避震調校報告",400,50);
  ctx.fillStyle="#64748b";ctx.font="14px 'Noto Sans TC'";ctx.fillText(new Date(rec.created_at).toLocaleString("zh-TW"),400,75);
  ctx.textAlign="left";ctx.fillStyle="#e2e8f0";ctx.font="bold 20px 'Noto Sans TC'";ctx.fillText(`${rec.license_plate}  ${rec.customer_name}`,40,120);
  ctx.fillStyle="#94a3b8";ctx.font="16px 'Noto Sans TC'";ctx.fillText(`${rec.car_model} · ${rec.shock_model}${rec.vehicle_weight?` · ${rec.vehicle_weight}kg`:""}${rec.technician?` · 技師: ${rec.technician}`:""}`,40,148);
  ctx.strokeStyle="#1e293b";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(40,168);ctx.lineTo(760,168);ctx.stroke();
  const params=[["彈簧（前）",rec.spring_rate_front,"kg/mm","彈簧（後）",rec.spring_rate_rear,"kg/mm"],["伸側阻尼（前）",rec.damping_rebound_front,"段","伸側阻尼（後）",rec.damping_rebound_rear,"段"],["壓側阻尼（前）",rec.damping_compression_front,"段","壓側阻尼（後）",rec.damping_compression_rear,"段"],["預載（前）",rec.preload_front,"mm","預載（後）",rec.preload_rear,"mm"],["車高",rec.ride_height_fingers,"指","胎壓",`${rec.tire_pressure_front||"—"}/${rec.tire_pressure_rear||"—"}`,"bar"]];
  let py=200;params.forEach(([l1,v1,u1,l2,v2,u2])=>{ctx.fillStyle="#111827";ctx.beginPath();ctx.roundRect(40,py,340,48,8);ctx.fill();ctx.beginPath();ctx.roundRect(420,py,340,48,8);ctx.fill();ctx.fillStyle="#64748b";ctx.font="13px 'Noto Sans TC'";ctx.fillText(l1,56,py+20);ctx.fillText(l2,436,py+20);ctx.fillStyle="#f59e0b";ctx.font="bold 18px 'JetBrains Mono',monospace";ctx.textAlign="right";ctx.fillText(`${v1||"—"} ${u1}`,364,py+36);ctx.fillText(`${v2||"—"} ${u2}`,744,py+36);ctx.textAlign="left";py+=58;});
  if(rec.issue_description){py+=10;ctx.fillStyle="#f59e0b";ctx.font="bold 15px 'Noto Sans TC'";ctx.fillText("車主反映問題",40,py);py+=24;ctx.fillStyle="#cbd5e1";ctx.font="14px 'Noto Sans TC'";rec.issue_description.slice(0,300).split("").reduce((acc,ch,i)=>{if(ch==="\n"||acc.length>=80){ctx.fillText(acc,40,py);py+=20;return ch==="\n"?"":ch}return acc+ch},"");}
  if(rec.symptoms&&rec.symptoms.length>0){py+=10;ctx.fillStyle="#f59e0b";ctx.font="bold 15px 'Noto Sans TC'";ctx.fillText("症狀",40,py);py+=20;ctx.fillStyle="#94a3b8";ctx.font="13px 'Noto Sans TC'";ctx.fillText(rec.symptoms.map(s=>SYMPTOMS.find(x=>x.id===s)?.label||s).join("、"),40,py);py+=20;}
  ctx.fillStyle="#334155";ctx.font="12px 'Noto Sans TC'";ctx.textAlign="center";ctx.fillText("Suspension Tuning System",400,975);
  const link=document.createElement("a");link.download=`調校報告_${rec.license_plate}_${new Date(rec.created_at).toLocaleDateString("zh-TW").replace(/\//g,"")}.png`;link.href=c.toDataURL("image/png");link.click();}

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

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3200); };
  const handleChange = useCallback((field, value) => {
    setForm(p => ({ ...p, [field]: value }));
    setTouched(p => ({ ...p, [field]: true }));
    setErrors(p => { if (p[field] && value.toString().trim()) { const n = { ...p }; delete n[field]; return n; } return p; });
    // 車牌自動帶入偵測
    if (field === "license_plate" && value.length >= 3) {
      const match = records.find(r => r.license_plate === value);
      setPlateMatch(match || null);
    } else if (field === "license_plate") { setPlateMatch(null); }
  }, [records]);
  const autoFillPlate = useCallback(() => {
    if (!plateMatch) return;
    const keep = ["license_plate","customer_name","customer_phone","car_model","shock_model","fork_type_front","fork_type_rear","drive_type","vehicle_weight","damping_max_clicks"];
    const filled = {};
    keep.forEach(k => { if (plateMatch[k]) filled[k] = plateMatch[k]; });
    setForm(p => ({ ...p, ...filled }));
    setPlateMatch(null);
    showToast("已帶入車主資料");
  }, [plateMatch]);
  const toggleSymptom = useCallback((id) => {
    setForm(p => ({ ...p, symptoms: p.symptoms.includes(id) ? p.symptoms.filter(s => s !== id) : [...p.symptoms, id] }));
  }, []);
  const validate = useCallback(() => {
    const e = {}; Object.entries(REQUIRED).forEach(([f, l]) => { if (!form[f] || !form[f].toString().trim()) e[f] = `${l} 為必填`; });
    setErrors(e); const allT = {}; Object.keys(REQUIRED).forEach(k => (allT[k] = true)); setTouched(p => ({ ...p, ...allT }));
    return Object.keys(e).length === 0;
  }, [form]);
  const fetchRecords = useCallback(async () => { if (!DB_OK) return; setLoading(true); const { data } = await api("suspension_records").select(); if (data) { setRecords(data); setFiltered(data); } setLoading(false); }, []);
  useEffect(() => { fetchRecords(); }, [fetchRecords]);
  const handleSearch = val => { setSearch(val); if (!val.trim()) { setFiltered(records); return; } const q = val.toLowerCase(); setFiltered(records.filter(r => [r.license_plate, r.customer_name, r.car_model, r.shock_model].some(s => (s || "").toLowerCase().includes(q)))); };
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
    setSaving(true); const payload = { ...form, symptoms: JSON.stringify(form.symptoms), created_at: new Date().toISOString() };
    if (!DB_OK) { const nr = { ...payload, id: Date.now() }; setRecords(p => [nr, ...p]); setFiltered(p => [nr, ...p]); resetForm(); showToast("已儲存（本地模式）"); setSaving(false); return; }
    const { error } = await api("suspension_records").insert([payload]);
    if (error) showToast("儲存失敗", "error"); else { showToast("紀錄已儲存！"); resetForm(); fetchRecords(); } setSaving(false);
  };
  const handleDelete = async (id) => {
    if (!DB_OK) { setRecords(p => p.filter(r => r.id !== id)); setFiltered(p => p.filter(r => r.id !== id)); showToast("已刪除"); setDelConfirm(null); return; }
    const { error } = await api("suspension_records").del(id); if (error) showToast("刪除失敗", "error"); else { showToast("已刪除"); fetchRecords(); } setDelConfirm(null);
  };
  const handleCopy = rec => { const { id, created_at, ...rest } = rec; const syms = typeof rest.symptoms === "string" ? JSON.parse(rest.symptoms || "[]") : (rest.symptoms || []);
    if (rest.fork_type && !rest.fork_type_front) { rest.fork_type_front = rest.fork_type; rest.fork_type_rear = "conventional"; }
    setForm({ ...EMPTY, ...rest, symptoms: syms }); setErrors({}); setTouched({}); setPage("form"); showToast("已載入紀錄到表單"); };
  const applyPreset = preset => { const { name, ...vals } = preset; setForm(p => ({ ...p, ...vals })); setShowPresets(false); showToast(`已套用「${name}」`); };
  const handleEdit = rec => { const { id, created_at, ...rest } = rec; const syms = typeof rest.symptoms === "string" ? JSON.parse(rest.symptoms || "[]") : (rest.symptoms || []);
    if (rest.fork_type && !rest.fork_type_front) { rest.fork_type_front = rest.fork_type; rest.fork_type_rear = "conventional"; }
    setForm({ ...EMPTY, ...rest, symptoms: syms }); setEditingId(id); setErrors({}); setTouched({}); setPage("form"); showToast("編輯模式 — 修改後點儲存"); };
  const handleUpdate = async () => {
    if (!validate()) { showToast("請填寫必填欄位", "error"); return; }
    setSaving(true); const payload = { ...form, symptoms: JSON.stringify(form.symptoms) };
    if (!DB_OK) {
      setRecords(p => p.map(r => r.id === editingId ? { ...r, ...payload } : r));
      setFiltered(p => p.map(r => r.id === editingId ? { ...r, ...payload } : r));
      setEditingId(null); setForm({ ...EMPTY }); setErrors({}); setTouched({}); showToast("已更新（本地模式）"); setSaving(false); return;
    }
    const { error } = await api("suspension_records").update(editingId, payload);
    if (error) showToast("更新失敗", "error"); else { showToast("紀錄已更新！"); setEditingId(null); setForm({ ...EMPTY }); setErrors({}); setTouched({}); fetchRecords(); } setSaving(false);
  };
  const errFor = f => (touched[f] && errors[f]) ? errors[f] : null;
  const missingN = Object.keys(REQUIRED).filter(k => !form[k] || !form[k].toString().trim()).length;
  const parseSymptoms = rec => { try { return typeof rec.symptoms === "string" ? JSON.parse(rec.symptoms) : (rec.symptoms || []); } catch { return []; } };

  // ─── FORM ───
  const renderForm = () => (
    <div style={S.page}>
      <div style={S.card}><h3 style={S.secTitle}>⚡ 即時懸吊模擬</h3><p style={S.secDesc}>調整參數後點「路面衝擊測試」觀察差異</p><SuspensionSim params={form} /></div>
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
        <InputField label="技師" field="technician" value={form.technician} onChange={handleChange} placeholder="技師名稱" />
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
    return (
      <div style={S.page}>
        {records.length > 0 && <StatsDashboard records={records} />}
        <div style={S.searchBox}><span style={S.searchIcon}>🔍</span><input value={search} onChange={e=>handleSearch(e.target.value)} placeholder="搜尋車牌、姓名、車型、避震型號..." style={S.searchInput} />{search && <button onClick={()=>handleSearch("")} style={S.clearBtn}>✕</button>}</div>
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
          <select value={dateFilter} onChange={e=>{setDateFilter(e.target.value);const v=e.target.value;if(!v){setFiltered(records);return}const now=new Date();let start;if(v==="7d")start=new Date(now-7*864e5);else if(v==="30d")start=new Date(now-30*864e5);else if(v==="90d")start=new Date(now-90*864e5);else{setFiltered(records);return}setFiltered(records.filter(r=>new Date(r.created_at)>=start))}} style={S.selectFilter}>
            <option value="">全部時間</option><option value="7d">最近 7 天</option><option value="30d">最近 30 天</option><option value="90d">最近 90 天</option>
          </select>
          <button onClick={()=>exportCSV(records)} style={S.exportBtn}>📥 匯出 CSV</button>
          <span style={{color:"#475569",fontSize:11,marginLeft:"auto"}}>{filtered.length} 筆紀錄</span>
        </div>
        {(compareA||compareB)&&<div style={S.compareBar}><span style={{color:"#94a3b8",flex:1}}>比較: {compareA?<span style={{color:"#ef4444"}}>A {compareA.license_plate}</span>:"選A"}{" ↔ "}{compareB?<span style={{color:"#22c55e"}}>B {compareB.license_plate}</span>:"選B"}</span>{compareA&&compareB&&<button onClick={()=>setShowCompare(true)} style={S.compareTrigger}>🔀 查看</button>}<button onClick={()=>{setCompareA(null);setCompareB(null);setShowCompare(false)}} style={S.cancelBtn}>取消</button></div>}
        {showCompare&&compareA&&compareB&&<div style={S.card}><h3 style={S.secTitle}>🔀 調整前後比較</h3><CompareWaveform before={compareA} after={compareB} /><div style={{display:"flex",gap:16,marginTop:16,flexWrap:"wrap"}}><div style={{flex:1,minWidth:200}}><div style={{color:"#ef4444",fontWeight:700,marginBottom:8}}>A: {compareA.license_plate}</div><ParamMini rec={compareA} /></div><div style={{flex:1,minWidth:200}}><div style={{color:"#22c55e",fontWeight:700,marginBottom:8}}>B: {compareB.license_plate}</div><ParamMini rec={compareB} /></div></div><h4 style={{color:"#94a3b8",fontSize:13,marginTop:20,marginBottom:10}}>動態模擬對比</h4><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><div style={{flex:1,minWidth:260}}><SuspensionSim params={compareA} label="調整前" compact /></div><div style={{flex:1,minWidth:260}}><SuspensionSim params={compareB} label="調整後" compact /></div></div></div>}
        {loading?<div style={S.empty}>載入中...</div>:Object.keys(groups).length===0?<div style={S.empty}>{search?"找不到符合的紀錄":"尚無紀錄"}</div>:Object.entries(groups).map(([plate,recs])=>(
          <div key={plate} style={S.plateGroup}><div style={S.plateHead} onClick={()=>setExpandedPlate(expandedPlate===plate?null:plate)}><span style={S.plateBadge}>{plate}</span><span style={S.plateInfo}>{recs[0]?.customer_name} · {recs[0]?.car_model}{recs[0]?.vehicle_weight?` · ${recs[0].vehicle_weight}kg`:""} · {recs.length} 筆</span><span style={{marginLeft:"auto",color:"#64748b",fontSize:12}}>{expandedPlate===plate?"▲":"▼"}</span></div>
            {expandedPlate===plate&&recs.length>=2&&<div style={{padding:"12px 16px",background:"#0a0e18",borderBottom:"1px solid #1e293b",display:"flex",gap:12,flexWrap:"wrap"}}><Sparkline records={recs} field="spring_rate_front" label="彈簧(前)" unit="kg" color="#f59e0b" /><Sparkline records={recs} field="damping_rebound_front" label="伸側阻尼(前)" unit="段" color="#3b82f6" /><Sparkline records={recs} field="preload_front" label="預載(前)" unit="mm" color="#22c55e" /></div>}
            {(expandedPlate===plate?recs:recs.slice(0,2)).map(rec=>{const syms=parseSymptoms(rec);return(
              <div key={rec.id} style={S.recRow}><div style={{flex:1,minWidth:0}}><div style={S.recDate}>{new Date(rec.created_at).toLocaleDateString("zh-TW",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}</div><div style={S.recTags}>{rec.shock_model&&<span style={S.tag}>{rec.shock_model}</span>}{rec.spring_rate_front&&<span style={S.tag}>前{rec.spring_rate_front}/後{rec.spring_rate_rear}kg</span>}{syms.length>0&&<span style={{...S.tag,background:"#3b82f622",color:"#93c5fd"}}>{syms.length}項症狀</span>}{rec.technician&&<span style={S.tag}>🔧 {rec.technician}</span>}</div>{rec.issue_description&&<div style={S.recIssue}>{rec.issue_description.slice(0,80)}{rec.issue_description.length>80?"...":""}</div>}</div>
                <div style={S.recActions}><button onClick={()=>{setSelected(rec);setPage("detail")}} style={S.actBtn} title="詳情">📋</button><button onClick={()=>handleEdit(rec)} style={S.actBtn} title="編輯">✏️</button><button onClick={()=>handleCopy(rec)} style={S.actBtn} title="複製">📝</button><button onClick={()=>{if(!compareA)setCompareA(rec);else if(!compareB)setCompareB(rec)}} style={{...S.actBtn,...(compareA?.id===rec.id||compareB?.id===rec.id?S.actOn:{})}} title="比較">🔀</button><button onClick={()=>exportReport(rec)} style={S.actBtn} title="匯出">📤</button><button onClick={()=>setDelConfirm(rec.id)} style={{...S.actBtn,...S.actDel}} title="刪除">🗑</button></div></div>)})}
            {expandedPlate!==plate&&recs.length>2&&<div style={{padding:"8px 16px",textAlign:"center"}}><button onClick={()=>setExpandedPlate(plate)} style={S.showMore}>展開其餘 {recs.length-2} 筆 ▼</button></div>}
          </div>))}
        {delConfirm&&<div style={S.overlay}><div style={S.modal}><div style={{fontSize:15,fontWeight:700,marginBottom:12,color:"#ef4444"}}>⚠ 確定刪除？</div><div style={{color:"#94a3b8",fontSize:13,marginBottom:20}}>此操作無法復原</div><div style={{display:"flex",gap:12,justifyContent:"center"}}><button onClick={()=>setDelConfirm(null)} style={S.cancelBtn}>取消</button><button onClick={()=>handleDelete(delConfirm)} style={S.delBtn}>確定刪除</button></div></div></div>}
      </div>
    );
  };

  // ─── DETAIL ───
  const renderDetail = () => {
    if (!selected) return null; const r = selected; const syms = parseSymptoms(r); const sameRecs = records.filter(x => x.license_plate === r.license_plate);
    return (
      <div style={S.page}><button onClick={()=>setPage("history")} style={S.backBtn}>← 返回列表</button>
        <div style={S.card}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}><h3 style={S.secTitle}>{r.license_plate} — {r.customer_name}</h3><div style={{display:"flex",gap:8,alignItems:"center"}}><button onClick={()=>handleEdit(r)} style={{...S.exportBtn,background:"#3b82f622",borderColor:"#3b82f644",color:"#93c5fd"}}>✏️ 編輯</button><button onClick={()=>exportReport(r)} style={S.exportBtn}>📤 匯出報告</button><span style={{color:"#64748b",fontSize:12}}>{new Date(r.created_at).toLocaleString("zh-TW")}</span></div></div>
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

  return (
    <div style={S.app}>
      <header style={S.header}><div style={S.headerInner}><div style={S.logo}><span style={{fontSize:28}}>⚡</span><div><div style={S.logoT}>SUSPENSION</div><div style={S.logoS}>TUNING SYSTEM</div></div></div>{!DB_OK&&<div style={S.demo}>DEMO — 請至 Netlify 設定環境變數</div>}</div></header>
      <nav style={S.nav}>{[{id:"form",icon:"🔧",text:"新增調校"},{id:"history",icon:"📋",text:"歷史紀錄"}].map(t=>(<button key={t.id} onClick={()=>setPage(t.id)} style={{...S.navBtn,...(page===t.id||(page==="detail"&&t.id==="history")?S.navOn:{})}}><span>{t.icon}</span> {t.text}{t.id==="history"&&records.length>0&&<span style={S.badge}>{records.length}</span>}</button>))}</nav>
      <main style={{paddingBottom:80}}>{page==="form"&&renderForm()}{page==="history"&&renderHistory()}{page==="detail"&&renderDetail()}</main>
      {toast&&<div style={{...S.toast,borderColor:toast.type==="error"?"#ef4444":"#22c55e",color:toast.type==="error"?"#fca5a5":"#86efac"}}>{toast.msg}</div>}
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
  bumpBtn:{position:"absolute",bottom:12,right:12,padding:"8px 16px",background:"linear-gradient(135deg,#f59e0b,#d97706)",border:"none",borderRadius:8,color:"#0f172a",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:"0 2px 12px #f59e0b44"},
  toggleBtn:{background:"transparent",border:"1px solid #1e293b",borderRadius:6,color:"#64748b",padding:"4px 12px",fontSize:12,cursor:"pointer"},
  presetBtn:{background:"#0f172a",border:"1px solid #1e293b",borderRadius:10,padding:"10px 16px",cursor:"pointer",color:"#e2e8f0",textAlign:"left",minWidth:160},
  exportBtn:{background:"#1e293b",border:"1px solid #334155",borderRadius:8,color:"#e2e8f0",padding:"6px 14px",fontSize:13,fontWeight:600,cursor:"pointer"},
  quickNote:{padding:"4px 10px",background:"#0f172a",border:"1px solid #1e293b",borderRadius:6,color:"#94a3b8",fontSize:11,cursor:"pointer",transition:"all 0.15s",whiteSpace:"nowrap"},
  selectFilter:{padding:"8px 12px",background:"#111827",border:"1px solid #1e293b",borderRadius:8,color:"#e2e8f0",fontSize:13,outline:"none",cursor:"pointer"},
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
