import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONFIG: 從 Netlify 環境變數讀取，不寫死在程式碼裡 ───
// Netlify Dashboard → Site settings → Environment variables 設定：
//   VITE_SUPABASE_URL = https://你的專案.supabase.co
//   VITE_SUPABASE_ANON_KEY = 你的 anon key
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// ─── Supabase mini client ───
const supabase = {
  from: (table) => ({
    select: async (cols = "*") => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${cols}&order=created_at.desc`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      });
      const data = await res.json();
      return { data, error: res.ok ? null : data };
    },
    insert: async (rows) => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(rows),
      });
      const data = await res.json();
      return { data, error: res.ok ? null : data };
    },
    update: async (row) => ({
      eq: async (col, val) => {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${val}`, {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(row),
        });
        const data = await res.json();
        return { data, error: res.ok ? null : data };
      },
    }),
    delete: () => ({
      eq: async (col, val) => {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${val}`, {
          method: "DELETE",
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        });
        return { error: res.ok ? null : { message: "Delete failed" } };
      },
    }),
    searchByPlate: async (plate) => {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?license_plate=ilike.*${encodeURIComponent(plate)}*&order=created_at.desc`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const data = await res.json();
      return { data, error: res.ok ? null : data };
    },
  }),
};

// ─── Suspension Simulation Canvas ───
function SuspensionSim({ params }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const timeRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const t = timeRef.current;

    const dampingVal = ((Number(params.damping_rebound_front) || 12) + (Number(params.damping_compression_front) || 12)) / 2;
    const springRate = Number(params.spring_rate_front) || 6;
    const preload = Number(params.preload_front) || 5;
    const rideHeight = Number(params.ride_height_fingers) || 3;

    const dampingFactor = Math.max(0.02, 0.15 - dampingVal * 0.005);
    const frequency = 1.5 + springRate * 0.15;
    const amplitude = Math.max(2, 28 - preload * 1.2 - dampingVal * 0.5);
    const baseY = H * 0.38 + (5 - rideHeight) * 8;

    ctx.clearRect(0, 0, W, H);

    // Road
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, W, H);

    // Road surface with bumps
    ctx.strokeStyle = "#2a2a4a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const roadY = H * 0.82;
    for (let x = 0; x < W; x++) {
      const bump = Math.sin((x + t * 60) * 0.04) * 4 + Math.sin((x + t * 60) * 0.09) * 2;
      ctx.lineTo(x, roadY + bump);
    }
    ctx.stroke();

    // Road fill
    ctx.fillStyle = "#111128";
    ctx.beginPath();
    ctx.moveTo(0, roadY);
    for (let x = 0; x < W; x++) {
      const bump = Math.sin((x + t * 60) * 0.04) * 4 + Math.sin((x + t * 60) * 0.09) * 2;
      ctx.lineTo(x, roadY + bump);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();

    // Road markings
    ctx.strokeStyle = "#f59e0b33";
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 30]);
    ctx.beginPath();
    ctx.moveTo(0, roadY + 10);
    ctx.lineTo(W, roadY + 10);
    ctx.stroke();
    ctx.setLineDash([]);

    // Suspension oscillation
    const bumpInput = Math.sin(t * 3) * 0.7 + Math.sin(t * 7) * 0.3;
    const bodyOsc = amplitude * Math.sin(t * frequency * 2) * Math.exp(-dampingFactor * (t % 6) * 2) * bumpInput;
    const wheelOsc = amplitude * 0.4 * Math.sin(t * frequency * 4) * bumpInput;

    const carCenterX = W * 0.5;
    const carBodyY = baseY + bodyOsc;
    const wheelY = roadY - 18 + wheelOsc * 0.3;

    // ── Draw suspension struts ──
    const drawStrut = (x) => {
      const topY = carBodyY + 40;
      const botY = wheelY - 8;
      const mid = (topY + botY) / 2;

      // Damper body
      ctx.strokeStyle = "#64748b";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, mid - 5);
      ctx.stroke();

      // Damper rod
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, mid + 5);
      ctx.lineTo(x, botY);
      ctx.stroke();

      // Spring coils
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const coils = 6;
      const springW = 14;
      const springLen = botY - topY;
      for (let i = 0; i <= coils * 2; i++) {
        const py = topY + (springLen * i) / (coils * 2);
        const px = x + (i % 2 === 0 ? -springW : springW);
        if (i === 0) ctx.moveTo(x, py);
        else ctx.lineTo(px, py);
      }
      ctx.lineTo(x, botY);
      ctx.stroke();
    };

    // Front strut
    drawStrut(carCenterX + 75);
    // Rear strut
    drawStrut(carCenterX - 75);

    // ── Car body ──
    ctx.fillStyle = "#1e293b";
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;

    // Main body
    ctx.beginPath();
    ctx.moveTo(carCenterX - 110, carBodyY + 30);
    ctx.lineTo(carCenterX - 100, carBodyY + 5);
    ctx.lineTo(carCenterX - 60, carBodyY - 20);
    ctx.lineTo(carCenterX - 30, carBodyY - 40);
    ctx.lineTo(carCenterX + 40, carBodyY - 40);
    ctx.lineTo(carCenterX + 70, carBodyY - 20);
    ctx.lineTo(carCenterX + 110, carBodyY + 5);
    ctx.lineTo(carCenterX + 115, carBodyY + 30);
    ctx.lineTo(carCenterX + 110, carBodyY + 42);
    ctx.lineTo(carCenterX - 105, carBodyY + 42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Windows
    ctx.fillStyle = "#0ea5e922";
    ctx.strokeStyle = "#0ea5e944";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(carCenterX - 55, carBodyY - 16);
    ctx.lineTo(carCenterX - 28, carBodyY - 36);
    ctx.lineTo(carCenterX + 35, carBodyY - 36);
    ctx.lineTo(carCenterX + 62, carBodyY - 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Headlights
    ctx.fillStyle = "#fbbf24";
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(carCenterX + 108, carBodyY + 15, 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Taillights
    ctx.fillStyle = "#ef4444";
    ctx.shadowColor = "#ef4444";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(carCenterX - 103, carBodyY + 15, 4, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // ── Wheels ──
    const drawWheel = (x) => {
      ctx.fillStyle = "#0f172a";
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, wheelY, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Tire
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(x, wheelY, 15, 0, Math.PI * 2);
      ctx.stroke();

      // Hub
      ctx.fillStyle = "#64748b";
      ctx.beginPath();
      ctx.arc(x, wheelY, 5, 0, Math.PI * 2);
      ctx.fill();

      // Spokes rotation
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5 + t * 3;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(angle) * 5, wheelY + Math.sin(angle) * 5);
        ctx.lineTo(x + Math.cos(angle) * 13, wheelY + Math.sin(angle) * 13);
        ctx.stroke();
      }
    };

    drawWheel(carCenterX - 75, wheelY);
    drawWheel(carCenterX + 75, wheelY);

    // ── Oscillation indicator ──
    const oscMagnitude = Math.abs(bodyOsc);
    const oscColor = oscMagnitude > 15 ? "#ef4444" : oscMagnitude > 8 ? "#f59e0b" : "#22c55e";
    ctx.fillStyle = oscColor;
    ctx.font = "bold 13px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(`晃動幅度: ${oscMagnitude.toFixed(1)}mm`, 12, 25);

    // Oscillation bar
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(12, 32, 120, 8);
    ctx.fillStyle = oscColor;
    ctx.fillRect(12, 32, Math.min(120, oscMagnitude * 4.5), 8);

    // Status text
    const status = oscMagnitude > 15 ? "過度晃動 ⚠️" : oscMagnitude > 8 ? "偏軟需調整" : "穩定 ✓";
    ctx.fillStyle = oscColor;
    ctx.fillText(status, 12, 58);

    // Parameters display
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillText(`彈簧: ${springRate}kg | 阻尼: ${dampingVal} | 預載: ${preload}`, W - 12, 25);
    ctx.fillText(`車高: ${rideHeight}指 | 頻率: ${frequency.toFixed(1)}Hz`, W - 12, 42);

    timeRef.current += 0.025;
    animRef.current = requestAnimationFrame(draw);
  }, [params]);

  useEffect(() => {
    timeRef.current = 0;
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={560}
      height={300}
      style={{
        width: "100%",
        maxWidth: 560,
        height: "auto",
        borderRadius: 12,
        border: "1px solid #1e293b",
      }}
    />
  );
}

// ─── Comparison Simulation ───
function ComparisonSim({ before, after }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const timeRef = useRef(0);

  const getOscParams = (p) => {
    const dampingVal = ((Number(p.damping_rebound_front) || 12) + (Number(p.damping_compression_front) || 12)) / 2;
    const springRate = Number(p.spring_rate_front) || 6;
    const preload = Number(p.preload_front) || 5;
    return {
      dampingFactor: Math.max(0.02, 0.15 - dampingVal * 0.005),
      frequency: 1.5 + springRate * 0.15,
      amplitude: Math.max(2, 28 - preload * 1.2 - dampingVal * 0.5),
    };
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const t = timeRef.current;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, W, H);

    // Draw two waveforms
    const configs = [
      { params: getOscParams(before), color: "#ef4444", label: "調整前", y: H * 0.3 },
      { params: getOscParams(after), color: "#22c55e", label: "調整後", y: H * 0.7 },
    ];

    configs.forEach(({ params: p, color, label, y }) => {
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let x = 0; x < W; x++) {
        const xt = (x / W) * 8;
        const bumpInput = Math.sin(xt * 3) * 0.7 + Math.sin(xt * 7) * 0.3;
        const osc = p.amplitude * Math.sin(xt * p.frequency * 2) * Math.exp(-p.dampingFactor * (xt % 6) * 2) * bumpInput;
        if (x === 0) ctx.moveTo(x, y + osc);
        else ctx.lineTo(x, y + osc);
      }
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = "bold 13px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(label, 10, y - H * 0.15);

      ctx.fillStyle = "#64748b";
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.fillText(`振幅: ${p.amplitude.toFixed(1)}mm  頻率: ${p.frequency.toFixed(1)}Hz`, 10, y - H * 0.15 + 18);
    });

    // Animated playhead
    const playX = ((t * 40) % W);
    ctx.strokeStyle = "#f59e0b44";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(playX, 0);
    ctx.lineTo(playX, H);
    ctx.stroke();

    timeRef.current += 0.025;
    animRef.current = requestAnimationFrame(draw);
  }, [before, after]);

  useEffect(() => {
    timeRef.current = 0;
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={560}
      height={240}
      style={{ width: "100%", maxWidth: 560, height: "auto", borderRadius: 12, border: "1px solid #1e293b" }}
    />
  );
}

// ─── Main App ───
const EMPTY_FORM = {
  license_plate: "",
  customer_name: "",
  car_model: "",
  shock_model: "",
  fork_type: "inverted",
  spring_rate_front: "",
  spring_rate_rear: "",
  ride_height_fingers: "",
  tire_pressure_front: "",
  tire_pressure_rear: "",
  damping_rebound_front: "",
  damping_rebound_rear: "",
  damping_compression_front: "",
  damping_compression_rear: "",
  preload_front: "",
  preload_rear: "",
  camber_front: "",
  camber_rear: "",
  toe_front: "",
  toe_rear: "",
  issue_description: "",
  adjustment_notes: "",
  technician: "",
};

const FORK_OPTIONS = [
  { value: "inverted", label: "倒叉" },
  { value: "conventional", label: "正叉" },
  { value: "macpherson", label: "麥花臣" },
  { value: "double_wishbone", label: "雙A臂" },
  { value: "multi_link", label: "多連桿" },
  { value: "other", label: "其他" },
];

export default function App() {
  const [page, setPage] = useState("form"); // form | history | detail
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [records, setRecords] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [compareA, setCompareA] = useState(null);
  const [compareB, setCompareB] = useState(null);
  const [showCompare, setShowCompare] = useState(false);
  const [dbReady, setDbReady] = useState(true);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Check if Supabase is configured
  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setDbReady(false);
    }
  }, []);

  const fetchRecords = async () => {
    if (!dbReady) return;
    setLoading(true);
    const { data, error } = await supabase.from("suspension_records").select();
    if (!error && data) {
      setRecords(data);
      setFiltered(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRecords();
  }, [dbReady]);

  const handleSearch = async (val) => {
    setSearch(val);
    if (!val.trim()) {
      setFiltered(records);
      return;
    }
    const q = val.toLowerCase();
    const result = records.filter(
      (r) =>
        r.license_plate?.toLowerCase().includes(q) ||
        r.customer_name?.toLowerCase().includes(q) ||
        r.car_model?.toLowerCase().includes(q)
    );
    setFiltered(result);
  };

  const handleSave = async () => {
    if (!form.license_plate || !form.customer_name) {
      showToast("請填寫車牌與姓名", "error");
      return;
    }
    setSaving(true);
    const payload = { ...form, created_at: new Date().toISOString() };

    if (!dbReady) {
      // Demo mode - local only
      const fakeId = Date.now();
      const newRec = { ...payload, id: fakeId };
      setRecords((prev) => [newRec, ...prev]);
      setFiltered((prev) => [newRec, ...prev]);
      setForm({ ...EMPTY_FORM });
      showToast("已儲存（本地模式）");
      setSaving(false);
      return;
    }

    const { data, error } = await supabase.from("suspension_records").insert([payload]);
    if (error) {
      showToast("儲存失敗: " + JSON.stringify(error), "error");
    } else {
      showToast("紀錄已儲存！");
      setForm({ ...EMPTY_FORM });
      fetchRecords();
    }
    setSaving(false);
  };

  const handleLoadRecord = (rec) => {
    setSelectedRecord(rec);
    setPage("detail");
  };

  const handleCopyToForm = (rec) => {
    const { id, created_at, ...rest } = rec;
    setForm(rest);
    setPage("form");
    showToast("已載入紀錄到表單");
  };

  const set = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const InputField = ({ label, field, type = "text", unit, placeholder, half }) => (
    <div style={{ flex: half ? "1 1 45%" : "1 1 100%", minWidth: half ? 140 : 200 }}>
      <label style={styles.label}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={type}
          value={form[field]}
          onChange={(e) => set(field, e.target.value)}
          placeholder={placeholder || label}
          style={styles.input}
        />
        {unit && <span style={styles.unit}>{unit}</span>}
      </div>
    </div>
  );

  // ─── Form Page ───
  const FormPage = () => (
    <div style={styles.pageInner}>
      <div style={styles.simContainer}>
        <h3 style={styles.simTitle}>⚡ 即時懸吊模擬</h3>
        <p style={styles.simDesc}>根據你輸入的參數即時呈現避震反應</p>
        <SuspensionSim params={form} />
      </div>

      <div style={styles.formCard}>
        <h3 style={styles.sectionTitle}>🚗 基本資料</h3>
        <div style={styles.fieldRow}>
          <InputField label="車牌號碼" field="license_plate" placeholder="ABC-1234" half />
          <InputField label="車主姓名" field="customer_name" placeholder="王大明" half />
        </div>
        <div style={styles.fieldRow}>
          <InputField label="車型" field="car_model" placeholder="MG HS 1.5T" half />
          <InputField label="避震型號" field="shock_model" placeholder="BC BR / KW V3..." half />
        </div>
        <div style={{ flex: "1 1 100%", minWidth: 200, marginBottom: 12 }}>
          <label style={styles.label}>懸吊型式</label>
          <div style={styles.chipRow}>
            {FORK_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => set("fork_type", opt.value)}
                style={{
                  ...styles.chip,
                  ...(form.fork_type === opt.value ? styles.chipActive : {}),
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div style={styles.fieldRow}>
          <InputField label="技師" field="technician" placeholder="技師名稱" />
        </div>
      </div>

      <div style={styles.formCard}>
        <h3 style={styles.sectionTitle}>🔧 彈簧與車高</h3>
        <div style={styles.fieldRow}>
          <InputField label="彈簧磅數（前）" field="spring_rate_front" type="number" unit="kg/mm" half />
          <InputField label="彈簧磅數（後）" field="spring_rate_rear" type="number" unit="kg/mm" half />
        </div>
        <div style={styles.fieldRow}>
          <InputField label="車高（剩餘指數）" field="ride_height_fingers" type="number" unit="指" half />
          <InputField label="胎壓（前）" field="tire_pressure_front" type="number" unit="PSI" half />
        </div>
        <div style={styles.fieldRow}>
          <InputField label="胎壓（後）" field="tire_pressure_rear" type="number" unit="PSI" half />
        </div>
      </div>

      <div style={styles.formCard}>
        <h3 style={styles.sectionTitle}>⚙️ 阻尼設定</h3>
        <div style={styles.fieldRow}>
          <InputField label="伸側阻尼（前）" field="damping_rebound_front" type="number" unit="段" half />
          <InputField label="伸側阻尼（後）" field="damping_rebound_rear" type="number" unit="段" half />
        </div>
        <div style={styles.fieldRow}>
          <InputField label="壓側阻尼（前）" field="damping_compression_front" type="number" unit="段" half />
          <InputField label="壓側阻尼（後）" field="damping_compression_rear" type="number" unit="段" half />
        </div>
        <div style={styles.fieldRow}>
          <InputField label="預載（前）" field="preload_front" type="number" unit="mm" half />
          <InputField label="預載（後）" field="preload_rear" type="number" unit="mm" half />
        </div>
      </div>

      <div style={styles.formCard}>
        <h3 style={styles.sectionTitle}>📐 定位角度</h3>
        <div style={styles.fieldRow}>
          <InputField label="外傾角（前）" field="camber_front" type="number" unit="°" half />
          <InputField label="外傾角（後）" field="camber_rear" type="number" unit="°" half />
        </div>
        <div style={styles.fieldRow}>
          <InputField label="束角（前）" field="toe_front" type="number" unit="°" half />
          <InputField label="束角（後）" field="toe_rear" type="number" unit="°" half />
        </div>
      </div>

      <div style={styles.formCard}>
        <h3 style={styles.sectionTitle}>📝 問題描述與備註</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={styles.label}>車主反映問題</label>
          <textarea
            value={form.issue_description}
            onChange={(e) => set("issue_description", e.target.value)}
            placeholder="例：路面不平時搖晃次數多、快速回彈、觸發晃動搖超過2-3下..."
            style={styles.textarea}
            rows={3}
          />
        </div>
        <div>
          <label style={styles.label}>調整備註</label>
          <textarea
            value={form.adjustment_notes}
            onChange={(e) => set("adjustment_notes", e.target.value)}
            placeholder="調整內容、建議、後續追蹤事項..."
            style={styles.textarea}
            rows={3}
          />
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} style={styles.saveBtn}>
        {saving ? "儲存中..." : "💾 儲存紀錄"}
      </button>
    </div>
  );

  // ─── History Page ───
  const HistoryPage = () => {
    const plateGroups = {};
    filtered.forEach((r) => {
      const plate = r.license_plate || "未知";
      if (!plateGroups[plate]) plateGroups[plate] = [];
      plateGroups[plate].push(r);
    });

    return (
      <div style={styles.pageInner}>
        <div style={styles.searchBox}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜尋車牌、姓名、車型..."
            style={styles.searchInput}
          />
          {search && (
            <button onClick={() => handleSearch("")} style={styles.clearBtn}>
              ✕
            </button>
          )}
        </div>

        {/* Compare mode */}
        {(compareA || compareB) && (
          <div style={styles.compareBar}>
            <span style={{ color: "#94a3b8" }}>
              比較模式: {compareA ? `A: ${compareA.license_plate}` : "選擇 A"} {" ↔ "}
              {compareB ? `B: ${compareB.license_plate}` : "選擇 B"}
            </span>
            {compareA && compareB && (
              <button onClick={() => setShowCompare(true)} style={styles.compareBtn}>
                🔀 查看比較
              </button>
            )}
            <button
              onClick={() => {
                setCompareA(null);
                setCompareB(null);
                setShowCompare(false);
              }}
              style={styles.cancelCompareBtn}
            >
              取消
            </button>
          </div>
        )}

        {showCompare && compareA && compareB && (
          <div style={styles.formCard}>
            <h3 style={styles.sectionTitle}>🔀 調整前後比較</h3>
            <ComparisonSim before={compareA} after={compareB} />
            <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ color: "#ef4444", fontWeight: 700, marginBottom: 8 }}>A: {compareA.license_plate} - {new Date(compareA.created_at).toLocaleDateString("zh-TW")}</div>
                <ParamMini rec={compareA} />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ color: "#22c55e", fontWeight: 700, marginBottom: 8 }}>B: {compareB.license_plate} - {new Date(compareB.created_at).toLocaleDateString("zh-TW")}</div>
                <ParamMini rec={compareB} />
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={styles.emptyState}>載入中...</div>
        ) : Object.keys(plateGroups).length === 0 ? (
          <div style={styles.emptyState}>
            {search ? "找不到符合的紀錄" : "尚無紀錄，請先新增調校資料"}
          </div>
        ) : (
          Object.entries(plateGroups).map(([plate, recs]) => (
            <div key={plate} style={styles.plateGroup}>
              <div style={styles.plateHeader}>
                <span style={styles.plateBadge}>{plate}</span>
                <span style={styles.plateInfo}>
                  {recs[0]?.customer_name} · {recs[0]?.car_model} · {recs.length} 筆紀錄
                </span>
              </div>
              {recs.map((rec) => (
                <div key={rec.id} style={styles.recordRow}>
                  <div style={styles.recordLeft}>
                    <div style={styles.recordDate}>
                      {new Date(rec.created_at).toLocaleDateString("zh-TW", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div style={styles.recordMeta}>
                      {rec.shock_model && <span style={styles.tag}>{rec.shock_model}</span>}
                      {rec.fork_type && (
                        <span style={styles.tag}>
                          {FORK_OPTIONS.find((o) => o.value === rec.fork_type)?.label || rec.fork_type}
                        </span>
                      )}
                      {rec.spring_rate_front && <span style={styles.tag}>前{rec.spring_rate_front}kg</span>}
                      {rec.spring_rate_rear && <span style={styles.tag}>後{rec.spring_rate_rear}kg</span>}
                      {rec.technician && <span style={styles.tag}>🔧 {rec.technician}</span>}
                    </div>
                    {rec.issue_description && (
                      <div style={styles.recordIssue}>{rec.issue_description.slice(0, 80)}...</div>
                    )}
                  </div>
                  <div style={styles.recordActions}>
                    <button onClick={() => handleLoadRecord(rec)} style={styles.actionBtn} title="查看詳情">
                      📋
                    </button>
                    <button onClick={() => handleCopyToForm(rec)} style={styles.actionBtn} title="複製到表單">
                      📝
                    </button>
                    <button
                      onClick={() => {
                        if (!compareA) setCompareA(rec);
                        else if (!compareB) setCompareB(rec);
                      }}
                      style={{
                        ...styles.actionBtn,
                        ...(compareA?.id === rec.id || compareB?.id === rec.id ? { background: "#f59e0b33", borderColor: "#f59e0b" } : {}),
                      }}
                      title="加入比較"
                    >
                      🔀
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    );
  };

  // ─── Detail Page ───
  const DetailPage = () => {
    if (!selectedRecord) return null;
    const r = selectedRecord;
    return (
      <div style={styles.pageInner}>
        <button onClick={() => setPage("history")} style={styles.backBtn}>
          ← 返回列表
        </button>

        <div style={styles.formCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <h3 style={styles.sectionTitle}>
              {r.license_plate} — {r.customer_name}
            </h3>
            <span style={{ color: "#64748b", fontSize: 13 }}>
              {new Date(r.created_at).toLocaleString("zh-TW")}
            </span>
          </div>
          <div style={{ color: "#94a3b8", marginBottom: 16 }}>
            {r.car_model} · {r.shock_model} · {FORK_OPTIONS.find((o) => o.value === r.fork_type)?.label || r.fork_type}
            {r.technician && ` · 技師: ${r.technician}`}
          </div>

          <SuspensionSim params={r} />
        </div>

        <div style={styles.formCard}>
          <h3 style={styles.sectionTitle}>參數總覽</h3>
          <div style={styles.paramGrid}>
            <ParamItem label="彈簧（前）" value={r.spring_rate_front} unit="kg/mm" />
            <ParamItem label="彈簧（後）" value={r.spring_rate_rear} unit="kg/mm" />
            <ParamItem label="車高" value={r.ride_height_fingers} unit="指" />
            <ParamItem label="胎壓（前）" value={r.tire_pressure_front} unit="PSI" />
            <ParamItem label="胎壓（後）" value={r.tire_pressure_rear} unit="PSI" />
            <ParamItem label="伸側阻尼（前）" value={r.damping_rebound_front} unit="段" />
            <ParamItem label="伸側阻尼（後）" value={r.damping_rebound_rear} unit="段" />
            <ParamItem label="壓側阻尼（前）" value={r.damping_compression_front} unit="段" />
            <ParamItem label="壓側阻尼（後）" value={r.damping_compression_rear} unit="段" />
            <ParamItem label="預載（前）" value={r.preload_front} unit="mm" />
            <ParamItem label="預載（後）" value={r.preload_rear} unit="mm" />
            <ParamItem label="外傾角（前）" value={r.camber_front} unit="°" />
            <ParamItem label="外傾角（後）" value={r.camber_rear} unit="°" />
            <ParamItem label="束角（前）" value={r.toe_front} unit="°" />
            <ParamItem label="束角（後）" value={r.toe_rear} unit="°" />
          </div>
        </div>

        {r.issue_description && (
          <div style={styles.formCard}>
            <h3 style={styles.sectionTitle}>車主反映問題</h3>
            <p style={styles.descText}>{r.issue_description}</p>
          </div>
        )}

        {r.adjustment_notes && (
          <div style={styles.formCard}>
            <h3 style={styles.sectionTitle}>調整備註</h3>
            <p style={styles.descText}>{r.adjustment_notes}</p>
          </div>
        )}

        <button onClick={() => handleCopyToForm(r)} style={styles.saveBtn}>
          📝 以此紀錄為基底新增調校
        </button>
      </div>
    );
  };

  return (
    <div style={styles.appContainer}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>⚡</span>
            <div>
              <div style={styles.logoText}>SUSPENSION</div>
              <div style={styles.logoSub}>TUNING SYSTEM</div>
            </div>
          </div>
          {!dbReady && (
            <div style={styles.demoBadge}>DEMO 模式 — 請至 Netlify 設定環境變數</div>
          )}
        </div>
      </header>

      {/* Nav */}
      <nav style={styles.nav}>
        {[
          { id: "form", label: "新增調校", icon: "🔧" },
          { id: "history", label: "歷史紀錄", icon: "📋" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setPage(tab.id)}
            style={{
              ...styles.navBtn,
              ...(page === tab.id || (page === "detail" && tab.id === "history")
                ? styles.navBtnActive
                : {}),
            }}
          >
            <span>{tab.icon}</span> {tab.label}
            {tab.id === "history" && records.length > 0 && (
              <span style={styles.badge}>{records.length}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main style={styles.main}>
        {page === "form" && <FormPage />}
        {page === "history" && <HistoryPage />}
        {page === "detail" && <DetailPage />}
      </main>

      {/* Toast */}
      {toast && (
        <div
          style={{
            ...styles.toast,
            borderColor: toast.type === "error" ? "#ef4444" : "#22c55e",
            color: toast.type === "error" ? "#fca5a5" : "#86efac",
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function ParamItem({ label, value, unit }) {
  return (
    <div style={styles.paramItem}>
      <div style={styles.paramLabel}>{label}</div>
      <div style={styles.paramValue}>
        {value || "—"}
        {value && unit && <span style={styles.paramUnit}>{unit}</span>}
      </div>
    </div>
  );
}

function ParamMini({ rec }) {
  const items = [
    ["彈簧前/後", `${rec.spring_rate_front || "—"}/${rec.spring_rate_rear || "—"} kg`],
    ["伸側阻尼前/後", `${rec.damping_rebound_front || "—"}/${rec.damping_rebound_rear || "—"}`],
    ["壓側阻尼前/後", `${rec.damping_compression_front || "—"}/${rec.damping_compression_rear || "—"}`],
    ["預載前/後", `${rec.preload_front || "—"}/${rec.preload_rear || "—"} mm`],
    ["車高", `${rec.ride_height_fingers || "—"} 指`],
  ];
  return (
    <div style={{ fontSize: 12, color: "#94a3b8" }}>
      {items.map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #1e293b" }}>
          <span>{k}</span>
          <span style={{ color: "#e2e8f0" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Styles ───
const styles = {
  appContainer: {
    fontFamily: "'Noto Sans TC', 'JetBrains Mono', -apple-system, sans-serif",
    background: "#0b0f1a",
    color: "#e2e8f0",
    minHeight: "100vh",
    maxWidth: 680,
    margin: "0 auto",
  },
  header: {
    background: "linear-gradient(135deg, #0f172a 0%, #1a1a2e 100%)",
    borderBottom: "1px solid #f59e0b33",
    padding: "16px 20px",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  headerInner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: { display: "flex", alignItems: "center", gap: 10 },
  logoIcon: { fontSize: 28 },
  logoText: {
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: 3,
    color: "#f59e0b",
    lineHeight: 1.1,
  },
  logoSub: {
    fontSize: 9,
    letterSpacing: 5,
    color: "#64748b",
    fontWeight: 600,
  },
  demoBadge: {
    background: "#f59e0b22",
    color: "#f59e0b",
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
  },
  nav: {
    display: "flex",
    gap: 0,
    background: "#0f172a",
    borderBottom: "1px solid #1e293b",
    position: "sticky",
    top: 62,
    zIndex: 99,
  },
  navBtn: {
    flex: 1,
    padding: "12px 16px",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "#64748b",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transition: "all 0.2s",
  },
  navBtnActive: {
    color: "#f59e0b",
    borderBottomColor: "#f59e0b",
    background: "#f59e0b08",
  },
  badge: {
    background: "#f59e0b",
    color: "#0f172a",
    padding: "1px 7px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
    marginLeft: 4,
  },
  main: { padding: "0 0 80px 0" },
  pageInner: { padding: "16px" },
  formCard: {
    background: "#111827",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#f59e0b",
    fontSize: 15,
    fontWeight: 700,
    marginBottom: 16,
    marginTop: 0,
    letterSpacing: 0.5,
  },
  fieldRow: {
    display: "flex",
    gap: 12,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  label: {
    display: "block",
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 600,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 8,
    color: "#e2e8f0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  unit: {
    position: "absolute",
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#475569",
    fontSize: 12,
    fontWeight: 600,
    pointerEvents: "none",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 8,
    color: "#e2e8f0",
    fontSize: 14,
    outline: "none",
    resize: "vertical",
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  chipRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    padding: "6px 14px",
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 20,
    color: "#94a3b8",
    fontSize: 13,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  chipActive: {
    background: "#f59e0b22",
    borderColor: "#f59e0b",
    color: "#f59e0b",
  },
  saveBtn: {
    width: "100%",
    padding: "14px",
    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    border: "none",
    borderRadius: 10,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: 1,
    marginTop: 8,
  },
  simContainer: {
    background: "#111827",
    border: "1px solid #1e293b",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    textAlign: "center",
  },
  simTitle: {
    color: "#f59e0b",
    fontSize: 15,
    fontWeight: 700,
    margin: "0 0 4px 0",
  },
  simDesc: {
    color: "#475569",
    fontSize: 12,
    margin: "0 0 16px 0",
  },
  // History
  searchBox: {
    position: "relative",
    marginBottom: 16,
  },
  searchIcon: {
    position: "absolute",
    left: 12,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 16,
  },
  searchInput: {
    width: "100%",
    padding: "12px 40px 12px 40px",
    background: "#111827",
    border: "1px solid #1e293b",
    borderRadius: 10,
    color: "#e2e8f0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  },
  clearBtn: {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    color: "#64748b",
    cursor: "pointer",
    fontSize: 16,
  },
  plateGroup: {
    background: "#111827",
    border: "1px solid #1e293b",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  plateHeader: {
    padding: "12px 16px",
    background: "#0f172a",
    borderBottom: "1px solid #1e293b",
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  plateBadge: {
    background: "#f59e0b",
    color: "#0f172a",
    padding: "3px 12px",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 800,
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: 1,
  },
  plateInfo: {
    color: "#64748b",
    fontSize: 13,
  },
  recordRow: {
    padding: "12px 16px",
    borderBottom: "1px solid #1e293b22",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  recordLeft: { flex: 1, minWidth: 0 },
  recordDate: {
    color: "#94a3b8",
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
    marginBottom: 4,
  },
  recordMeta: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 4,
  },
  tag: {
    background: "#1e293b",
    color: "#94a3b8",
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
  },
  recordIssue: {
    color: "#475569",
    fontSize: 12,
    marginTop: 4,
  },
  recordActions: {
    display: "flex",
    gap: 4,
    flexShrink: 0,
  },
  actionBtn: {
    padding: "6px 8px",
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
    transition: "all 0.2s",
  },
  emptyState: {
    textAlign: "center",
    color: "#475569",
    padding: "60px 20px",
    fontSize: 14,
  },
  compareBar: {
    background: "#111827",
    border: "1px solid #f59e0b33",
    borderRadius: 10,
    padding: "10px 16px",
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    fontSize: 13,
  },
  compareBtn: {
    padding: "6px 14px",
    background: "#f59e0b",
    border: "none",
    borderRadius: 6,
    color: "#0f172a",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },
  cancelCompareBtn: {
    padding: "6px 14px",
    background: "transparent",
    border: "1px solid #475569",
    borderRadius: 6,
    color: "#94a3b8",
    fontSize: 12,
    cursor: "pointer",
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#f59e0b",
    fontSize: 14,
    cursor: "pointer",
    padding: "0 0 12px 0",
    fontWeight: 600,
  },
  paramGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
    gap: 8,
  },
  paramItem: {
    background: "#0f172a",
    borderRadius: 8,
    padding: "10px 12px",
  },
  paramLabel: {
    color: "#475569",
    fontSize: 11,
    marginBottom: 4,
  },
  paramValue: {
    color: "#e2e8f0",
    fontSize: 16,
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
  },
  paramUnit: {
    color: "#475569",
    fontSize: 11,
    fontWeight: 400,
    marginLeft: 4,
  },
  descText: {
    color: "#cbd5e1",
    fontSize: 14,
    lineHeight: 1.7,
    margin: 0,
    whiteSpace: "pre-wrap",
  },
  toast: {
    position: "fixed",
    bottom: 20,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#111827",
    border: "1px solid",
    borderRadius: 10,
    padding: "10px 24px",
    fontSize: 14,
    fontWeight: 600,
    zIndex: 999,
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
  },
};
