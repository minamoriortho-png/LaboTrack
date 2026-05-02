import { useEffect, useMemo, useState } from "react";

type Device = "labial" | "lingual" | "aligner" | "band" | "bite";
type Stage = "impression" | "order" | "approval" | "delivery" | "bonding";

type LabItem = {
  id: string;
  patient: string;
  deviceCategory: Device;
  deviceName: string;
  stage: Stage;
  fittingDate: string;
  visitDate: string;
  memo: string;
};

const STORAGE_KEY = "lab-progress-items-v1";
const AUTH_KEY = "lab-progress-auth-v1";

const LOGIN = { username: "admin", password: "lab2026" };

const DEVICE_ROWS: { value: Device; label: string }[] = [
  { value: "labial", label: "ラビアル" },
  { value: "lingual", label: "リンガル" },
  { value: "aligner", label: "アライナー" },
  { value: "band", label: "バンド系装置" },
  { value: "bite", label: "バイト" },
];

const STAGE_COLUMNS: { value: Stage; label: string }[] = [
  { value: "impression", label: "印象" },
  { value: "order", label: "発注（プリント）" },
  { value: "approval", label: "承認" },
  { value: "delivery", label: "納品" },
  { value: "bonding", label: "装着" },
];

const STAGE_DURATIONS: Record<Stage, number> = {
  impression: 1,
  order: 7,
  approval: 14,
  delivery: 0,
  bonding: 0,
};

const DEVICE_DETAIL_OPTIONS: Record<Device, string[]> = {
  labial: ["メタルブラケット", "セラミックブラケット", "ホワイトワイヤー", "部分ラビアル"],
  lingual: ["フルリンガル", "上顎リンガル", "リンガル保定装置"],
  aligner: ["アライナー初回", "追加アライナー", "リファインメント"],
  band: ["急速拡大装置", "リンガルアーチ", "ナンスホールディングアーチ", "TPA"],
  bite: ["バイトプレート", "前歯部バイトターボ", "リンガルボタン関連"],
};

const initialItems: LabItem[] = [
  { id: "CARD-001", patient: "山田 花子", deviceCategory: "lingual", deviceName: "フルリンガル", stage: "approval", fittingDate: "2026-05-18", visitDate: "2026-05-17", memo: "承認後、納品日を確認する" },
  { id: "CARD-002", patient: "田中 太郎", deviceCategory: "aligner", deviceName: "アライナー初回", stage: "delivery", fittingDate: "2026-05-15", visitDate: "2026-05-15", memo: "初回アライナー。来院前に枚数確認" },
  { id: "CARD-003", patient: "佐藤 美咲", deviceCategory: "band", deviceName: "急速拡大装置", stage: "order", fittingDate: "2026-05-22", visitDate: "2026-05-20", memo: "急ぎ。納品遅れに注意" },
  { id: "CARD-004", patient: "中村 健", deviceCategory: "labial", deviceName: "ホワイトワイヤー", stage: "impression", fittingDate: "2026-05-25", visitDate: "2026-05-24", memo: "ホワイトワイヤー希望" },
  { id: "CARD-005", patient: "高橋 彩", deviceCategory: "bite", deviceName: "前歯部バイトターボ", stage: "bonding", fittingDate: "2026-05-10", visitDate: "2026-05-10", memo: "装着済み。確認後削除可" },
];

function loadItems(): LabItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialItems;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return initialItems;
    return parsed.map((item) => ({ memo: "", ...item }));
  } catch {
    return initialItems;
  }
}

function deviceLabel(value: string) {
  return DEVICE_ROWS.find((row) => row.value === value)?.label || value;
}

function stageLabel(value: string) {
  return STAGE_COLUMNS.find((column) => column.value === value)?.label || value;
}

function todayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysUntil(dateString: string) {
  if (!dateString) return 9999;
  const target = new Date(`${dateString}T00:00:00`);
  return Math.ceil((target.getTime() - todayStart().getTime()) / 86400000);
}

function remainingLeadDays(stage: Stage) {
  const stageIndex = STAGE_COLUMNS.findIndex((column) => column.value === stage);
  if (stageIndex === -1) return 0;
  return STAGE_COLUMNS.slice(stageIndex, STAGE_COLUMNS.length - 1).reduce((sum, column) => sum + STAGE_DURATIONS[column.value], 0);
}

function riskAssessment(item: LabItem) {
  const need = remainingLeadDays(item.stage);
  const remain = Math.min(daysUntil(item.visitDate), daysUntil(item.fittingDate));
  if (item.stage === "bonding") return { level: "done", label: "装着段階", message: "装着工程まで進んでいます", priority: 99 };
  if (remain < 0) return { level: "critical", label: "要至急対応", message: "来院日または装着日を超過しています", priority: 0 };
  if (need > remain) return { level: "critical", label: "間に合わない可能性高", message: `残り必要日数${need}日に対して残り${remain}日です`, priority: 1 };
  if (need === remain) return { level: "warning", label: "間に合わない可能性あり", message: `残り必要日数${need}日と残り${remain}日が同じです`, priority: 2 };
  if (remain - need <= 2) return { level: "warning", label: "日程接近", message: `必要日数差が${remain - need}日しかありません`, priority: 3 };
  return { level: "normal", label: "進行中", message: "現時点では日程に余裕があります", priority: 4 };
}

function dateClassName(dateString: string) {
  const diff = daysUntil(dateString);
  if (diff < 0) return "date danger";
  if (diff <= 2) return "date warning";
  return "date";
}

function fittingLabel(dateString: string) {
  const diff = daysUntil(dateString);
  if (diff < 0) return `${Math.abs(diff)}日経過`;
  if (diff === 0) return "本日装着";
  return `装着まで${diff}日`;
}

function visitLabel(dateString: string) {
  const diff = daysUntil(dateString);
  if (diff < 0) return `来院${Math.abs(diff)}日経過`;
  if (diff === 0) return "本日来院予定";
  return `来院まで${diff}日`;
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (username === LOGIN.username && password === LOGIN.password) {
      sessionStorage.setItem(AUTH_KEY, "true");
      onLogin();
      return;
    }
    setError("ユーザー名またはパスワードが違います");
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <h1>技工物 進行表</h1>
        <p>ログインして進捗管理画面を開きます</p>
        <label>ユーザー名<input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="admin" autoComplete="username" /></label>
        <label>パスワード<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="パスワード" autoComplete="current-password" /></label>
        {error && <div className="error">{error}</div>}
        <button type="submit" className="primary full">ログイン</button>
        <div className="note">初期ログイン: admin / lab2026<br />このログインは簡易版です。本番ではSupabase Auth等の認証を推奨します。</div>
      </form>
    </div>
  );
}

function SummaryCard({ title, value, sub }: { title: string; value: number; sub: string }) {
  return (
    <div className="summary-card">
      <div className="summary-title">{title}</div>
      <div className="summary-value">{value}</div>
      <div className="summary-sub">{sub}</div>
    </div>
  );
}

function LabCard({ item, onMove, onDelete }: { item: LabItem; onMove: (id: string, direction: number) => void; onDelete: (id: string) => void }) {
  const risk = riskAssessment(item);
  const stageIndex = STAGE_COLUMNS.findIndex((stage) => stage.value === item.stage);
  const canBack = stageIndex > 0;
  const canNext = stageIndex < STAGE_COLUMNS.length - 1;

  return (
    <div className={`lab-card ${risk.level}`}>
      <div className="card-top">
        <div><div className="patient">👤 {item.patient}</div><div className="card-id">{item.id}</div></div>
        <div className="badges"><span>{deviceLabel(item.deviceCategory)}</span><span className={risk.level}>{risk.label}</span></div>
      </div>
      <div className="card-body">
        <div>📦 {item.deviceName}</div>
        <div>📅 装着予定日 {item.fittingDate}</div>
        <div className={dateClassName(item.fittingDate)}>{fittingLabel(item.fittingDate)}</div>
        <div>🗓️ 来院予定日 {item.visitDate}</div>
        <div className={dateClassName(item.visitDate)}>{visitLabel(item.visitDate)}</div>
        {item.memo && <div className="memo">📝 {item.memo}</div>}
      </div>
      <div className="card-actions">
        <button disabled={!canBack} onClick={() => onMove(item.id, -1)}>戻す</button>
        <button className="primary" disabled={!canNext} onClick={() => onMove(item.id, 1)}>次へ</button>
      </div>
      {item.stage === "bonding" && (
        <button className="delete-button" onClick={() => { if (window.confirm(`${item.patient}さんのカードを削除しますか？`)) onDelete(item.id); }}>
          装着完了として削除
        </button>
      )}
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => sessionStorage.getItem(AUTH_KEY) === "true");
  const [items, setItems] = useState<LabItem[]>(() => loadItems());
  const [query, setQuery] = useState("");
  const [deviceFilter, setDeviceFilter] = useState<Device | "all">("all");
  const [stageFilter, setStageFilter] = useState<Stage | "all">("all");
  const [scheduleFilter, setScheduleFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Omit<LabItem, "id">>({
    patient: "",
    deviceCategory: "labial",
    deviceName: "メタルブラケット",
    stage: "impression",
    fittingDate: "",
    visitDate: "",
    memo: "",
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const filteredItems = useMemo(() => {
    const searchText = query.trim().toLowerCase();
    return items.filter((item) => {
      const searchable = [item.patient, item.deviceName, deviceLabel(item.deviceCategory), stageLabel(item.stage), item.fittingDate, item.visitDate, item.memo].join(" ").toLowerCase();
      if (searchText && !searchable.includes(searchText)) return false;
      if (deviceFilter !== "all" && item.deviceCategory !== deviceFilter) return false;
      if (stageFilter !== "all" && item.stage !== stageFilter) return false;
      const fittingDiff = daysUntil(item.fittingDate);
      const visitDiff = daysUntil(item.visitDate);
      if (scheduleFilter === "today") return fittingDiff === 0 || visitDiff === 0;
      if (scheduleFilter === "soon") return (fittingDiff >= 0 && fittingDiff <= 3) || (visitDiff >= 0 && visitDiff <= 3);
      if (scheduleFilter === "overdue") return item.stage !== "bonding" && (fittingDiff < 0 || visitDiff < 0);
      return true;
    });
  }, [items, query, deviceFilter, stageFilter, scheduleFilter]);

  const urgentItems = useMemo(() => {
    return filteredItems
      .map((item) => ({ item, risk: riskAssessment(item) }))
      .filter(({ risk }) => risk.level === "critical" || risk.level === "warning")
      .sort((a, b) => {
        if (a.risk.priority !== b.risk.priority) return a.risk.priority - b.risk.priority;
        const aMin = Math.min(daysUntil(a.item.visitDate), daysUntil(a.item.fittingDate));
        const bMin = Math.min(daysUntil(b.item.visitDate), daysUntil(b.item.fittingDate));
        return aMin - bMin;
      });
  }, [filteredItems]);

  const stats = useMemo(() => ({
    total: items.length,
    todayBonding: items.filter((item) => item.stage === "bonding" && daysUntil(item.fittingDate) === 0).length,
    approval: items.filter((item) => item.stage === "approval").length,
    soon: items.filter((item) => {
      const fittingDiff = daysUntil(item.fittingDate);
      const visitDiff = daysUntil(item.visitDate);
      return (fittingDiff >= 0 && fittingDiff <= 3) || (visitDiff >= 0 && visitDiff <= 3);
    }).length,
    overdue: items.filter((item) => item.stage !== "bonding" && (daysUntil(item.fittingDate) < 0 || daysUntil(item.visitDate) < 0)).length,
    riskHigh: items.filter((item) => {
      const risk = riskAssessment(item);
      return risk.level === "critical" || risk.level === "warning";
    }).length,
  }), [items]);

  function moveCard(id: string, direction: number) {
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      const currentIndex = STAGE_COLUMNS.findIndex((stage) => stage.value === item.stage);
      const nextStage = STAGE_COLUMNS[currentIndex + direction];
      if (!nextStage) return item;
      return { ...item, stage: nextStage.value };
    }));
  }

  function deleteCard(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function logout() {
    sessionStorage.removeItem(AUTH_KEY);
    setLoggedIn(false);
  }

  function addCard() {
    if (!form.patient || !form.fittingDate || !form.visitDate) return;
    setItems((prev) => [...prev, { id: `CARD-${String(Date.now()).slice(-6)}`, ...form }]);
    setModalOpen(false);
    setForm({ patient: "", deviceCategory: "labial", deviceName: "メタルブラケット", stage: "impression", fittingDate: "", visitDate: "", memo: "" });
  }

  function resetStorage() {
    if (!window.confirm("保存済みデータを初期化しますか？")) return;
    localStorage.removeItem(STORAGE_KEY);
    setItems(initialItems);
  }

  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />;

  return (
    <div className="page">
      <div className="container">
        <header className="top-bar">
          <div>
            <h1>技工物 進行表</h1>
            <p>追加・移動・削除内容はlocalStorageに保存され、リロード後も残ります。</p>
          </div>
          <div className="top-actions">
            <button onClick={resetStorage}>データ初期化</button>
            <button onClick={logout}>ログアウト</button>
            <button className="primary" onClick={() => setModalOpen(true)}>+ カード追加</button>
          </div>
        </header>

        <section className="summary-grid">
          <SummaryCard title="全カード数" value={stats.total} sub="現在管理中の技工物" />
          <SummaryCard title="本日装着" value={stats.todayBonding} sub="装着列かつ本日予定" />
          <SummaryCard title="承認待ち" value={stats.approval} sub="承認列にあるカード" />
          <SummaryCard title="日程が近い" value={stats.soon} sub="装着日または来院日が3日以内" />
          <SummaryCard title="遅延・要対応" value={stats.overdue} sub="未装着で日付超過" />
          <SummaryCard title="間に合わない可能性" value={stats.riskHigh} sub="上部に自動表示されるカード" />
        </section>

        <section className="filters">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="患者名・装置名・日付・メモで検索" />
          <select value={deviceFilter} onChange={(event) => setDeviceFilter(event.target.value as Device | "all")}>
            <option value="all">全装置カテゴリ</option>
            {DEVICE_ROWS.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
          </select>
          <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as Stage | "all")}>
            <option value="all">全進行状況</option>
            {STAGE_COLUMNS.map((column) => <option key={column.value} value={column.value}>{column.label}</option>)}
          </select>
          <select value={scheduleFilter} onChange={(event) => setScheduleFilter(event.target.value)}>
            <option value="all">全日程</option>
            <option value="today">本日関連</option>
            <option value="soon">3日以内</option>
            <option value="overdue">超過のみ</option>
          </select>
        </section>

        {urgentItems.length > 0 && (
          <section className="urgent-panel">
            <h2>⚠ 来院日までに間に合わない可能性があるカード</h2>
            <div className="urgent-grid">
              {urgentItems.map(({ item, risk }) => (
                <div key={`urgent-${item.id}`} className={`urgent-card ${risk.level}`}>
                  <div className="urgent-head"><strong>{item.patient}</strong><span>{risk.label}</span></div>
                  <p>{deviceLabel(item.deviceCategory)} / {item.deviceName}</p>
                  <p>現在工程: {stageLabel(item.stage)}</p>
                  <p>来院予定: {item.visitDate}</p>
                  <p>装着予定: {item.fittingDate}</p>
                  <small>{risk.message}</small>
                </div>
              ))}
            </div>
          </section>
        )}

        <main className="device-sections">
          {DEVICE_ROWS.filter((row) => deviceFilter === "all" || row.value === deviceFilter).map((row) => {
            const rowItems = filteredItems.filter((item) => item.deviceCategory === row.value);
            return (
              <section key={row.value} className="device-section">
                <div className="device-section-header">
                  <div><h2>{row.label}</h2><p>{rowItems.length}件</p></div><span>{row.label}</span>
                </div>
                <div className="stage-grid">
                  {STAGE_COLUMNS.map((column) => {
                    const columnItems = rowItems.filter((item) => item.stage === column.value);
                    return (
                      <div key={`${row.value}-${column.value}`} className="stage-cell">
                        <div className="stage-cell-header"><strong>{column.label}</strong><span>{columnItems.length}</span></div>
                        {columnItems.length === 0 ? <div className="empty">カードなし</div> : (
                          <div className="card-stack">
                            {columnItems.map((item) => <LabCard key={item.id} item={item} onMove={moveCard} onDelete={deleteCard} />)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </main>
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header"><h2>新しいカードを登録</h2><button onClick={() => setModalOpen(false)}>閉じる</button></div>
            <div className="modal-grid">
              <label>患者名<input placeholder="例：山田 花子" value={form.patient} onChange={(event) => setForm({ ...form, patient: event.target.value })} /></label>
              <label>装着予定日<input type="date" value={form.fittingDate} onChange={(event) => setForm({ ...form, fittingDate: event.target.value })} /><small>装置を実際に装着する予定日</small></label>
              <label>装置カテゴリ<select value={form.deviceCategory} onChange={(event) => { const next = event.target.value as Device; setForm({ ...form, deviceCategory: next, deviceName: DEVICE_DETAIL_OPTIONS[next][0] }); }}>{DEVICE_ROWS.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}</select></label>
              <label>詳細な装置名<select value={form.deviceName} onChange={(event) => setForm({ ...form, deviceName: event.target.value })}>{DEVICE_DETAIL_OPTIONS[form.deviceCategory].map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
              <label>来院予定日<input type="date" value={form.visitDate} onChange={(event) => setForm({ ...form, visitDate: event.target.value })} /><small>患者さんが来院する予約日・確認日</small></label>
              <label>現在の進行状況<select value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value as Stage })}>{STAGE_COLUMNS.map((column) => <option key={column.value} value={column.value}>{column.label}</option>)}</select></label>
              <label className="memo-field">自由記入欄・メモ<textarea placeholder="例：再スキャン済み、技工所へ急ぎで依頼、来院前に納品確認など" value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} /></label>
            </div>
            <div className="modal-actions"><button onClick={() => setModalOpen(false)}>キャンセル</button><button className="primary" onClick={addCard}>登録する</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
