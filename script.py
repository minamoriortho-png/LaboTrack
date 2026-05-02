import React, { useMemo, useState } from "react";

type DeviceRow = { value: string; label: string };
type StageColumn = { value: string; label: string };
type Item = {
  id: string;
  patient: string;
  deviceCategory: string;
  deviceName: string;
  stage: string;
  fittingDate: string;
  visitDate: string;
};

type RiskLevel = "done" | "critical" | "warning" | "normal";

type RiskAssessment = {
  level: RiskLevel;
  label: string;
  message: string;
  priority: number;
};

const DEVICE_ROWS: DeviceRow[] = [
  { value: "labial", label: "ラビアル" },
  { value: "lingual", label: "リンガル" },
  { value: "aligner", label: "アライナー" },
  { value: "band", label: "バンド系装置" },
  { value: "bite", label: "バイト" },
];

const STAGE_COLUMNS: StageColumn[] = [
  { value: "impression", label: "印象" },
  { value: "order", label: "発注（プリント）" },
  { value: "approval", label: "承認" },
  { value: "delivery", label: "納品" },
  { value: "bonding", label: "装着" },
];

const STAGE_DURATIONS: Record<string, number> = {
  impression: 1,
  order: 7,
  approval: 14,
  delivery: 0,
  bonding: 0,
};

const DEVICE_DETAIL_OPTIONS: Record<string, string[]> = {
  labial: ["メタルブラケット", "セラミックブラケット", "ホワイトワイヤー", "部分ラビアル"],
  lingual: ["フルリンガル", "上顎リンガル", "リンガル保定装置"],
  aligner: ["アライナー初回", "追加アライナー", "リファインメント"],
  band: ["急速拡大装置", "リンガルアーチ", "ナンスホールディングアーチ", "TPA"],
  bite: ["バイトプレート", "前歯部バイトターボ", "リンガルボタン関連"],
};

const initialItems: Item[] = [
  {
    id: "CARD-001",
    patient: "山田 花子",
    deviceCategory: "lingual",
    deviceName: "フルリンガル",
    stage: "approval",
    fittingDate: "2026-04-18",
    visitDate: "2026-04-17",
  },
  {
    id: "CARD-002",
    patient: "田中 太郎",
    deviceCategory: "aligner",
    deviceName: "アライナー初回",
    stage: "delivery",
    fittingDate: "2026-04-15",
    visitDate: "2026-04-15",
  },
  {
    id: "CARD-003",
    patient: "佐藤 美咲",
    deviceCategory: "band",
    deviceName: "急速拡大装置",
    stage: "order",
    fittingDate: "2026-04-22",
    visitDate: "2026-04-20",
  },
  {
    id: "CARD-004",
    patient: "中村 健",
    deviceCategory: "labial",
    deviceName: "ホワイトワイヤー",
    stage: "impression",
    fittingDate: "2026-04-25",
    visitDate: "2026-04-24",
  },
  {
    id: "CARD-005",
    patient: "高橋 彩",
    deviceCategory: "bite",
    deviceName: "前歯部バイトターボ",
    stage: "bonding",
    fittingDate: "2026-04-10",
    visitDate: "2026-04-10",
  },
];

function getDeviceLabel(value: string): string {
  return DEVICE_ROWS.find((row) => row.value === value)?.label || value;
}

function getStageLabel(value: string): string {
  return STAGE_COLUMNS.find((column) => column.value === value)?.label || value;
}

function daysUntil(dateString: string): number {
  const today = new Date("2026-04-10");
  const target = new Date(dateString);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getDateTone(dateString: string): string {
  const diff = daysUntil(dateString);
  if (diff < 0) return "#e11d48";
  if (diff <= 2) return "#d97706";
  return "#64748b";
}

function getDateLabel(dateString: string): string {
  const diff = daysUntil(dateString);
  if (diff < 0) return `${Math.abs(diff)}日経過`;
  if (diff === 0) return "本日装着";
  return `装着まで${diff}日`;
}

function getVisitLabel(dateString: string): string {
  const diff = daysUntil(dateString);
  if (diff < 0) return `来院${Math.abs(diff)}日経過`;
  if (diff === 0) return "本日来院予定";
  return `来院まで${diff}日`;
}

function getRemainingLeadDays(stage: string): number {
  const stageIndex = STAGE_COLUMNS.findIndex((column) => column.value === stage);
  if (stageIndex === -1) return 0;

  return STAGE_COLUMNS.slice(stageIndex, STAGE_COLUMNS.length - 1).reduce((sum, column) => {
    return sum + (STAGE_DURATIONS[column.value] || 0);
  }, 0);
}

function getRiskAssessment(item: Item): RiskAssessment {
  const remainingLeadDays = getRemainingLeadDays(item.stage);
  const visitDiff = daysUntil(item.visitDate);
  const fittingDiff = daysUntil(item.fittingDate);
  const daysToTarget = Math.min(visitDiff, fittingDiff);

  if (item.stage === "bonding") {
    return {
      level: "done",
      label: "装着段階",
      message: "装着工程まで進んでいます",
      priority: 99,
    };
  }

  if (daysToTarget < 0) {
    return {
      level: "critical",
      label: "要至急対応",
      message: "来院日または装着日を超過しています",
      priority: 0,
    };
  }

  if (remainingLeadDays > daysToTarget) {
    return {
      level: "critical",
      label: "間に合わない可能性高",
      message: `残り必要日数${remainingLeadDays}日に対して残り${daysToTarget}日です`,
      priority: 1,
    };
  }

  if (remainingLeadDays === daysToTarget) {
    return {
      level: "warning",
      label: "間に合わない可能性あり",
      message: `残り必要日数${remainingLeadDays}日と残り${daysToTarget}日が同じです`,
      priority: 2,
    };
  }

  if (daysToTarget - remainingLeadDays <= 2) {
    return {
      level: "warning",
      label: "日程接近",
      message: `必要日数差が${daysToTarget - remainingLeadDays}日しかありません`,
      priority: 3,
    };
  }

  return {
    level: "normal",
    label: "進行中",
    message: "現時点では日程に余裕があります",
    priority: 4,
  };
}

function getCardTone(item: Item) {
  const risk = getRiskAssessment(item);

  if (risk.level === "critical") {
    return {
      wrapper: { border: "1px solid #fda4af", background: "#fff1f2" },
      badge: { background: "#ffe4e6", color: "#be123c", border: "1px solid #fecdd3" },
      label: risk.label,
    };
  }

  if (risk.level === "warning") {
    return {
      wrapper: { border: "1px solid #fcd34d", background: "#fffbeb" },
      badge: { background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a" },
      label: risk.label,
    };
  }

  if (item.stage === "bonding") {
    return {
      wrapper: { border: "1px solid #86efac", background: "#ecfdf5" },
      badge: { background: "#d1fae5", color: "#047857", border: "1px solid #a7f3d0" },
      label: "装着段階",
    };
  }

  return {
    wrapper: { border: "1px solid #e2e8f0", background: "#ffffff" },
    badge: { background: "#f1f5f9", color: "#334155", border: "1px solid #e2e8f0" },
    label: "進行中",
  };
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: 24,
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#0f172a",
  },
  container: {
    maxWidth: 1600,
    margin: "0 auto",
    display: "grid",
    gap: 20,
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  panel: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  },
  panelBody: {
    padding: 16,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: 12,
  },
  filterGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(280px, 1fr) 220px 220px 220px",
    gap: 12,
    alignItems: "center",
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "10px 12px",
    fontSize: 14,
    background: "#ffffff",
    boxSizing: "border-box",
  },
  button: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "10px 14px",
    background: "#ffffff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },
  primaryButton: {
    border: "1px solid #0f172a",
    borderRadius: 14,
    padding: "10px 14px",
    background: "#0f172a",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  matrixWrap: {
    overflowX: "auto",
  },
  matrix: {
    minWidth: 1300,
    display: "grid",
    gridTemplateColumns: "180px repeat(5, minmax(220px, 1fr))",
    gap: 12,
    alignItems: "start",
  },
  stickyHeader: {
    position: "sticky",
    top: 0,
    zIndex: 2,
  },
  cell: {
    minHeight: 180,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 12,
    boxSizing: "border-box",
  },
  rowLabel: {
    minHeight: 180,
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 16,
    display: "flex",
    alignItems: "center",
    boxSizing: "border-box",
  },
  emptyCell: {
    minHeight: 150,
    border: "1px dashed #cbd5e1",
    borderRadius: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
    fontSize: 14,
  },
  urgentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 50,
  },
  modal: {
    width: "100%",
    maxWidth: 760,
    background: "#ffffff",
    borderRadius: 20,
    border: "1px solid #e2e8f0",
    boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)",
    padding: 20,
    boxSizing: "border-box",
  },
  modalGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
};

function SummaryCard({ title, value, sub }: { title: string; value: number; sub: string }) {
  return (
    <div style={styles.panel}>
      <div style={styles.panelBody}>
        <div style={{ fontSize: 12, color: "#64748b" }}>{title}</div>
        <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{value}</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{sub}</div>
      </div>
    </div>
  );
}

function MatrixCard({ item, rowLabel, moveCard }: { item: Item; rowLabel: string; moveCard: (id: string, direction: number) => void }) {
  const stageIndex = STAGE_COLUMNS.findIndex((stage) => stage.value === item.stage);
  const canMoveNext = stageIndex < STAGE_COLUMNS.length - 1;
  const canMoveBack = stageIndex > 0;
  const tone = getCardTone(item);

  return (
    <div style={{ ...styles.panel, ...tone.wrapper }}>
      <div style={{ padding: 14, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              👤 {item.patient}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{item.id}</div>
          </div>
          <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
            <span style={{ ...styles.badge, background: "#ffffff", border: "1px solid #cbd5e1", color: "#334155" }}>{rowLabel}</span>
            <span style={{ ...styles.badge, ...tone.badge }}>{tone.label}</span>
          </div>
        </div>

        <div style={{ display: "grid", gap: 8, fontSize: 13, color: "#334155" }}>
          <div>📦 {item.deviceName}</div>
          <div>📅 装着日 {item.fittingDate}</div>
          <div style={{ fontSize: 11, color: getDateTone(item.fittingDate) }}>{getDateLabel(item.fittingDate)}</div>
          <div>🗓️ 来院予定 {item.visitDate}</div>
          <div style={{ fontSize: 11, color: getDateTone(item.visitDate) }}>{getVisitLabel(item.visitDate)}</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...styles.button, flex: 1, opacity: canMoveBack ? 1 : 0.45 }} disabled={!canMoveBack} onClick={() => moveCard(item.id, -1)}>
            戻す
          </button>
          <button style={{ ...styles.primaryButton, flex: 1, opacity: canMoveNext ? 1 : 0.45 }} disabled={!canMoveNext} onClick={() => moveCard(item.id, 1)}>
            次へ
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [query, setQuery] = useState("");
  const [rowFilter, setRowFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [scheduleFilter, setScheduleFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<Item, "id">>({
    patient: "",
    deviceCategory: "labial",
    deviceName: "メタルブラケット",
    stage: "impression",
    fittingDate: "",
    visitDate: "",
  });

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery =
        !q ||
        [item.patient, item.deviceName, getDeviceLabel(item.deviceCategory), getStageLabel(item.stage), item.fittingDate, item.visitDate]
          .join(" ")
          .toLowerCase()
          .includes(q);

      const matchesRow = rowFilter === "all" || item.deviceCategory === rowFilter;
      const matchesStage = stageFilter === "all" || item.stage === stageFilter;

      const fittingDiff = daysUntil(item.fittingDate);
      const visitDiff = daysUntil(item.visitDate);
      let matchesSchedule = true;

      if (scheduleFilter === "today") {
        matchesSchedule = fittingDiff === 0 || visitDiff === 0;
      } else if (scheduleFilter === "soon") {
        matchesSchedule = (fittingDiff >= 0 && fittingDiff <= 3) || (visitDiff >= 0 && visitDiff <= 3);
      } else if (scheduleFilter === "overdue") {
        matchesSchedule = item.stage !== "bonding" && (fittingDiff < 0 || visitDiff < 0);
      }

      return matchesQuery && matchesRow && matchesStage && matchesSchedule;
    });
  }, [items, query, rowFilter, stageFilter, scheduleFilter]);

  const stats = useMemo(() => {
    const total = items.length;
    const todayBonding = items.filter((item) => item.stage === "bonding" && daysUntil(item.fittingDate) === 0).length;
    const waitingApproval = items.filter((item) => item.stage === "approval").length;
    const dueSoon = items.filter((item) => {
      const fittingDiff = daysUntil(item.fittingDate);
      const visitDiff = daysUntil(item.visitDate);
      return (fittingDiff >= 0 && fittingDiff <= 3) || (visitDiff >= 0 && visitDiff <= 3);
    }).length;
    const overdue = items.filter((item) => item.stage !== "bonding" && (daysUntil(item.fittingDate) < 0 || daysUntil(item.visitDate) < 0)).length;
    const riskHigh = items.filter((item) => {
      const risk = getRiskAssessment(item);
      return risk.level === "critical" || risk.level === "warning";
    }).length;
    return { total, todayBonding, waitingApproval, dueSoon, overdue, riskHigh };
  }, [items]);

  const urgentItems = useMemo(() => {
    return [...filteredItems]
      .map((item) => ({ item, risk: getRiskAssessment(item) }))
      .filter(({ risk }) => risk.level === "critical" || risk.level === "warning")
      .sort((a, b) => {
        if (a.risk.priority !== b.risk.priority) return a.risk.priority - b.risk.priority;
        const aMin = Math.min(daysUntil(a.item.visitDate), daysUntil(a.item.fittingDate));
        const bMin = Math.min(daysUntil(b.item.visitDate), daysUntil(b.item.fittingDate));
        return aMin - bMin;
      });
  }, [filteredItems]);

  const moveCard = (id: string, direction: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const currentIndex = STAGE_COLUMNS.findIndex((column) => column.value === item.stage);
        const nextIndex = currentIndex + direction;
        if (nextIndex < 0 || nextIndex >= STAGE_COLUMNS.length) return item;
        return { ...item, stage: STAGE_COLUMNS[nextIndex].value };
      })
    );
  };

  const addItem = () => {
    if (!form.patient || !form.deviceName || !form.fittingDate || !form.visitDate) return;
    const next: Item = {
      id: `CARD-${String(items.length + 1).padStart(3, "0")}`,
      ...form,
    };
    setItems((prev) => [...prev, next]);
    setOpen(false);
    setForm({
      patient: "",
      deviceCategory: "labial",
      deviceName: "メタルブラケット",
      stage: "impression",
      fittingDate: "",
      visitDate: "",
    });
  };

  const handleCategoryChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      deviceCategory: value,
      deviceName: DEVICE_DETAIL_OPTIONS[value][0],
    }));
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.topBar}>
          <div>
            <h1 style={{ fontSize: 32, margin: 0 }}>技工物 進行表</h1>
            <p style={{ color: "#64748b", margin: "8px 0 0 0" }}>縦軸を装置カテゴリ、横軸を進行状況にしたマトリクス型の進捗ボード</p>
          </div>
          <button style={styles.primaryButton} onClick={() => setOpen(true)}>+ カード追加</button>
        </div>

        <div style={styles.summaryGrid}>
          <SummaryCard title="全カード数" value={stats.total} sub="現在管理中の技工物" />
          <SummaryCard title="本日装着" value={stats.todayBonding} sub="装着列かつ本日予定" />
          <SummaryCard title="承認待ち" value={stats.waitingApproval} sub="承認列にあるカード" />
          <SummaryCard title="日程が近い" value={stats.dueSoon} sub="装着日または来院日が3日以内" />
          <SummaryCard title="遅延・要対応" value={stats.overdue} sub="未装着で日付超過" />
          <SummaryCard title="間に合わない可能性" value={stats.riskHigh} sub="上部に自動表示されるカード" />
        </div>

        <div style={styles.panel}>
          <div style={styles.panelBody}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <div style={styles.filterGrid}>
                <input style={styles.input} placeholder="患者名・装置名・日付で検索" value={query} onChange={(e) => setQuery(e.target.value)} />
                <select style={styles.input} value={rowFilter} onChange={(e) => setRowFilter(e.target.value)}>
                  <option value="all">全装置カテゴリ</option>
                  {DEVICE_ROWS.map((row) => (
                    <option key={row.value} value={row.value}>{row.label}</option>
                  ))}
                </select>
                <select style={styles.input} value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
                  <option value="all">全進行状況</option>
                  {STAGE_COLUMNS.map((column) => (
                    <option key={column.value} value={column.value}>{column.label}</option>
                  ))}
                </select>
                <select style={styles.input} value={scheduleFilter} onChange={(e) => setScheduleFilter(e.target.value)}>
                  <option value="all">全日程</option>
                  <option value="today">本日関連</option>
                  <option value="soon">3日以内</option>
                  <option value="overdue">超過のみ</option>
                </select>
              </div>
              <div style={{ fontSize: 13, color: "#64748b" }}>色分け: 赤=遅延 / 黄=要確認 / 緑=装着段階</div>
            </div>
          </div>
        </div>

        {urgentItems.length > 0 && (
          <div style={{ ...styles.panel, border: "1px solid #fecdd3", background: "#fff1f2" }}>
            <div style={{ ...styles.panelBody, display: "grid", gap: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#9f1239" }}>⚠ 来院日までに間に合わない可能性があるカード</div>
              <div style={styles.urgentGrid}>
                {urgentItems.map(({ item, risk }) => {
                  const tone = getCardTone(item);
                  return (
                    <div key={`urgent-${item.id}`} style={{ ...styles.panel, ...tone.wrapper }}>
                      <div style={styles.panelBody}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <div>
                            <div style={{ fontWeight: 700 }}>{item.patient}</div>
                            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{getDeviceLabel(item.deviceCategory)} / {item.deviceName}</div>
                          </div>
                          <span style={{ ...styles.badge, ...tone.badge }}>{risk.label}</span>
                        </div>
                        <div style={{ fontSize: 13, color: "#334155", marginTop: 12, display: "grid", gap: 6 }}>
                          <div>現在工程: {getStageLabel(item.stage)}</div>
                          <div>来院予定: {item.visitDate}</div>
                          <div>装着予定: {item.fittingDate}</div>
                          <div style={{ fontSize: 12, color: "#475569" }}>{risk.message}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div style={styles.matrixWrap}>
          <div style={styles.matrix}>
            <div />
            {STAGE_COLUMNS.map((column) => (
              <div key={column.value} style={{ ...styles.panel, ...styles.stickyHeader }}>
                <div style={styles.panelBody}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 700 }}>{column.label}</div>
                    <span style={{ ...styles.badge, background: "#f1f5f9", color: "#334155" }}>
                      {filteredItems.filter((item) => item.stage === column.value).length}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {DEVICE_ROWS.filter((row) => rowFilter === "all" || row.value === rowFilter).map((row) => (
              <React.Fragment key={row.value}>
                <div style={styles.rowLabel}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{row.label}</div>
                    <div style={{ fontSize: 14, color: "#64748b", marginTop: 4 }}>
                      {filteredItems.filter((item) => item.deviceCategory === row.value).length}件
                    </div>
                  </div>
                </div>

                {STAGE_COLUMNS.map((column) => {
                  const cellItems = filteredItems.filter((item) => item.deviceCategory === row.value && item.stage === column.value);

                  return (
                    <div key={`${row.value}-${column.value}`} style={styles.cell}>
                      {cellItems.length === 0 ? (
                        <div style={styles.emptyCell}>カードなし</div>
                      ) : (
                        <div style={{ display: "grid", gap: 12 }}>
                          {cellItems.map((item) => (
                            <MatrixCard key={item.id} item={item} rowLabel={row.label} moveCard={moveCard} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div style={styles.panel}>
          <div style={styles.panelBody}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>追加した機能</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12, fontSize: 14, color: "#475569" }}>
              <div style={{ background: "#f8fafc", borderRadius: 16, padding: 16 }}>カード色分けで遅延・要確認・装着段階を即判別</div>
              <div style={{ background: "#f8fafc", borderRadius: 16, padding: 16 }}>装着予定日と来院予定日を両方表示</div>
              <div style={{ background: "#f8fafc", borderRadius: 16, padding: 16 }}>進行状況での絞り込みを追加</div>
              <div style={{ background: "#f8fafc", borderRadius: 16, padding: 16 }}>本日・3日以内・超過のみの予定絞り込みを追加</div>
              <div style={{ background: "#f8fafc", borderRadius: 16, padding: 16 }}>来院日までに間に合わない可能性があるカードを最上部に自動表示</div>
            </div>
          </div>
        </div>
      </div>

      {open && (
        <div style={styles.modalBackdrop} onClick={() => setOpen(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>新しいカードを登録</div>
              <button style={styles.button} onClick={() => setOpen(false)}>閉じる</button>
            </div>
            <div style={styles.modalGrid}>
              <input style={styles.input} placeholder="患者名" value={form.patient} onChange={(e) => setForm({ ...form, patient: e.target.value })} />
              <input style={styles.input} type="date" value={form.fittingDate} onChange={(e) => setForm({ ...form, fittingDate: e.target.value })} />
              <select style={styles.input} value={form.deviceCategory} onChange={(e) => handleCategoryChange(e.target.value)}>
                {DEVICE_ROWS.map((row) => (
                  <option key={row.value} value={row.value}>{row.label}</option>
                ))}
              </select>
              <select style={styles.input} value={form.deviceName} onChange={(e) => setForm({ ...form, deviceName: e.target.value })}>
                {DEVICE_DETAIL_OPTIONS[form.deviceCategory].map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <input style={styles.input} type="date" value={form.visitDate} onChange={(e) => setForm({ ...form, visitDate: e.target.value })} />
              <select style={styles.input} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                {STAGE_COLUMNS.map((column) => (
                  <option key={column.value} value={column.value}>{column.label}</option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button style={styles.button} onClick={() => setOpen(false)}>キャンセル</button>
              <button style={styles.primaryButton} onClick={addItem}>登録する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
