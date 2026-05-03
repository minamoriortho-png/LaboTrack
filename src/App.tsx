import { useEffect, useMemo, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";

type Device = "labial" | "lingual" | "aligner" | "band" | "bite";
type Stage = "impression" | "order" | "approval" | "delivery" | "bonding";

type LabCard = {
  id: string;
  patient: string;
  device_category: Device;
  device_name: string;
  stage: Stage;
  fitting_date: string;
  visit_date: string;
  memo: string | null;
  created_at?: string;
};

type NewLabCard = Omit<LabCard, "id" | "created_at">;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://xiflbktnmjzwdiavfdgz.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_paj79HmcbGKtvsIHdRHkjg_Nu1G53mp";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const DEVICES: { value: Device; label: string }[] = [
  { value: "labial", label: "ラビアル" },
  { value: "lingual", label: "リンガル" },
  { value: "aligner", label: "アライナー" },
  { value: "band", label: "バンド系装置" },
  { value: "bite", label: "バイト" },
];

const STAGES: { value: Stage; label: string }[] = [
  { value: "impression", label: "印象" },
  { value: "order", label: "発注（プリント）" },
  { value: "approval", label: "承認" },
  { value: "delivery", label: "納品" },
  { value: "bonding", label: "装着" },
];

const DEVICE_NAMES: Record<Device, string[]> = {
  labial: ["メタルブラケット", "セラミックブラケット", "ホワイトワイヤー", "部分ラビアル"],
  lingual: ["フルリンガル", "上顎リンガル", "リンガル保定装置"],
  aligner: ["アライナー初回", "追加アライナー", "リファインメント"],
  band: ["急速拡大装置", "リンガルアーチ", "ナンスホールディングアーチ", "TPA"],
  bite: ["バイトプレート", "前歯部バイトターボ", "リンガルボタン関連"],
};

const STAGE_DAYS: Record<Stage, number> = {
  impression: 1,
  order: 7,
  approval: 14,
  delivery: 0,
  bonding: 0,
};

function labelDevice(v: string) { return DEVICES.find(d => d.value === v)?.label || v; }
function labelStage(v: string) { return STAGES.find(s => s.value === v)?.label || v; }

function daysUntil(date: string) {
  if (!date) return 9999;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(`${date}T00:00:00`);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function remainingDays(stage: Stage) {
  const idx = STAGES.findIndex(s => s.value === stage);
  return STAGES.slice(idx, STAGES.length - 1).reduce((sum, s) => sum + STAGE_DAYS[s.value], 0);
}

function risk(card: LabCard) {
  if (card.stage === "bonding") return { level: "done", label: "装着段階", message: "装着工程まで進んでいます", priority: 99 };
  const need = remainingDays(card.stage);
  const remain = Math.min(daysUntil(card.visit_date), daysUntil(card.fitting_date));
  if (remain < 0) return { level: "critical", label: "要至急対応", message: "来院日または装着日を超過しています", priority: 0 };
  if (need > remain) return { level: "critical", label: "間に合わない可能性高", message: `必要日数${need}日に対して残り${remain}日です`, priority: 1 };
  if (need === remain) return { level: "warning", label: "間に合わない可能性あり", message: `必要日数${need}日と残り${remain}日が同じです`, priority: 2 };
  if (remain - need <= 2) return { level: "warning", label: "日程接近", message: `余裕が${remain - need}日しかありません`, priority: 3 };
  return { level: "normal", label: "進行中", message: "現時点では日程に余裕があります", priority: 4 };
}

function dateClass(date: string) {
  const d = daysUntil(date);
  if (d < 0) return "date danger";
  if (d <= 2) return "date warning";
  return "date";
}

function dateText(date: string, type: "fit" | "visit") {
  const d = daysUntil(date);
  if (d < 0) return `${Math.abs(d)}日経過`;
  if (d === 0) return type === "fit" ? "本日装着" : "本日来院予定";
  return type === "fit" ? `装着まで${d}日` : `来院まで${d}日`;
}

function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    if (data.user) onLogin(data.user);
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <h1>技工物 進行表</h1>
        <p>Supabase Authでログインします</p>
        <label>メールアドレス<input value={email} onChange={e => setEmail(e.target.value)} placeholder="staff@example.com" /></label>
        <label>パスワード<input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        {error && <div className="error">{error}</div>}
        <button className="primary full" disabled={loading}>{loading ? "ログイン中..." : "ログイン"}</button>
        <div className="note">Supabase Authenticationで作成したユーザーでログインしてください。</div>
      </form>
    </div>
  );
}

function Summary({ title, value, sub }: { title: string; value: number; sub: string }) {
  return <div className="summary-card"><div className="summary-title">{title}</div><div className="summary-value">{value}</div><div className="summary-sub">{sub}</div></div>;
}

function CardView({ card, onMove, onDelete }: { card: LabCard; onMove: (id: string, dir: number) => void; onDelete: (id: string) => void }) {
  const r = risk(card);
  const idx = STAGES.findIndex(s => s.value === card.stage);
  return (
    <div className={`lab-card ${r.level}`}>
      <div className="card-top">
        <div><div className="patient">👤 {card.patient}</div><div className="card-id">{card.id.slice(0, 8)}</div></div>
        <div className="badges"><span>{labelDevice(card.device_category)}</span><span className={r.level}>{r.label}</span></div>
      </div>
      <div className="card-body">
        <div>📦 {card.device_name}</div>
        <div>📅 装着予定日 {card.fitting_date}</div>
        <div className={dateClass(card.fitting_date)}>{dateText(card.fitting_date, "fit")}</div>
        <div>🗓️ 来院予定日 {card.visit_date}</div>
        <div className={dateClass(card.visit_date)}>{dateText(card.visit_date, "visit")}</div>
        {card.memo && <div className="memo">📝 {card.memo}</div>}
      </div>
      <div className="card-actions">
        <button disabled={idx <= 0} onClick={() => onMove(card.id, -1)}>戻す</button>
        <button className="primary" disabled={idx >= STAGES.length - 1} onClick={() => onMove(card.id, 1)}>次へ</button>
      </div>
      {card.stage === "bonding" && <button className="delete-button" onClick={() => window.confirm(`${card.patient}さんのカードを削除しますか？`) && onDelete(card.id)}>装着完了として削除</button>}
    </div>
  );
}

function AddModal({ onAdd, onClose }: { onAdd: (c: NewLabCard) => void; onClose: () => void }) {
  const [form, setForm] = useState<NewLabCard>({
    patient: "",
    device_category: "labial",
    device_name: "メタルブラケット",
    stage: "impression",
    fitting_date: "",
    visit_date: "",
    memo: "",
  });

  function submit() {
    if (!form.patient || !form.device_name || !form.fitting_date || !form.visit_date) {
      alert("患者名・装置名・装着予定日・来院予定日は必須です");
      return;
    }
    onAdd(form);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>新しいカードを登録</h2><button onClick={onClose}>閉じる</button></div>
        <div className="modal-grid">
          <label>患者名<input placeholder="例：山田 花子" value={form.patient} onChange={e => setForm({ ...form, patient: e.target.value })} /></label>
          <label>装着予定日<input type="date" value={form.fitting_date} onChange={e => setForm({ ...form, fitting_date: e.target.value })} /><small>装置を実際に装着する予定日</small></label>
          <label>装置カテゴリ<select value={form.device_category} onChange={e => { const next = e.target.value as Device; setForm({ ...form, device_category: next, device_name: DEVICE_NAMES[next][0] }); }}>{DEVICES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select></label>
          <label>詳細な装置名<select value={form.device_name} onChange={e => setForm({ ...form, device_name: e.target.value })}>{DEVICE_NAMES[form.device_category].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <label>来院予定日<input type="date" value={form.visit_date} onChange={e => setForm({ ...form, visit_date: e.target.value })} /><small>患者さんが来院する予約日・確認日</small></label>
          <label>現在の進行状況<select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value as Stage })}>{STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
          <label className="memo-field">自由記入欄・メモ<textarea value={form.memo || ""} onChange={e => setForm({ ...form, memo: e.target.value })} placeholder="再スキャン済み、急ぎ依頼など" /></label>
        </div>
        <div className="modal-actions"><button onClick={onClose}>キャンセル</button><button className="primary" onClick={submit}>登録する</button></div>
      </div>
    </div>
  );
}

export default function App() {
  const [checked, setChecked] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [cards, setCards] = useState<LabCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [deviceFilter, setDeviceFilter] = useState<Device | "all">("all");
  const [stageFilter, setStageFilter] = useState<Stage | "all">("all");
  const [scheduleFilter, setScheduleFilter] = useState("all");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (user) loadCards(); else setCards([]); }, [user]);

  async function loadCards() {
    setLoading(true);
    setError("");
    const { data, error } = await supabase.from("lab_cards").select("*").order("created_at", { ascending: true });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setCards((data || []) as LabCard[]);
  }

  async function addCard(card: NewLabCard) {
    setError("");
    const { error } = await supabase.from("lab_cards").insert([card]);
    if (error) { setError(error.message); return; }
    setOpen(false);
    await loadCards();
  }

  async function moveCard(id: string, dir: number) {
    const current = cards.find(c => c.id === id);
    if (!current) return;
    const idx = STAGES.findIndex(s => s.value === current.stage);
    const next = STAGES[idx + dir];
    if (!next) return;
    const { error } = await supabase.from("lab_cards").update({ stage: next.value }).eq("id", id);
    if (error) { setError(error.message); return; }
    await loadCards();
  }

  async function deleteCard(id: string) {
    const { error } = await supabase.from("lab_cards").delete().eq("id", id);
    if (error) { setError(error.message); return; }
    await loadCards();
  }

  async function logout() { await supabase.auth.signOut(); setUser(null); }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter(card => {
      const searchable = [card.patient, card.device_name, labelDevice(card.device_category), labelStage(card.stage), card.fitting_date, card.visit_date, card.memo || ""].join(" ").toLowerCase();
      if (q && !searchable.includes(q)) return false;
      if (deviceFilter !== "all" && card.device_category !== deviceFilter) return false;
      if (stageFilter !== "all" && card.stage !== stageFilter) return false;
      const fd = daysUntil(card.fitting_date);
      const vd = daysUntil(card.visit_date);
      if (scheduleFilter === "today") return fd === 0 || vd === 0;
      if (scheduleFilter === "soon") return (fd >= 0 && fd <= 3) || (vd >= 0 && vd <= 3);
      if (scheduleFilter === "overdue") return card.stage !== "bonding" && (fd < 0 || vd < 0);
      return true;
    });
  }, [cards, query, deviceFilter, stageFilter, scheduleFilter]);

  const urgent = useMemo(() => filtered.map(card => ({ card, r: risk(card) })).filter(x => x.r.level === "critical" || x.r.level === "warning").sort((a, b) => a.r.priority - b.r.priority), [filtered]);

  const stats = useMemo(() => ({
    total: cards.length,
    todayBonding: cards.filter(c => c.stage === "bonding" && daysUntil(c.fitting_date) === 0).length,
    approval: cards.filter(c => c.stage === "approval").length,
    soon: cards.filter(c => {
      const fd = daysUntil(c.fitting_date), vd = daysUntil(c.visit_date);
      return (fd >= 0 && fd <= 3) || (vd >= 0 && vd <= 3);
    }).length,
    overdue: cards.filter(c => c.stage !== "bonding" && (daysUntil(c.fitting_date) < 0 || daysUntil(c.visit_date) < 0)).length,
    riskHigh: cards.filter(c => {
      const r = risk(c);
      return r.level === "critical" || r.level === "warning";
    }).length,
  }), [cards]);

  if (!checked) return <div className="loading">読み込み中...</div>;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="page">
      <div className="container">
        <header className="top-bar">
          <div><h1>技工物 進行表</h1><p>Supabase連携版。PC・スマホ・別PCでカードを共有できます。</p><p className="auth-status">ログイン中: {user.email}</p></div>
          <div className="top-actions"><button onClick={loadCards} disabled={loading}>再読み込み</button><button onClick={logout}>ログアウト</button><button className="primary" onClick={() => setOpen(true)}>+ カード追加</button></div>
        </header>

        {error && <div className="error-panel">エラー: {error}</div>}

        <section className="summary-grid">
          <Summary title="全カード数" value={stats.total} sub="現在管理中の技工物" />
          <Summary title="本日装着" value={stats.todayBonding} sub="装着列かつ本日予定" />
          <Summary title="承認待ち" value={stats.approval} sub="承認列にあるカード" />
          <Summary title="日程が近い" value={stats.soon} sub="装着日または来院日が3日以内" />
          <Summary title="遅延・要対応" value={stats.overdue} sub="未装着で日付超過" />
          <Summary title="間に合わない可能性" value={stats.riskHigh} sub="上部に自動表示されるカード" />
        </section>

        <section className="filters">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="患者名・装置名・日付・メモで検索" />
          <select value={deviceFilter} onChange={e => setDeviceFilter(e.target.value as Device | "all")}><option value="all">全装置カテゴリ</option>{DEVICES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select>
          <select value={stageFilter} onChange={e => setStageFilter(e.target.value as Stage | "all")}><option value="all">全進行状況</option>{STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
          <select value={scheduleFilter} onChange={e => setScheduleFilter(e.target.value)}><option value="all">全日程</option><option value="today">本日関連</option><option value="soon">3日以内</option><option value="overdue">超過のみ</option></select>
        </section>

        {urgent.length > 0 && <section className="urgent-panel"><h2>⚠ 来院日までに間に合わない可能性があるカード</h2><div className="urgent-grid">{urgent.map(({ card, r }) => <div key={`urgent-${card.id}`} className={`urgent-card ${r.level}`}><div className="urgent-head"><strong>{card.patient}</strong><span>{r.label}</span></div><p>{labelDevice(card.device_category)} / {card.device_name}</p><p>現在工程: {labelStage(card.stage)}</p><p>来院予定: {card.visit_date}</p><p>装着予定: {card.fitting_date}</p><small>{r.message}</small></div>)}</div></section>}

        <main className="device-sections">
          {loading ? <div className="loading-card">カードを読み込み中...</div> : DEVICES.filter(d => deviceFilter === "all" || d.value === deviceFilter).map(d => {
            const rowCards = filtered.filter(c => c.device_category === d.value);
            return <section key={d.value} className="device-section"><div className="device-section-header"><div><h2>{d.label}</h2><p>{rowCards.length}件</p></div><span>{d.label}</span></div><div className="stage-grid">{STAGES.map(s => {
              const colCards = rowCards.filter(c => c.stage === s.value);
              return <div key={`${d.value}-${s.value}`} className="stage-cell"><div className="stage-cell-header"><strong>{s.label}</strong><span>{colCards.length}</span></div>{colCards.length === 0 ? <div className="empty">カードなし</div> : <div className="card-stack">{colCards.map(c => <CardView key={c.id} card={c} onMove={moveCard} onDelete={deleteCard} />)}</div>}</div>;
            })}</div></section>;
          })}
        </main>
      </div>
      {open && <AddModal onAdd={addCard} onClose={() => setOpen(false)} />}
    </div>
  );
}
