# ⚡ 避震調校管理系統 Suspension Tuning System

改裝廠避震器調校紀錄管理工具，支援即時懸吊動態模擬、歷史紀錄查詢、前後對比分析。

## 技術架構

- **前端**：React 18 + Vite
- **後端**：Supabase (PostgreSQL)
- **部署**：Netlify（GitHub 連動自動部署）

## 快速開始

### 1. Supabase 建表

到 Supabase Dashboard → SQL Editor 執行：

```sql
CREATE TABLE suspension_records (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  license_plate TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  car_model     TEXT,
  shock_model   TEXT,
  fork_type_front TEXT DEFAULT 'inverted',
  fork_type_rear  TEXT DEFAULT 'conventional',
  drive_type    TEXT DEFAULT 'fwd',
  vehicle_weight NUMERIC,
  odometer      NUMERIC,
  symptoms      JSONB DEFAULT '[]'::jsonb,
  damping_max_clicks NUMERIC DEFAULT 32,
  spring_rate_front   NUMERIC,
  spring_rate_rear    NUMERIC,
  ride_height_fingers NUMERIC,
  tire_pressure_front NUMERIC,
  tire_pressure_rear  NUMERIC,
  damping_rebound_front     NUMERIC,
  damping_rebound_rear      NUMERIC,
  damping_compression_front NUMERIC,
  damping_compression_rear  NUMERIC,
  preload_front  NUMERIC,
  preload_rear   NUMERIC,
  sway_bar_front TEXT,
  sway_bar_rear  TEXT,
  camber_front   NUMERIC,
  camber_rear    NUMERIC,
  toe_front      NUMERIC,
  toe_rear       NUMERIC,
  issue_description  TEXT,
  adjustment_notes   TEXT,
  technician         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE suspension_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON suspension_records
  FOR ALL USING (true) WITH CHECK (true);
```

### 2. 本地開發

```bash
cp .env.example .env.local
# 編輯 .env.local 填入你的 Supabase 憑證
npm install
npm run dev
```

### 3. Netlify 部署

1. GitHub repo 推上去
2. Netlify → Add new site → Import an existing project → 選這個 repo
3. Build settings 會自動讀 `netlify.toml`（不用手動設）
4. **Environment variables** 加入：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy!

之後每次 push 到 main 分支，Netlify 會自動重新部署。

### 4. 若已有舊版資料表，執行升級 SQL

```sql
-- 新增 v3 欄位（已有表的話執行這段）
ALTER TABLE suspension_records ADD COLUMN IF NOT EXISTS drive_type TEXT DEFAULT 'fwd';
ALTER TABLE suspension_records ADD COLUMN IF NOT EXISTS vehicle_weight NUMERIC;
ALTER TABLE suspension_records ADD COLUMN IF NOT EXISTS symptoms JSONB DEFAULT '[]'::jsonb;
ALTER TABLE suspension_records ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE suspension_records ADD COLUMN IF NOT EXISTS odometer NUMERIC;
ALTER TABLE suspension_records ADD COLUMN IF NOT EXISTS fork_type_front TEXT DEFAULT 'inverted';
ALTER TABLE suspension_records ADD COLUMN IF NOT EXISTS fork_type_rear TEXT DEFAULT 'conventional';
ALTER TABLE suspension_records ADD COLUMN IF NOT EXISTS damping_max_clicks NUMERIC DEFAULT 32;
ALTER TABLE suspension_records ADD COLUMN IF NOT EXISTS sway_bar_front TEXT;
ALTER TABLE suspension_records ADD COLUMN IF NOT EXISTS sway_bar_rear TEXT;
-- 搬移舊 fork_type 資料
UPDATE suspension_records SET fork_type_front = fork_type WHERE fork_type IS NOT NULL AND fork_type_front IS NULL;
```

## 功能

- 🔧 完整避震參數輸入（彈簧、阻尼、預載、車高、胎壓、定位角度）
- ⚡ 即時懸吊動態模擬動畫（含車重影響因子）
- 🧮 彈簧率建議計算器（依車重 + 驅動方式自動算出舒適/均衡/運動區間）
- 🩺 症狀快速勾選 + 自動診斷建議（跳跳車、側傾、點頭、碎震等）
- 🏎️ 快速範本（MG HS、Focus、Civic、86/BRZ 含車重）
- 📋 歷史紀錄依車牌分組，支援搜尋
- 🔀 兩筆紀錄前後對比（波形圖 + 並排動畫）
- 📈 同車歷次調校趨勢迷你圖
- 📊 統計儀表板（總紀錄、本月、回訪率）
- 📤 一鍵匯出客戶報告 PNG（傳 LINE 給車主）
- 🗑 刪除紀錄（含確認對話框）
- +/− 步進按鈕（技師戴手套也能快速調整）
