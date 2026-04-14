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
  car_model     TEXT,
  shock_model   TEXT,
  fork_type     TEXT DEFAULT 'inverted',
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

## 功能

- 🔧 完整避震參數輸入（彈簧、阻尼、預載、車高、胎壓、定位角度）
- ⚡ 即時懸吊動態模擬動畫
- 📋 歷史紀錄依車牌分組，支援搜尋
- 🔀 兩筆紀錄前後對比（波形圖）
- 📝 一鍵複製舊紀錄做微調
