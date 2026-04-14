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
});

// ─── 常數 ───
const FORK_OPTS = [
  { value: "inverted", label: "倒叉" }, { value: "conventional", label: "正叉" },
  { value: "macpherson", label: "麥花臣" }, { value: "double_wishbone", label: "雙A臂" },
  { value: "multi_link", label: "多連桿" }, { value: "other", label: "其他" },
];

const EMPTY = {
  license_plate: "", customer_name: "", car_model: "", shock_model: "",
  fork_type: "inverted", spring_rate_front: "", spring_rate_rear: "",
  ride_height_fingers: "", tire_pressure_front: "", tire_pressure_rear: "",
  damping_rebound_front: "", damping_rebound_rear: "",
  damping_compression_front: "", damping_compression_rear: "",
  preload_front: "", preload_rear: "",
  camber_front: "", camber_rear: "", toe_front: "", toe_rear: "",
  issue_description: "", adjustment_notes: "", technician: "",
};

const REQUIRED = {
  license_plate: "車牌號碼", customer_name: "車主姓名", car_model: "車型",
  shock_model: "避震型號", spring_rate_front: "彈簧（前）", spring_rate_rear: "彈簧（後）",
  damping_rebound_front: "伸側阻尼（前）", damping_compression_front: "壓側阻尼（前）",
  preload_front: "預載（前）",
};

// ─── 快速範本 ───
const PRESETS = [
  { name: "MG HS 1.5T 舒適", car_model: "MG HS 1.5T", fork_type: "macpherson",
    spring_rate_front: "5", spring_rate_rear: "4", damping_rebound_front: "16", damping_rebound_rear: "14",
    damping_compression_front: "14", damping_compression_rear: "12", preload_front: "8", preload_rear: "6",
    ride_height_fingers: "3", tire_pressure_front: "2.4", tire_pressure_rear: "2.4" },
  { name: "MG HS 1.5T 運動", car_model: "MG HS 1.5T", fork_type: "macpherson",
    spring_rate_front: "7", spring_rate_rear: "6", damping_rebound_front: "20", damping_rebound_rear: "18",
    damping_compression_front: "18", damping_compression_rear: "16", preload_front: "10", preload_rear: "8",
    ride_height_fingers: "2", tire_pressure_front: "2.5", tire_pressure_rear: "2.5" },
  { name: "Focus MK4 街道", car_model: "Ford Focus MK4", fork_type: "macpherson",
    spring_rate_front: "6", spring_rate_rear: "5", damping_rebound_front: "14", damping_rebound_rear: "12",
    damping_compression_front: "12", damping_compression_rear: "10", preload_front: "7", preload_rear: "5",
    ride_height_fingers: "3", tire_pressure_front: "2.4", tire_pressure_rear: "2.3" },
  { name: "Civic FE 賽道", car_model: "Honda Civic FE", fork_type: "macpherson",
    spring_rate_front: "8", spring_rate_rear: "7", damping_rebound_front: "22", damping_rebound_rear: "20",
    damping_compression_front: "20", damping_compression_rear: "18", preload_front: "12", preload_rear: "10",
    ride_height_fingers: "1.5", tire_pressure_front: "2.6", tire_pressure_rear: "2.5" },
  { name: "86/BRZ 甩尾", car_model: "Toyota 86 / Subaru BRZ", fork_type: "macpherson",
    spring_rate_front: "7", spring_rate_rear: "5", damping_rebound_front: "18", damping_rebound_rear: "12",
    damping_compression_front: "16", damping_compression_rear: "10", preload_front: "8", preload_rear: "5",
    ride_height_fingers: "2", tire_pressure_front: "2.5", tire_pressure_rear: "2.3" },
];

// 步進設定
const STEP_MAP = {
  spring_rate_front: 0.5, spring_rate_rear: 0.5,
  damping_rebound_front: 1, damping_rebound_rear: 1,
  damping_compression_front: 1, damping_compression_rear: 1,
  preload_front: 1, preload_rear: 1,
  ride_height_fingers: 0.5,
  tire_pressure_front: 0.1, tire_pressure_rear: 0.1,
  camber_front: 0.1, camber_rear: 0.1,
  toe_front: 0.05, toe_rear: 0.05,
};

// ═══════════════════════════════════════
//  InputField — 穩定元件，不重建
// ═══════════════════════════════════════
function InputField({ label, field, value, onChange, type, unit, placeholder, half, required, error, step }) {
  const isNum = type === "number";
  const stepVal = step || STEP_MAP[field] || 1;
  const inc = () => { const v = parseFloat(value) || 0; onChange(field, String(Math.round((v + stepVal) * 100) / 100)); };
  const dec = () => { const v = parseFloat(value) || 0; onChange(field, String(Math.round((v - stepVal) * 100) / 100)); };

  return (
    <div style={{ flex: half ? "1 1 45%" : "1 1 100%", minWidth: half ? 140 : 200 }}
      data-error={error ? "true" : undefined}>
      <label style={S.label}>
        {label}{required && <span style={S.req}>*</span>}
      </label>
      <div style={S.inputWrap}>
        {isNum && <button type="button" onClick={dec} style={S.stepBtn} tabIndex={-1}>−</button>}
        <input
          type={type || "text"} value={value}
          onChange={(e) => onChange(field, e.target.value)}
          placeholder={placeholder || label}
          step={isNum ? stepVal : undefined}
          style={{ ...S.input, ...(error ? S.inputErr : {}), ...(isNum ? S.inputNum : {}) }}
        />
        {isNum && <button type="button" onClick={inc} style={S.stepBtn} tabIndex={-1}>+</button>}
        {unit && <span style={S.unit}>{unit}</span>}
      </div>
      {error && <div style={S.errText}>{error}</div>}
    </div>
  );
}

function TextArea({ label, field, value, onChange, placeholder, rows }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={S.label}>{label}</label>
      <textarea value={value} onChange={(e) => onChange(field, e.target.value)}
        placeholder={placeholder} style={S.textarea} rows={rows || 3} />
    </div>
  );
}

// ═══════════════════════════════════════
//  懸吊模擬
// ═══════════════════════════════════════
function usePhysics(params) {
  return useMemo(() => {
    const dr = Number(params.damping_rebound_front) || 0;
    const dc = Number(params.damping_compression_front) || 0;
    const sp = Number(params.spring_rate_front) || 6;
    const pl = Number(params.preload_front) || 0;
    const ht = Number(params.ride_height_fingers) || 4;
    const da = (dr + dc) / 2;
    return {
      dampingRatio: Math.min(0.95, Math.max(0.05, da * 0.035)),
      natFreq: 1.0 + sp * 0.25,
      baseAmp: Math.max(5, 45 - pl * 1.5 - da * 1.2),
      heightOffset: (4 - ht) * 12,
      oscillations: Math.max(1, Math.round(6 - da * 0.18)),
      dampAvg: da, spring: sp, preload: pl,
    };
  }, [params.damping_rebound_front, params.damping_compression_front, params.spring_rate_front, params.preload_front, params.ride_height_fingers]);
}

function SuspensionSim({ params, label, compact }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const stRef = useRef({ time: 0, bumping: false, bumpStart: 0 });
  const physics = usePhysics(params);

  const triggerBump = useCallback(() => {
    stRef.current.bumping = true;
    stRef.current.bumpStart = stRef.current.time;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const draw = () => {
      const W = canvas.width, H = canvas.height, st = stRef.current, t = st.time;
      const { dampingRatio, natFreq, baseAmp, heightOffset, oscillations, dampAvg, spring } = physics;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#0c101c"; ctx.fillRect(0, 0, W, H);

      const roadY = H * 0.80, baseCarY = H * 0.35 + heightOffset;
      let bodyDisp = 0, wheelDisp = 0;

      if (st.bumping) {
        const el = t - st.bumpStart;
        const w = natFreq * Math.PI * 2;
        const wd = w * Math.sqrt(Math.max(0.001, 1 - dampingRatio * dampingRatio));
        const decay = Math.exp(-dampingRatio * w * el);
        bodyDisp = baseAmp * decay * Math.sin(wd * el);
        wheelDisp = baseAmp * 0.3 * decay * Math.sin(wd * el * 1.8);
        if (el > 5 && Math.abs(bodyDisp) < 0.5) st.bumping = false;
      } else {
        bodyDisp = Math.sin(t * 2) * 1.2;
        wheelDisp = Math.sin(t * 3.5) * 0.6;
      }

      const carY = baseCarY + bodyDisp, wY = roadY - 20 + wheelDisp * 0.3, cx = W * 0.5;

      // Road
      ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2; ctx.beginPath();
      for (let x = 0; x < W; x++) ctx.lineTo(x, roadY + Math.sin((x + t * 20) * 0.05) * 3);
      ctx.stroke();
      ctx.fillStyle = "#0a0e18"; ctx.fillRect(0, roadY + 6, W, H);
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
          if (i === 0) ctx.moveTo(x, py); else ctx.lineTo(px, py);
        }
        ctx.lineTo(x, bot); ctx.stroke();
      };
      drawStrut(cx - 80); drawStrut(cx + 80);

      // Car
      ctx.fillStyle = "#00000044"; ctx.beginPath(); ctx.ellipse(cx, roadY + 2, 105, 6, 0, 0, Math.PI * 2); ctx.fill();
      const grd = ctx.createLinearGradient(cx - 120, carY - 40, cx + 120, carY + 45);
      grd.addColorStop(0, "#1e293b"); grd.addColorStop(0.5, "#253349"); grd.addColorStop(1, "#1a2332");
      ctx.fillStyle = grd; ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(cx - 115, carY + 32); ctx.lineTo(cx - 105, carY + 5); ctx.lineTo(cx - 65, carY - 22);
      ctx.lineTo(cx - 32, carY - 42); ctx.lineTo(cx + 38, carY - 42); ctx.lineTo(cx + 72, carY - 22);
      ctx.lineTo(cx + 112, carY + 5); ctx.lineTo(cx + 118, carY + 32); ctx.lineTo(cx + 112, carY + 44);
      ctx.lineTo(cx - 108, carY + 44); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#0ea5e918"; ctx.strokeStyle = "#0ea5e933"; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(cx - 58, carY - 18); ctx.lineTo(cx - 30, carY - 38); ctx.lineTo(cx + 34, carY - 38);
      ctx.lineTo(cx + 65, carY - 18); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fbbf24"; ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 15;
      ctx.beginPath(); ctx.ellipse(cx + 112, carY + 16, 5, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = "#ef4444"; ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.ellipse(cx - 107, carY + 16, 4, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;

      // Wheels
      const drawWheel = (x) => {
        ctx.fillStyle = "#0f172a"; ctx.strokeStyle = "#334155"; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.arc(x, wY, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#475569"; ctx.beginPath(); ctx.arc(x, wY, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#64748b"; ctx.lineWidth = 1.5;
        for (let i = 0; i < 5; i++) {
          const a = (Math.PI * 2 * i) / 5 + t * 2;
          ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 6, wY + Math.sin(a) * 6);
          ctx.lineTo(x + Math.cos(a) * 14, wY + Math.sin(a) * 14); ctx.stroke();
        }
      };
      drawWheel(cx - 80); drawWheel(cx + 80);

      // HUD
      const mag = Math.abs(bodyDisp);
      const clr = mag > 20 ? "#ef4444" : mag > 10 ? "#f59e0b" : "#22c55e";
      ctx.fillStyle = clr; ctx.font = "bold 14px 'JetBrains Mono',monospace"; ctx.textAlign = "left";
      ctx.fillText(`位移: ${mag.toFixed(1)}mm`, 14, 24);
      ctx.fillStyle = "#1e293b"; ctx.beginPath(); ctx.roundRect(14, 30, 140, 10, 5); ctx.fill();
      ctx.fillStyle = clr; ctx.beginPath(); ctx.roundRect(14, 30, Math.min(140, mag * 3.1), 10, 5); ctx.fill();
      const stat = mag > 20 ? "⚠ 過度晃動" : mag > 10 ? "△ 偏軟需調整" : "✓ 穩定";
      ctx.fillStyle = clr; ctx.font = "bold 12px 'Noto Sans TC',sans-serif"; ctx.fillText(stat, 14, 58);
      if (st.bumping) {
        ctx.fillStyle = "#94a3b8"; ctx.font = "11px 'JetBrains Mono'";
        ctx.fillText(`預估回彈 ≈ ${oscillations} 次`, 14, 74);
      }
      if (!compact) {
        ctx.fillStyle = "#64748b"; ctx.font = "11px 'JetBrains Mono',monospace"; ctx.textAlign = "right";
        ctx.fillText(`彈簧:${spring}kg 阻尼:${dampAvg.toFixed(0)}段 預載:${physics.preload}mm`, W - 14, 22);
        ctx.fillText(`ζ=${dampingRatio.toFixed(2)} f=${natFreq.toFixed(1)}Hz`, W - 14, 38);
      }
      if (label) {
        ctx.fillStyle = label === "調整前" ? "#ef4444" : "#22c55e";
        ctx.font = "bold 14px 'Noto Sans TC'"; ctx.textAlign = "center"; ctx.fillText(label, W / 2, H - 10);
      }
      st.time += 0.02;
      animRef.current = requestAnimationFrame(draw);
    };
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [physics, label, compact]);

  return (
    <div style={{ position: "relative" }}>
      <canvas ref={canvasRef} width={600} height={compact ? 240 : 320}
        style={{ width: "100%", height: "auto", borderRadius: 12, border: "1px solid #1e293b", display: "block" }} />
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
    const da = ((Number(p.damping_rebound_front) || 0) + (Number(p.damping_compression_front) || 0)) / 2;
    return {
      z: Math.min(0.95, Math.max(0.05, da * 0.035)),
      f: 1.0 + (Number(p.spring_rate_front) || 6) * 0.25,
      a: Math.max(5, 45 - (Number(p.preload_front) || 0) * 1.5 - da * 1.2),
    };
  };
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#0c101c"; ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 40) { ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    ctx.strokeStyle = "#334155"; ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();

    [{ p: calc(before), c: "#ef4444", n: "調整前" }, { p: calc(after), c: "#22c55e", n: "調整後" }].forEach(({ p, c, n }, i) => {
      const w = p.f * Math.PI * 2, wd = w * Math.sqrt(Math.max(0.001, 1 - p.z * p.z));
      ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.beginPath();
      for (let x = 0; x < W; x++) { const t = (x / W) * 4; const y = H / 2 - p.a * Math.exp(-p.z * w * t) * Math.sin(wd * t) * (H * 0.008); x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.stroke();
      ctx.strokeStyle = c + "44"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); for (let x = 0; x < W; x++) { const t = (x / W) * 4; ctx.lineTo(x, H / 2 - p.a * Math.exp(-p.z * w * t) * (H * 0.008)); } ctx.stroke();
      ctx.beginPath(); for (let x = 0; x < W; x++) { const t = (x / W) * 4; ctx.lineTo(x, H / 2 + p.a * Math.exp(-p.z * w * t) * (H * 0.008)); } ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = c; ctx.font = "bold 13px 'Noto Sans TC'"; ctx.textAlign = "left";
      ctx.fillText(`● ${n}`, 10, i === 0 ? 22 : 42);
      ctx.fillStyle = "#94a3b8"; ctx.font = "11px 'JetBrains Mono'";
      ctx.fillText(`振幅${p.a.toFixed(0)}mm ζ=${p.z.toFixed(2)} f=${p.f.toFixed(1)}Hz`, 90, i === 0 ? 22 : 42);
    });
    ctx.fillStyle = "#475569"; ctx.font = "10px 'JetBrains Mono'"; ctx.textAlign = "center";
    for (let s = 0; s <= 4; s++) ctx.fillText(`${s}s`, (s / 4) * W, H - 4);
  }, [before, after]);
  return <canvas ref={canvasRef} width={600} height={220}
    style={{ width: "100%", height: "auto", borderRadius: 12, border: "1px solid #1e293b", display: "block" }} />;
}

// ═══════════════════════════════════════
//  趨勢迷你圖（同車牌歷次某欄位變化）
// ═══════════════════════════════════════
function Sparkline({ records, field, label, unit, color }) {
  const canvasRef = useRef(null);
  const vals = records.map((r) => Number(r[field]) || 0).reverse();
  useEffect(() => {
    const c = canvasRef.current; if (!c || vals.length < 2) return;
    const ctx = c.getContext("2d"), W = c.width, H = c.height;
    const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
    vals.forEach((v, i) => {
      const x = (i / (vals.length - 1)) * W, y = H - 4 - ((v - mn) / rng) * (H - 8);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    // Dots
    vals.forEach((v, i) => {
      const x = (i / (vals.length - 1)) * W, y = H - 4 - ((v - mn) / rng) * (H - 8);
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    });
  }, [vals, color]);

  if (vals.length < 2) return null;
  return (
    <div style={{ flex: "1 1 120px", minWidth: 120 }}>
      <div style={{ color: "#64748b", fontSize: 10, marginBottom: 2 }}>{label}</div>
      <canvas ref={canvasRef} width={120} height={40} style={{ width: "100%", height: 40, display: "block" }} />
      <div style={{ color: "#94a3b8", fontSize: 10, display: "flex", justifyContent: "space-between" }}>
        <span>{vals[0]}{unit}</span><span>{vals[vals.length - 1]}{unit}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  統計儀表板
// ═══════════════════════════════════════
function StatsDashboard({ records }) {
  const now = new Date();
  const thisMonth = records.filter((r) => {
    const d = new Date(r.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const plates = new Set(records.map((r) => r.license_plate));
  const thisMonthPlates = new Set(thisMonth.map((r) => r.license_plate));
  const repeatPlates = [...plates].filter((p) => records.filter((r) => r.license_plate === p).length > 1);

  const stats = [
    { label: "總紀錄", value: records.length, icon: "📊" },
    { label: "不同車輛", value: plates.size, icon: "🚗" },
    { label: "本月調校", value: thisMonth.length, icon: "📅" },
    { label: "回訪車輛", value: repeatPlates.length, icon: "🔄" },
  ];

  return (
    <div style={S.statsGrid}>
      {stats.map((s) => (
        <div key={s.label} style={S.statCard}>
          <div style={{ fontSize: 20 }}>{s.icon}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b", fontFamily: "'JetBrains Mono'" }}>{s.value}</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════
//  小元件
// ═══════════════════════════════════════
function ParamItem({ label, value, unit }) {
  return (
    <div style={S.paramItem}>
      <div style={S.paramLabel}>{label}</div>
      <div style={S.paramValue}>{value || "—"}{value && unit && <span style={S.paramUnit}>{unit}</span>}</div>
    </div>
  );
}
function ParamMini({ rec }) {
  return (
    <div style={{ fontSize: 12, color: "#94a3b8" }}>
      {[["彈簧前/後", `${rec.spring_rate_front || "—"}/${rec.spring_rate_rear || "—"} kg`],
        ["伸側阻尼前/後", `${rec.damping_rebound_front || "—"}/${rec.damping_rebound_rear || "—"}`],
        ["壓側阻尼前/後", `${rec.damping_compression_front || "—"}/${rec.damping_compression_rear || "—"}`],
        ["預載前/後", `${rec.preload_front || "—"}/${rec.preload_rear || "—"} mm`],
        ["車高", `${rec.ride_height_fingers || "—"} 指`],
      ].map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1e293b" }}>
          <span>{k}</span><span style={{ color: "#e2e8f0" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════
//  匯出客戶報告圖
// ═══════════════════════════════════════
async function exportReport(rec) {
  const c = document.createElement("canvas");
  c.width = 800; c.height = 1000;
  const ctx = c.getContext("2d");

  // Background
  ctx.fillStyle = "#0b0f1a"; ctx.fillRect(0, 0, 800, 1000);

  // Header
  ctx.fillStyle = "#f59e0b"; ctx.font = "bold 28px 'Noto Sans TC',sans-serif";
  ctx.textAlign = "center"; ctx.fillText("⚡ 避震調校報告", 400, 50);
  ctx.fillStyle = "#64748b"; ctx.font = "14px 'Noto Sans TC'";
  ctx.fillText(new Date(rec.created_at).toLocaleString("zh-TW"), 400, 75);

  // Info
  ctx.textAlign = "left"; ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 20px 'Noto Sans TC'";
  ctx.fillText(`${rec.license_plate}  ${rec.customer_name}`, 40, 120);
  ctx.fillStyle = "#94a3b8"; ctx.font = "16px 'Noto Sans TC'";
  ctx.fillText(`${rec.car_model} · ${rec.shock_model}${rec.technician ? ` · 技師: ${rec.technician}` : ""}`, 40, 148);

  // Divider
  ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(40, 168); ctx.lineTo(760, 168); ctx.stroke();

  // Params
  const params = [
    ["彈簧（前）", rec.spring_rate_front, "kg/mm", "彈簧（後）", rec.spring_rate_rear, "kg/mm"],
    ["伸側阻尼（前）", rec.damping_rebound_front, "段", "伸側阻尼（後）", rec.damping_rebound_rear, "段"],
    ["壓側阻尼（前）", rec.damping_compression_front, "段", "壓側阻尼（後）", rec.damping_compression_rear, "段"],
    ["預載（前）", rec.preload_front, "mm", "預載（後）", rec.preload_rear, "mm"],
    ["車高", rec.ride_height_fingers, "指", "胎壓", `${rec.tire_pressure_front || "—"} / ${rec.tire_pressure_rear || "—"}`, "PSI"],
    ["外傾角", `${rec.camber_front || "—"} / ${rec.camber_rear || "—"}`, "°", "束角", `${rec.toe_front || "—"} / ${rec.toe_rear || "—"}`, "°"],
  ];
  let py = 200;
  params.forEach(([l1, v1, u1, l2, v2, u2]) => {
    ctx.fillStyle = "#111827";
    ctx.beginPath(); ctx.roundRect(40, py, 340, 48, 8); ctx.fill();
    ctx.beginPath(); ctx.roundRect(420, py, 340, 48, 8); ctx.fill();

    ctx.fillStyle = "#64748b"; ctx.font = "13px 'Noto Sans TC'";
    ctx.fillText(l1, 56, py + 20);
    ctx.fillText(l2, 436, py + 20);

    ctx.fillStyle = "#f59e0b"; ctx.font = "bold 18px 'JetBrains Mono',monospace";
    ctx.textAlign = "right";
    ctx.fillText(`${v1 || "—"} ${u1}`, 364, py + 36);
    ctx.fillText(`${v2 || "—"} ${u2}`, 744, py + 36);
    ctx.textAlign = "left";
    py += 58;
  });

  // Issue
  if (rec.issue_description) {
    py += 10;
    ctx.fillStyle = "#f59e0b"; ctx.font = "bold 15px 'Noto Sans TC'"; ctx.fillText("車主反映問題", 40, py);
    py += 24;
    ctx.fillStyle = "#cbd5e1"; ctx.font = "14px 'Noto Sans TC'";
    const lines = wrapText(rec.issue_description, 90);
    lines.slice(0, 4).forEach((line) => { ctx.fillText(line, 40, py); py += 20; });
  }

  if (rec.adjustment_notes) {
    py += 10;
    ctx.fillStyle = "#f59e0b"; ctx.font = "bold 15px 'Noto Sans TC'"; ctx.fillText("調整備註", 40, py);
    py += 24;
    ctx.fillStyle = "#cbd5e1"; ctx.font = "14px 'Noto Sans TC'";
    const lines = wrapText(rec.adjustment_notes, 90);
    lines.slice(0, 4).forEach((line) => { ctx.fillText(line, 40, py); py += 20; });
  }

  // Footer
  ctx.fillStyle = "#334155"; ctx.font = "12px 'Noto Sans TC'"; ctx.textAlign = "center";
  ctx.fillText("Suspension Tuning System — 避震調校管理系統", 400, 975);

  // Download
  const link = document.createElement("a");
  link.download = `調校報告_${rec.license_plate}_${new Date(rec.created_at).toLocaleDateString("zh-TW").replace(/\//g, "")}.png`;
  link.href = c.toDataURL("image/png");
  link.click();
}

function wrapText(text, maxChars) {
  const result = [];
  let line = "";
  for (const ch of text) {
    if (ch === "\n" || line.length >= maxChars) { result.push(line); line = ch === "\n" ? "" : ch; }
    else line += ch;
  }
  if (line) result.push(line);
  return result;
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

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3200); };

  const handleChange = useCallback((field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    setTouched((p) => ({ ...p, [field]: true }));
    setErrors((p) => { if (p[field] && value.toString().trim()) { const n = { ...p }; delete n[field]; return n; } return p; });
  }, []);

  const validate = useCallback(() => {
    const e = {};
    Object.entries(REQUIRED).forEach(([f, l]) => { if (!form[f] || !form[f].toString().trim()) e[f] = `${l} 為必填`; });
    setErrors(e);
    const allT = {}; Object.keys(REQUIRED).forEach((k) => (allT[k] = true));
    setTouched((p) => ({ ...p, ...allT }));
    return Object.keys(e).length === 0;
  }, [form]);

  const fetchRecords = useCallback(async () => {
    if (!DB_OK) return;
    setLoading(true);
    const { data } = await api("suspension_records").select();
    if (data) { setRecords(data); setFiltered(data); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleSearch = (val) => {
    setSearch(val);
    if (!val.trim()) { setFiltered(records); return; }
    const q = val.toLowerCase();
    setFiltered(records.filter((r) => [r.license_plate, r.customer_name, r.car_model, r.shock_model].some((s) => (s || "").toLowerCase().includes(q))));
  };

  const handleSave = async () => {
    if (!validate()) {
      showToast("請填寫所有必填欄位（標示 * 的欄位）", "error");
      setTimeout(() => { const el = document.querySelector('[data-error="true"]'); el?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 100);
      return;
    }
    setSaving(true);
    const payload = { ...form, created_at: new Date().toISOString() };
    if (!DB_OK) {
      const nr = { ...payload, id: Date.now() };
      setRecords((p) => [nr, ...p]); setFiltered((p) => [nr, ...p]);
      setForm({ ...EMPTY }); setErrors({}); setTouched({});
      showToast("已儲存（本地模式）"); setSaving(false); return;
    }
    const { error } = await api("suspension_records").insert([payload]);
    if (error) showToast("儲存失敗", "error");
    else { showToast("紀錄已儲存！"); setForm({ ...EMPTY }); setErrors({}); setTouched({}); fetchRecords(); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!DB_OK) {
      setRecords((p) => p.filter((r) => r.id !== id));
      setFiltered((p) => p.filter((r) => r.id !== id));
      showToast("已刪除"); setDelConfirm(null); return;
    }
    const { error } = await api("suspension_records").del(id);
    if (error) showToast("刪除失敗", "error");
    else { showToast("已刪除"); fetchRecords(); }
    setDelConfirm(null);
  };

  const handleCopy = (rec) => {
    const { id, created_at, ...rest } = rec;
    setForm(rest); setErrors({}); setTouched({}); setPage("form"); showToast("已載入紀錄到表單");
  };

  const applyPreset = (preset) => {
    const { name, ...vals } = preset;
    setForm((p) => ({ ...p, ...vals })); setShowPresets(false); showToast(`已套用「${name}」範本`);
  };

  const errFor = (f) => (touched[f] && errors[f]) ? errors[f] : null;
  const missingN = Object.keys(REQUIRED).filter((k) => !form[k] || !form[k].toString().trim()).length;

  // ─── FORM ───
  const renderForm = () => (
    <div style={S.page}>
      <div style={S.card}>
        <h3 style={S.secTitle}>⚡ 即時懸吊模擬</h3>
        <p style={S.secDesc}>調整下方參數後點擊「路面衝擊測試」觀察避震反應差異</p>
        <SuspensionSim params={form} />
      </div>

      {/* 快速範本 */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ ...S.secTitle, marginBottom: 0 }}>🏎️ 快速範本</h3>
          <button onClick={() => setShowPresets(!showPresets)} style={S.toggleBtn}>
            {showPresets ? "收合 ▲" : "展開 ▼"}
          </button>
        </div>
        {showPresets && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {PRESETS.map((p) => (
              <button key={p.name} onClick={() => applyPreset(p)} style={S.presetBtn}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                  彈簧{p.spring_rate_front}/{p.spring_rate_rear}kg 阻尼{p.damping_rebound_front}段
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 基本資料 */}
      <div style={S.card}>
        <h3 style={S.secTitle}>🚗 基本資料</h3>
        <div style={S.row}>
          <InputField label="車牌號碼" field="license_plate" value={form.license_plate} onChange={handleChange} placeholder="ABC-1234" half required error={errFor("license_plate")} />
          <InputField label="車主姓名" field="customer_name" value={form.customer_name} onChange={handleChange} placeholder="王大明" half required error={errFor("customer_name")} />
        </div>
        <div style={S.row}>
          <InputField label="車型" field="car_model" value={form.car_model} onChange={handleChange} placeholder="MG HS 1.5T" half required error={errFor("car_model")} />
          <InputField label="避震型號" field="shock_model" value={form.shock_model} onChange={handleChange} placeholder="BC BR / KW V3..." half required error={errFor("shock_model")} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={S.label}>懸吊型式</label>
          <div style={S.chipRow}>
            {FORK_OPTS.map((o) => (
              <button key={o.value} onClick={() => handleChange("fork_type", o.value)}
                style={{ ...S.chip, ...(form.fork_type === o.value ? S.chipOn : {}) }}>{o.label}</button>
            ))}
          </div>
        </div>
        <InputField label="技師" field="technician" value={form.technician} onChange={handleChange} placeholder="技師名稱" />
      </div>

      {/* 彈簧車高 */}
      <div style={S.card}>
        <h3 style={S.secTitle}>🔧 彈簧與車高</h3>
        <div style={S.row}>
          <InputField label="彈簧磅數（前）" field="spring_rate_front" value={form.spring_rate_front} onChange={handleChange} type="number" unit="kg/mm" half required error={errFor("spring_rate_front")} />
          <InputField label="彈簧磅數（後）" field="spring_rate_rear" value={form.spring_rate_rear} onChange={handleChange} type="number" unit="kg/mm" half required error={errFor("spring_rate_rear")} />
        </div>
        <div style={S.row}>
          <InputField label="車高（剩餘指數）" field="ride_height_fingers" value={form.ride_height_fingers} onChange={handleChange} type="number" unit="指" half />
          <InputField label="胎壓（前）" field="tire_pressure_front" value={form.tire_pressure_front} onChange={handleChange} type="number" unit="PSI" half />
        </div>
        <div style={S.row}>
          <InputField label="胎壓（後）" field="tire_pressure_rear" value={form.tire_pressure_rear} onChange={handleChange} type="number" unit="PSI" half />
        </div>
      </div>

      {/* 阻尼 */}
      <div style={S.card}>
        <h3 style={S.secTitle}>⚙️ 阻尼設定</h3>
        <div style={S.row}>
          <InputField label="伸側阻尼（前）" field="damping_rebound_front" value={form.damping_rebound_front} onChange={handleChange} type="number" unit="段" half required error={errFor("damping_rebound_front")} />
          <InputField label="伸側阻尼（後）" field="damping_rebound_rear" value={form.damping_rebound_rear} onChange={handleChange} type="number" unit="段" half />
        </div>
        <div style={S.row}>
          <InputField label="壓側阻尼（前）" field="damping_compression_front" value={form.damping_compression_front} onChange={handleChange} type="number" unit="段" half required error={errFor("damping_compression_front")} />
          <InputField label="壓側阻尼（後）" field="damping_compression_rear" value={form.damping_compression_rear} onChange={handleChange} type="number" unit="段" half />
        </div>
        <div style={S.row}>
          <InputField label="預載（前）" field="preload_front" value={form.preload_front} onChange={handleChange} type="number" unit="mm" half required error={errFor("preload_front")} />
          <InputField label="預載（後）" field="preload_rear" value={form.preload_rear} onChange={handleChange} type="number" unit="mm" half />
        </div>
      </div>

      {/* 定位 */}
      <div style={S.card}>
        <h3 style={S.secTitle}>📐 定位角度</h3>
        <div style={S.row}>
          <InputField label="外傾角（前）" field="camber_front" value={form.camber_front} onChange={handleChange} type="number" unit="°" half />
          <InputField label="外傾角（後）" field="camber_rear" value={form.camber_rear} onChange={handleChange} type="number" unit="°" half />
        </div>
        <div style={S.row}>
          <InputField label="束角（前）" field="toe_front" value={form.toe_front} onChange={handleChange} type="number" unit="°" half />
          <InputField label="束角（後）" field="toe_rear" value={form.toe_rear} onChange={handleChange} type="number" unit="°" half />
        </div>
      </div>

      {/* 備註 */}
      <div style={S.card}>
        <h3 style={S.secTitle}>📝 問題描述與備註</h3>
        <TextArea label="車主反映問題" field="issue_description" value={form.issue_description} onChange={handleChange}
          placeholder="例：路面不平時搖晃次數多、快速回彈、觸發晃動搖超過2-3下..." />
        <TextArea label="調整備註" field="adjustment_notes" value={form.adjustment_notes} onChange={handleChange}
          placeholder="調整內容、建議、後續追蹤事項..." />
      </div>

      {Object.keys(errors).length > 0 && (
        <div style={S.errBanner} data-error="true">⚠ 尚有 {Object.keys(errors).length} 個必填欄位未填：{Object.values(errors).join("、")}</div>
      )}
      <button onClick={handleSave} disabled={saving} style={S.saveBtn}>
        {saving ? "儲存中..." : "💾 儲存紀錄"}
        {missingN > 0 && !saving && <span style={S.missBadge}>{missingN} 個必填未填</span>}
      </button>
    </div>
  );

  // ─── HISTORY ───
  const renderHistory = () => {
    const groups = {};
    filtered.forEach((r) => { const p = r.license_plate || "未知"; if (!groups[p]) groups[p] = []; groups[p].push(r); });

    return (
      <div style={S.page}>
        {records.length > 0 && <StatsDashboard records={records} />}

        <div style={S.searchBox}>
          <span style={S.searchIcon}>🔍</span>
          <input value={search} onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜尋車牌、姓名、車型、避震型號..." style={S.searchInput} />
          {search && <button onClick={() => handleSearch("")} style={S.clearBtn}>✕</button>}
        </div>

        {(compareA || compareB) && (
          <div style={S.compareBar}>
            <span style={{ color: "#94a3b8", flex: 1 }}>
              比較: {compareA ? <span style={{ color: "#ef4444" }}>A {compareA.license_plate}</span> : "選A"}
              {" ↔ "}{compareB ? <span style={{ color: "#22c55e" }}>B {compareB.license_plate}</span> : "選B"}
            </span>
            {compareA && compareB && <button onClick={() => setShowCompare(true)} style={S.compareTrigger}>🔀 查看</button>}
            <button onClick={() => { setCompareA(null); setCompareB(null); setShowCompare(false); }} style={S.cancelBtn}>取消</button>
          </div>
        )}

        {showCompare && compareA && compareB && (
          <div style={S.card}>
            <h3 style={S.secTitle}>🔀 調整前後比較</h3>
            <CompareWaveform before={compareA} after={compareB} />
            <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ color: "#ef4444", fontWeight: 700, marginBottom: 8 }}>A: {compareA.license_plate} — {new Date(compareA.created_at).toLocaleDateString("zh-TW")}</div>
                <ParamMini rec={compareA} />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ color: "#22c55e", fontWeight: 700, marginBottom: 8 }}>B: {compareB.license_plate} — {new Date(compareB.created_at).toLocaleDateString("zh-TW")}</div>
                <ParamMini rec={compareB} />
              </div>
            </div>
            <h4 style={{ color: "#94a3b8", fontSize: 13, marginTop: 20, marginBottom: 10 }}>動態模擬對比</h4>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 260 }}><SuspensionSim params={compareA} label="調整前" compact /></div>
              <div style={{ flex: 1, minWidth: 260 }}><SuspensionSim params={compareB} label="調整後" compact /></div>
            </div>
          </div>
        )}

        {loading ? <div style={S.empty}>載入中...</div>
        : Object.keys(groups).length === 0 ? <div style={S.empty}>{search ? "找不到符合的紀錄" : "尚無紀錄"}</div>
        : Object.entries(groups).map(([plate, recs]) => (
          <div key={plate} style={S.plateGroup}>
            <div style={S.plateHead} onClick={() => setExpandedPlate(expandedPlate === plate ? null : plate)}>
              <span style={S.plateBadge}>{plate}</span>
              <span style={S.plateInfo}>{recs[0]?.customer_name} · {recs[0]?.car_model} · {recs.length} 筆</span>
              <span style={{ marginLeft: "auto", color: "#64748b", fontSize: 12 }}>{expandedPlate === plate ? "▲" : "▼"}</span>
            </div>

            {/* 趨勢迷你圖 */}
            {expandedPlate === plate && recs.length >= 2 && (
              <div style={{ padding: "12px 16px", background: "#0a0e18", borderBottom: "1px solid #1e293b", display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Sparkline records={recs} field="spring_rate_front" label="彈簧(前)" unit="kg" color="#f59e0b" />
                <Sparkline records={recs} field="damping_rebound_front" label="伸側阻尼(前)" unit="段" color="#3b82f6" />
                <Sparkline records={recs} field="damping_compression_front" label="壓側阻尼(前)" unit="段" color="#8b5cf6" />
                <Sparkline records={recs} field="preload_front" label="預載(前)" unit="mm" color="#22c55e" />
              </div>
            )}

            {(expandedPlate === plate ? recs : recs.slice(0, 2)).map((rec) => (
              <div key={rec.id} style={S.recRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.recDate}>{new Date(rec.created_at).toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
                  <div style={S.recTags}>
                    {rec.shock_model && <span style={S.tag}>{rec.shock_model}</span>}
                    {rec.fork_type && <span style={S.tag}>{FORK_OPTS.find((o) => o.value === rec.fork_type)?.label}</span>}
                    {rec.spring_rate_front && <span style={S.tag}>前{rec.spring_rate_front}kg</span>}
                    {rec.technician && <span style={S.tag}>🔧 {rec.technician}</span>}
                  </div>
                  {rec.issue_description && <div style={S.recIssue}>{rec.issue_description.slice(0, 80)}{rec.issue_description.length > 80 ? "..." : ""}</div>}
                </div>
                <div style={S.recActions}>
                  <button onClick={() => { setSelected(rec); setPage("detail"); }} style={S.actBtn} title="詳情">📋</button>
                  <button onClick={() => handleCopy(rec)} style={S.actBtn} title="複製">📝</button>
                  <button onClick={() => { if (!compareA) setCompareA(rec); else if (!compareB) setCompareB(rec); }}
                    style={{ ...S.actBtn, ...(compareA?.id === rec.id || compareB?.id === rec.id ? S.actOn : {}) }} title="比較">🔀</button>
                  <button onClick={() => exportReport(rec)} style={S.actBtn} title="匯出報告">📤</button>
                  <button onClick={() => setDelConfirm(rec.id)} style={{ ...S.actBtn, ...S.actDel }} title="刪除">🗑</button>
                </div>
              </div>
            ))}
            {expandedPlate !== plate && recs.length > 2 && (
              <div style={{ padding: "8px 16px", textAlign: "center" }}>
                <button onClick={() => setExpandedPlate(plate)} style={S.showMore}>展開其餘 {recs.length - 2} 筆 ▼</button>
              </div>
            )}
          </div>
        ))}

        {/* 刪除確認 */}
        {delConfirm && (
          <div style={S.overlay}>
            <div style={S.modal}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#ef4444" }}>⚠ 確定刪除這筆紀錄？</div>
              <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>此操作無法復原</div>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setDelConfirm(null)} style={S.cancelBtn}>取消</button>
                <button onClick={() => handleDelete(delConfirm)} style={S.delBtn}>確定刪除</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── DETAIL ───
  const renderDetail = () => {
    if (!selected) return null;
    const r = selected;
    const sameRecs = records.filter((x) => x.license_plate === r.license_plate);
    return (
      <div style={S.page}>
        <button onClick={() => setPage("history")} style={S.backBtn}>← 返回列表</button>
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <h3 style={S.secTitle}>{r.license_plate} — {r.customer_name}</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => exportReport(r)} style={S.exportBtn}>📤 匯出報告</button>
              <span style={{ color: "#64748b", fontSize: 13, lineHeight: "32px" }}>{new Date(r.created_at).toLocaleString("zh-TW")}</span>
            </div>
          </div>
          <div style={{ color: "#94a3b8", marginBottom: 16 }}>
            {r.car_model} · {r.shock_model} · {FORK_OPTS.find((o) => o.value === r.fork_type)?.label || r.fork_type}
            {r.technician && ` · 技師: ${r.technician}`}
          </div>
          <SuspensionSim params={r} />
        </div>
        <div style={S.card}>
          <h3 style={S.secTitle}>參數總覽</h3>
          <div style={S.paramGrid}>
            {[["彈簧（前）", r.spring_rate_front, "kg/mm"], ["彈簧（後）", r.spring_rate_rear, "kg/mm"],
              ["車高", r.ride_height_fingers, "指"], ["胎壓（前）", r.tire_pressure_front, "PSI"],
              ["胎壓（後）", r.tire_pressure_rear, "PSI"], ["伸側阻尼（前）", r.damping_rebound_front, "段"],
              ["伸側阻尼（後）", r.damping_rebound_rear, "段"], ["壓側阻尼（前）", r.damping_compression_front, "段"],
              ["壓側阻尼（後）", r.damping_compression_rear, "段"], ["預載（前）", r.preload_front, "mm"],
              ["預載（後）", r.preload_rear, "mm"], ["外傾角（前）", r.camber_front, "°"],
              ["外傾角（後）", r.camber_rear, "°"], ["束角（前）", r.toe_front, "°"],
              ["束角（後）", r.toe_rear, "°"],
            ].map(([l, v, u]) => <ParamItem key={l} label={l} value={v} unit={u} />)}
          </div>
        </div>
        {r.issue_description && <div style={S.card}><h3 style={S.secTitle}>車主反映問題</h3><p style={S.descText}>{r.issue_description}</p></div>}
        {r.adjustment_notes && <div style={S.card}><h3 style={S.secTitle}>調整備註</h3><p style={S.descText}>{r.adjustment_notes}</p></div>}

        {sameRecs.length >= 2 && (
          <div style={S.card}>
            <h3 style={S.secTitle}>📈 該車歷次調校趨勢</h3>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Sparkline records={sameRecs} field="spring_rate_front" label="彈簧(前)" unit="kg" color="#f59e0b" />
              <Sparkline records={sameRecs} field="damping_rebound_front" label="伸側阻尼(前)" unit="段" color="#3b82f6" />
              <Sparkline records={sameRecs} field="damping_compression_front" label="壓側阻尼(前)" unit="段" color="#8b5cf6" />
              <Sparkline records={sameRecs} field="preload_front" label="預載(前)" unit="mm" color="#22c55e" />
            </div>
          </div>
        )}

        <button onClick={() => handleCopy(r)} style={S.saveBtn}>📝 以此紀錄為基底新增調校</button>
      </div>
    );
  };

  return (
    <div style={S.app}>
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.logo}><span style={{ fontSize: 28 }}>⚡</span><div><div style={S.logoT}>SUSPENSION</div><div style={S.logoS}>TUNING SYSTEM</div></div></div>
          {!DB_OK && <div style={S.demo}>DEMO — 請至 Netlify 設定環境變數</div>}
        </div>
      </header>
      <nav style={S.nav}>
        {[{ id: "form", icon: "🔧", text: "新增調校" }, { id: "history", icon: "📋", text: "歷史紀錄" }].map((t) => (
          <button key={t.id} onClick={() => setPage(t.id)}
            style={{ ...S.navBtn, ...(page === t.id || (page === "detail" && t.id === "history") ? S.navOn : {}) }}>
            <span>{t.icon}</span> {t.text}
            {t.id === "history" && records.length > 0 && <span style={S.badge}>{records.length}</span>}
          </button>
        ))}
      </nav>
      <main style={{ paddingBottom: 80 }}>
        {page === "form" && renderForm()}
        {page === "history" && renderHistory()}
        {page === "detail" && renderDetail()}
      </main>
      {toast && <div style={{ ...S.toast, borderColor: toast.type === "error" ? "#ef4444" : "#22c55e", color: toast.type === "error" ? "#fca5a5" : "#86efac" }}>{toast.msg}</div>}
    </div>
  );
}

// ═══════════════════════════════════════
//  Styles
// ═══════════════════════════════════════
const S = {
  app: { fontFamily: "'Noto Sans TC','JetBrains Mono',-apple-system,sans-serif", background: "#0b0f1a", color: "#e2e8f0", minHeight: "100vh", maxWidth: 720, margin: "0 auto" },
  header: { background: "linear-gradient(135deg,#0f172a,#1a1a2e)", borderBottom: "1px solid #f59e0b33", padding: "14px 20px", position: "sticky", top: 0, zIndex: 100 },
  headerInner: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
  logo: { display: "flex", alignItems: "center", gap: 10 },
  logoT: { fontSize: 18, fontWeight: 900, letterSpacing: 3, color: "#f59e0b", lineHeight: 1.1 },
  logoS: { fontSize: 9, letterSpacing: 5, color: "#64748b", fontWeight: 600 },
  demo: { background: "#f59e0b22", color: "#f59e0b", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600 },
  nav: { display: "flex", background: "#0f172a", borderBottom: "1px solid #1e293b", position: "sticky", top: 56, zIndex: 99 },
  navBtn: { flex: 1, padding: "12px 16px", background: "transparent", border: "none", borderBottom: "2px solid transparent", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 },
  navOn: { color: "#f59e0b", borderBottomColor: "#f59e0b", background: "#f59e0b08" },
  badge: { background: "#f59e0b", color: "#0f172a", padding: "1px 7px", borderRadius: 10, fontSize: 11, fontWeight: 700, marginLeft: 4 },
  page: { padding: 16 },
  card: { background: "#111827", border: "1px solid #1e293b", borderRadius: 12, padding: 20, marginBottom: 16 },
  secTitle: { color: "#f59e0b", fontSize: 15, fontWeight: 700, marginBottom: 16, marginTop: 0 },
  secDesc: { color: "#475569", fontSize: 12, margin: "-8px 0 16px 0" },
  row: { display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" },
  label: { display: "block", color: "#94a3b8", fontSize: 12, fontWeight: 600, marginBottom: 4 },
  req: { color: "#ef4444", marginLeft: 3, fontWeight: 700 },
  inputWrap: { display: "flex", alignItems: "center", gap: 0, position: "relative" },
  input: { width: "100%", padding: "10px 12px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, color: "#e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" },
  inputNum: { textAlign: "center", paddingLeft: 36, paddingRight: 50 },
  inputErr: { borderColor: "#ef4444", background: "#1a0808" },
  errText: { color: "#f87171", fontSize: 11, marginTop: 3 },
  unit: { position: "absolute", right: 38, top: "50%", transform: "translateY(-50%)", color: "#475569", fontSize: 11, fontWeight: 600, pointerEvents: "none" },
  stepBtn: {
    width: 32, height: 38, background: "#1e293b", border: "1px solid #334155", color: "#f59e0b",
    fontSize: 18, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: 6, flexShrink: 0, lineHeight: 1, userSelect: "none",
  },
  textarea: { width: "100%", padding: "10px 12px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, color: "#e2e8f0", fontSize: 14, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" },
  chipRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  chip: { padding: "6px 14px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 20, color: "#94a3b8", fontSize: 13, cursor: "pointer" },
  chipOn: { background: "#f59e0b22", borderColor: "#f59e0b", color: "#f59e0b" },
  errBanner: { background: "#ef444418", border: "1px solid #ef444466", borderRadius: 10, padding: "12px 16px", color: "#fca5a5", fontSize: 13, fontWeight: 600, marginBottom: 12, lineHeight: 1.5 },
  saveBtn: { width: "100%", padding: "14px", background: "linear-gradient(135deg,#f59e0b,#d97706)", border: "none", borderRadius: 10, color: "#0f172a", fontSize: 16, fontWeight: 700, cursor: "pointer", letterSpacing: 1, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
  missBadge: { background: "#0f172a44", padding: "2px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600 },
  bumpBtn: { position: "absolute", bottom: 12, right: 12, padding: "8px 16px", background: "linear-gradient(135deg,#f59e0b,#d97706)", border: "none", borderRadius: 8, color: "#0f172a", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 12px #f59e0b44" },
  toggleBtn: { background: "transparent", border: "1px solid #1e293b", borderRadius: 6, color: "#64748b", padding: "4px 12px", fontSize: 12, cursor: "pointer" },
  presetBtn: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "10px 16px", cursor: "pointer", color: "#e2e8f0", textAlign: "left", minWidth: 160, transition: "border-color 0.2s" },
  exportBtn: { background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#e2e8f0", padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  // Stats
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16 },
  statCard: { background: "#111827", border: "1px solid #1e293b", borderRadius: 10, padding: "12px 8px", textAlign: "center" },
  // History
  searchBox: { position: "relative", marginBottom: 16 },
  searchIcon: { position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16 },
  searchInput: { width: "100%", padding: "12px 40px", background: "#111827", border: "1px solid #1e293b", borderRadius: 10, color: "#e2e8f0", fontSize: 14, outline: "none", boxSizing: "border-box" },
  clearBtn: { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 16 },
  compareBar: { background: "#111827", border: "1px solid #f59e0b33", borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13 },
  compareTrigger: { padding: "6px 14px", background: "#f59e0b", border: "none", borderRadius: 6, color: "#0f172a", fontWeight: 700, fontSize: 12, cursor: "pointer" },
  cancelBtn: { padding: "6px 14px", background: "transparent", border: "1px solid #475569", borderRadius: 6, color: "#94a3b8", fontSize: 12, cursor: "pointer" },
  plateGroup: { background: "#111827", border: "1px solid #1e293b", borderRadius: 12, marginBottom: 12, overflow: "hidden" },
  plateHead: { padding: "12px 16px", background: "#0f172a", borderBottom: "1px solid #1e293b", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", cursor: "pointer" },
  plateBadge: { background: "#f59e0b", color: "#0f172a", padding: "3px 12px", borderRadius: 6, fontSize: 14, fontWeight: 800, fontFamily: "'JetBrains Mono'", letterSpacing: 1 },
  plateInfo: { color: "#64748b", fontSize: 13 },
  recRow: { padding: "12px 16px", borderBottom: "1px solid #1e293b22", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  recDate: { color: "#94a3b8", fontSize: 12, fontFamily: "'JetBrains Mono'", marginBottom: 4 },
  recTags: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 },
  tag: { background: "#1e293b", color: "#94a3b8", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 },
  recIssue: { color: "#475569", fontSize: 12, marginTop: 4 },
  recActions: { display: "flex", gap: 4, flexShrink: 0, flexWrap: "wrap" },
  actBtn: { padding: "6px 8px", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 6, cursor: "pointer", fontSize: 14 },
  actOn: { background: "#f59e0b33", borderColor: "#f59e0b" },
  actDel: { borderColor: "#ef444433" },
  showMore: { background: "transparent", border: "none", color: "#f59e0b", fontSize: 12, cursor: "pointer", fontWeight: 600 },
  empty: { textAlign: "center", color: "#475569", padding: "60px 20px", fontSize: 14 },
  backBtn: { background: "none", border: "none", color: "#f59e0b", fontSize: 14, cursor: "pointer", padding: "0 0 12px 0", fontWeight: 600 },
  paramGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 8 },
  paramItem: { background: "#0f172a", borderRadius: 8, padding: "10px 12px" },
  paramLabel: { color: "#475569", fontSize: 11, marginBottom: 4 },
  paramValue: { color: "#e2e8f0", fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono'" },
  paramUnit: { color: "#475569", fontSize: 11, fontWeight: 400, marginLeft: 4 },
  descText: { color: "#cbd5e1", fontSize: 14, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" },
  toast: { position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#111827", border: "1px solid", borderRadius: 10, padding: "10px 24px", fontSize: 14, fontWeight: 600, zIndex: 999, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", whiteSpace: "nowrap" },
  // Modal
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#00000088", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" },
  modal: { background: "#111827", border: "1px solid #1e293b", borderRadius: 16, padding: 28, maxWidth: 340, width: "90%", textAlign: "center" },
  delBtn: { padding: "8px 20px", background: "#ef4444", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" },
};
