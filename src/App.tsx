import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

type Card = { id: string; patient: string; device_category: string; device_name: string; stage: string; fitting_date: string; visit_date: string; memo: string; };
type Risk = { level: string; label: string; message: string; priority: number; };

const STAGES = ["impression", "order", "approval", "delivery", "bonding"];
const STAGE_LABELS: Record<string, string> = { impression: "印象", order: "発注（プリント）", approval: "承認", delivery: "納品", bonding: "装着" };
const STAGE_DAYS: Record<string, number> = { impression: 1, order: 7, approval: 14, delivery: 0, bonding: 0 };
const DEVICE_CATEGORIES = [
  { value: "labial", label: "ラビアル" },
  { value: "lingual", label: "リンガル" },
  { value: "aligner", label: "アライナー" },
  { value: "band", label: "バンド系装置" },
  { value: "retainer", label: "リテーナー" },
  { value: "other", label: "その他" },
];
const LABIAL_OPTIONS = ["INSIGNIA", "ODB", "InhouseIDB", "DBS"];
const LINGUAL_OPTIONS = ["WINsystem", "ハーモニー"];
const ALIGNER_OPTIONS = ["Angel Aligner", "SPARK", "Inhouse Aligner"];
const RETAINER_OPTIONS = ["プレートタイプ", "クリアリテーナー", "ボンデッドリンガルリテーナー"];
const OTHER_OPTIONS = ["バイトチェック", "TPA", "その他"];

function getDeviceLabel(v: string) { return DEVICE_CATEGORIES.find((c) => c.value === v)?.label || v; }
function getStageLabel(v: string) { return STAGE_LABELS[v] || v; }
function todayStart() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
function daysUntil(dateString: string) { if (!dateString) return 9999; const t = new Date(`${dateString}T00:00:00`); return Math.ceil((t.getTime() - todayStart().getTime()) / 86400000); }
function remainingLeadDays(stage: string) { const i = STAGES.indexOf(stage); if (i < 0) return 0; return STAGES.slice(i, STAGES.length - 1).reduce((sum, s) => sum + (STAGE_DAYS[s] || 0), 0); }
function riskAssessment(card: Card): Risk {
  if (card.stage === "bonding") return { level: "done", label: "装着段階", message: "装着工程まで進んでいます", priority: 99 };
  const need = remainingLeadDays(card.stage);
  const remain = Math.min(daysUntil(card.visit_date), daysUntil(card.fitting_date));
  if (remain < 0) return { level: "critical", label: "要至急対応", message: "来院日または装着日を超過しています", priority: 0 };
  if (need > remain) return { level: "critical", label: "間に合わない可能性高", message: `残り必要日数${need}日に対して残り${remain}日です`, priority: 1 };
  if (need === remain) return { level: "warning", label: "間に合わない可能性あり", message: `残り必要日数${need}日と残り${remain}日が同じです`, priority: 2 };
  if (remain - need <= 2) return { level: "warning", label: "日程接近", message: `必要日数差が${remain - need}日しかありません`, priority: 3 };
  return { level: "normal", label: "進行中", message: "現時点では日程に余裕があります", priority: 4 };
}
function dateLabel(dateString: string, type: "fit" | "visit") { const d = daysUntil(dateString); if (d < 0) return `${Math.abs(d)}日経過`; if (d === 0) return type === "fit" ? "本日装着" : "本日来院予定"; return type === "fit" ? `装着まで${d}日` : `来院まで${d}日`; }
function dateClass(dateString: string) { const d = daysUntil(dateString); if (d < 0) return "date danger"; if (d <= 2) return "date warning"; return "date"; }

export default function App() {
  const [cards, setCards] = useState<Card[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [scheduleFilter, setScheduleFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => { if (error) setErrorMessage(error.message); setUser(data.session?.user ?? null); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (user) load(); else setCards([]); }, [user]);

  async function load() { setErrorMessage(""); const { data, error } = await supabase.from("lab_cards").select("*").order("created_at", { ascending: true }); if (error) { setErrorMessage(error.message); return; } setCards(data || []); }
  async function login(email: string, password: string) { setErrorMessage(""); const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (!error) { const { data } = await supabase.auth.getSession(); setUser(data.session?.user); } else setErrorMessage(error.message); }
  async function logout() { await supabase.auth.signOut(); setUser(null); }
  async function add(card: Omit<Card, "id">) { setErrorMessage(""); const { error } = await supabase.from("lab_cards").insert([card]); if (error) { setErrorMessage(error.message); return; } setModalOpen(false); await load(); }
  async function move(id: string, dir: number) { const card = cards.find((c) => c.id === id); if (!card) return; const idx = STAGES.indexOf(card.stage); const next = STAGES[idx + dir]; if (!next) return; const { error } = await supabase.from("lab_cards").update({ stage: next }).eq("id", id); if (error) { setErrorMessage(error.message); return; } await load(); }
  async function remove(id: string) { const { error } = await supabase.from("lab_cards").delete().eq("id", id); if (error) { setErrorMessage(error.message); return; } await load(); }

  const filteredCards = useMemo(() => {
    const searchText = query.trim().toLowerCase();
    return cards.filter((card) => {
      const searchable = [card.patient, card.device_name, getDeviceLabel(card.device_category), getStageLabel(card.stage), card.fitting_date, card.visit_date, card.memo || ""].join(" ").toLowerCase();
      if (searchText && !searchable.includes(searchText)) return false;
      if (deviceFilter !== "all" && card.device_category !== deviceFilter) return false;
      if (stageFilter !== "all" && card.stage !== stageFilter) return false;
      const fd = daysUntil(card.fitting_date), vd = daysUntil(card.visit_date);
      if (scheduleFilter === "today") return fd === 0 || vd === 0;
      if (scheduleFilter === "soon") return (fd >= 0 && fd <= 3) || (vd >= 0 && vd <= 3);
      if (scheduleFilter === "overdue") return card.stage !== "bonding" && (fd < 0 || vd < 0);
      return true;
    });
  }, [cards, query, deviceFilter, stageFilter, scheduleFilter]);
  const urgentCards = useMemo(() => filteredCards.map((card) => ({ card, risk: riskAssessment(card) })).filter(({ risk }) => risk.level === "critical" || risk.level === "warning").sort((a, b) => a.risk.priority - b.risk.priority), [filteredCards]);
  const stats = useMemo(() => ({
    total: cards.length,
    todayBonding: cards.filter((c) => c.stage === "bonding" && daysUntil(c.fitting_date) === 0).length,
    approval: cards.filter((c) => c.stage === "approval").length,
    soon: cards.filter((c) => { const fd = daysUntil(c.fitting_date), vd = daysUntil(c.visit_date); return (fd >= 0 && fd <= 3) || (vd >= 0 && vd <= 3); }).length,
    overdue: cards.filter((c) => c.stage !== "bonding" && (daysUntil(c.fitting_date) < 0 || daysUntil(c.visit_date) < 0)).length,
    riskHigh: cards.filter((c) => { const r = riskAssessment(c); return r.level === "critical" || r.level === "warning"; }).length,
  }), [cards]);

  if (loading) return <div className="loading">読み込み中...</div>;
  if (!user) return <Login onLogin={login} errorMessage={errorMessage} />;

  return <div className="page">
    <header className="topBar"><div><h1>技工物 進行表</h1><p>来院日までに間に合わない可能性があるカードを最上部に自動表示します。</p><p className="small">ログイン中: {user.email}</p></div><div className="topActions"><button onClick={load}>再読み込み</button><button onClick={logout}>ログアウト</button><button className="primary" onClick={() => setModalOpen(true)}>+ カード追加</button></div></header>
    {errorMessage && <div className="errorBox">エラー: {errorMessage}</div>}
    <section className="summaryGrid"><Summary title="全カード数" value={stats.total} sub="現在管理中の技工物"/><Summary title="本日装着" value={stats.todayBonding} sub="装着列かつ本日予定"/><Summary title="承認待ち" value={stats.approval} sub="承認列にあるカード"/><Summary title="日程が近い" value={stats.soon} sub="装着日または来院日が3日以内"/><Summary title="遅延・要対応" value={stats.overdue} sub="未装着で日付超過"/><Summary title="間に合わない可能性" value={stats.riskHigh} sub="上部に自動表示"/></section>
    <section className="filters"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="患者名・装置名・日付・メモで検索"/><select value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)}><option value="all">全装置カテゴリ</option>{DEVICE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select><select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}><option value="all">全進行状況</option>{STAGES.map((s) => <option key={s} value={s}>{getStageLabel(s)}</option>)}</select><select value={scheduleFilter} onChange={(e) => setScheduleFilter(e.target.value)}><option value="all">全日程</option><option value="today">本日関連</option><option value="soon">3日以内</option><option value="overdue">超過のみ</option></select></section>
    {urgentCards.length > 0 && <section className="urgentPanel"><h2>⚠ 来院日までに間に合わない可能性があるカード</h2><div className="urgentGrid">{urgentCards.map(({card, risk}) => <div key={`urgent-${card.id}`} className={`urgentCard ${risk.level}`}><div className="urgentHead"><strong>{card.patient}</strong><span>{risk.label}</span></div><p>{getDeviceLabel(card.device_category)} / {card.device_name}</p><p>現在工程: {getStageLabel(card.stage)}</p><p>来院予定: {card.visit_date}</p><p>装着予定: {card.fitting_date}</p><small>{risk.message}</small></div>)}</div></section>}
    <main className="deviceSections">{DEVICE_CATEGORIES.filter((c) => deviceFilter === "all" || c.value === deviceFilter).map((category) => { const categoryCards = filteredCards.filter((card) => card.device_category === category.value); return <section key={category.value} className="deviceSection"><div className="deviceSectionHeader"><div><h2>{category.label}</h2><p>{categoryCards.length}件</p></div><span>{category.label}</span></div><div className="stageGrid">{STAGES.map((stage) => { const stageCards = categoryCards.filter((card) => card.stage === stage); return <div key={`${category.value}-${stage}`} className="stageCell"><div className="stageCellHeader"><strong>{getStageLabel(stage)}</strong><span>{stageCards.length}</span></div>{stageCards.length === 0 ? <div className="empty">カードなし</div> : <div className="cardStack">{stageCards.map((card) => <CardView key={card.id} card={card} onMove={move} onDelete={remove}/>)}</div>}</div>; })}</div></section>; })}</main>
    {modalOpen && <AddModal onAdd={add} onClose={() => setModalOpen(false)}/>} 
  </div>;
}

function Login({ onLogin, errorMessage }: { onLogin: (e: string, p: string) => void; errorMessage: string }) { const [email, setEmail] = useState(""); const [pass, setPass] = useState(""); return <div className="loginPage"><div className="loginCard"><h2>ログイン</h2><p>Supabase Authenticationで作成したユーザーでログインしてください。</p><label>メールアドレス<input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email"/></label><label>パスワード<input type="password" value={pass} onChange={(e) => setPass(e.target.value)}/></label>{errorMessage && <div className="errorText">{errorMessage}</div>}<button className="primary" onClick={() => onLogin(email, pass)}>ログイン</button></div></div>; }
function Summary({ title, value, sub }: { title: string; value: number; sub: string }) { return <div className="summaryCard"><div className="summaryTitle">{title}</div><div className="summaryValue">{value}</div><div className="summarySub">{sub}</div></div>; }
function CardView({ card, onMove, onDelete }: { card: Card; onMove: (id: string, dir: number) => void; onDelete: (id: string) => void }) { const risk = riskAssessment(card); const stageIndex = STAGES.indexOf(card.stage); return <div className={`labCard ${risk.level}`}><div className="cardTop"><div><strong>{card.patient}</strong><div className="cardId">{card.id.slice(0, 8)}</div></div><div className="badges"><span>{getDeviceLabel(card.device_category)}</span><span className={risk.level}>{risk.label}</span></div></div><div className="cardBody"><div>装置名：{card.device_name}</div><div>装着予定日：{card.fitting_date}</div><div className={dateClass(card.fitting_date)}>{dateLabel(card.fitting_date, "fit")}</div><div>来院予定日：{card.visit_date}</div><div className={dateClass(card.visit_date)}>{dateLabel(card.visit_date, "visit")}</div>{card.memo && <div className="memo">メモ：{card.memo}</div>}</div><div className="cardActions"><button disabled={stageIndex <= 0} onClick={() => onMove(card.id, -1)}>戻す</button><button className="primary" disabled={stageIndex >= STAGES.length - 1} onClick={() => onMove(card.id, 1)}>次へ</button></div>{card.stage === "bonding" && <button className="deleteButton" onClick={() => window.confirm(`${card.patient}さんのカードを削除しますか？`) && onDelete(card.id)}>装着完了として削除</button>}</div>; }
function AddModal({ onAdd, onClose }: { onAdd: (c: Omit<Card, "id">) => void; onClose: () => void }) {
  const [f, setF] = useState({ patient: "", device_category: "labial", device_name: "", stage: "impression", fitting_date: "", visit_date: "", memo: "" });
  function submit() { if (!f.patient || !f.device_name || !f.fitting_date || !f.visit_date) { alert("患者名・詳細な装置名・装着予定日・来院予定日は必須です"); return; } onAdd(f); }
  function optionSelect(label: string, options: string[]) { return <select value={f.device_name} onChange={(e) => setF({ ...f, device_name: e.target.value })}><option value="">{label}</option>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select>; }
  function renderDeviceNameInput() { if (f.device_category === "labial") return optionSelect("ラビアルの装置名を選択", LABIAL_OPTIONS); if (f.device_category === "lingual") return optionSelect("リンガルの装置名を選択", LINGUAL_OPTIONS); if (f.device_category === "aligner") return optionSelect("アライナーの装置名を選択", ALIGNER_OPTIONS); if (f.device_category === "retainer") return optionSelect("リテーナー種類を選択", RETAINER_OPTIONS); if (f.device_category === "other") return optionSelect("その他の装置名を選択", OTHER_OPTIONS); return <input value={f.device_name} placeholder="装置名" onChange={(e) => setF({ ...f, device_name: e.target.value })}/>; }
  return <div className="modalBackdrop" onClick={onClose}><div className="modal" onClick={(e) => e.stopPropagation()}><div className="modalHeader"><h2>新しいカードを登録</h2><button onClick={onClose}>閉じる</button></div><div className="modalGrid"><label>患者名<input value={f.patient} placeholder="例：山田 花子" onChange={(e) => setF({ ...f, patient: e.target.value })}/></label><label>装着予定日<input type="date" value={f.fitting_date} onChange={(e) => setF({ ...f, fitting_date: e.target.value })}/><small>装置を実際に装着する予定日</small></label><label>装置カテゴリ<select value={f.device_category} onChange={(e) => setF({ ...f, device_category: e.target.value, device_name: "" })}>{DEVICE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label><label>詳細な装置名{renderDeviceNameInput()}</label><label>来院予定日<input type="date" value={f.visit_date} onChange={(e) => setF({ ...f, visit_date: e.target.value })}/><small>患者さんが来院する予約日・確認日</small></label><label>現在の進行状況<select value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}>{STAGES.map((s) => <option key={s} value={s}>{getStageLabel(s)}</option>)}</select></label><label className="memoField">自由記入欄・メモ<textarea value={f.memo} placeholder="再スキャン済み、急ぎ依頼など" onChange={(e) => setF({ ...f, memo: e.target.value })}/></label></div><div className="modalActions"><button onClick={onClose}>キャンセル</button><button className="primary" onClick={submit}>登録する</button></div></div></div>;
}
