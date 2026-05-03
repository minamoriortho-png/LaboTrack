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

const FALLBACK_SUPABASE_URL = "https://xiflbktnmjzwdiavfdgz.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "sb_publishable_paj79HmcbGKtvsIHdRHkjg_Nu1G53mp";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

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

function deviceLabel(value: string): string {
  return DEVICES.find((device) => device.value === value)?.label || value;
}

function stageLabel(value: string): string {
  return STAGES.find((stage) => stage.value === value)?.label || value;
}

function daysUntil(dateString: string): number {
  if (!dateString) return 9999;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(`${dateString}T00:00:00`);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function remainingDays(stage: Stage): number {
  const index = STAGES.findIndex((item) => item.value === stage);
  return STAGES.slice(index, STAGES.length - 1).reduce((sum, item) => sum + STAGE_DAYS[item.value], 0);
}

function riskAssessment(card: LabCard) {
  if (card.stage === "bonding") return { level: "done", label: "装着段階", message: "装着工程まで進んでいます", priority: 99 };

  const need = remainingDays(card.stage);
  const remain = Math.min(daysUntil(card.visit_date), daysUntil(card.fitting_date));

  if (remain < 0) return { level: "critical", label: "要至急対応", message: "来院日または装着日を超過しています", priority: 0 };
  if (need > remain) return { level: "critical", label: "間に合わない可能性高", message: `必要日数${need}日に対して残り${remain}日です`, priority: 1 };
  if (need === remain) return { level: "warning", label: "間に合わない可能性あり", message: `必要日数${need}日と残り${remain}日が同じです`, priority: 2 };
  if (remain - need <= 2) return { level: "warning", label: "日程接近", message: `余裕が${remain - need}日しかありません`, priority: 3 };

  return { level: "normal", label: "進行中", message: "現時点では日程に余裕があります", priority: 4 };
}

function dateClass(dateString: string): string {
  const diff = daysUntil(dateString);
  if (diff < 0) return "date danger";
  if (diff <= 2) return "date warning";
  return "date";
}

function fittingLabel(dateString: string): string {
  const diff = daysUntil(dateString);
  if (diff < 0) return `${Math.abs(diff)}日経過`;
  if (diff === 0) return "本日装着";
  return `装着まで${diff}日`;
}

function visitLabel(dateString: string): string {
  const diff = daysUntil(dateString);
  if (diff < 0) return `来院${Math.abs(diff)}日経過`;
  if (diff === 0) return "本日来院予定";
  return `来院まで${diff}日`;
}

function LoginScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      if (error.message === "Invalid login credentials") {
        setErrorMessage("ログインできません。メールアドレス・パスワード・メール確認済みかを確認してください。");
      } else if (error.message.toLowerCase().includes("email not confirmed")) {
        setErrorMessage("メール確認が未完了です。SupabaseのAuthentication > UsersでConfirmしてください。");
      } else {
        setErrorMessage(error.message);
      }
      return;
    }

    if (data.user) onLogin(data.user);
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <h1>技工物 進行表</h1>
        <p>Supabase Authでログインします</p>

        <label>
          メールアドレス
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="staff@example.com" autoComplete="username" />
        </label>

        <label>
          パスワード
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="パスワード" autoComplete="current-password" />
        </label>

        {errorMessage && <div className="error">{errorMessage}</div>}

        <button type="submit" className="primary full" disabled={loading}>
          {loading ? "ログイン中..." : "ログイン"}
        </button>

        <div className="note">
          Supabase Authenticationで作成したユーザーでログインしてください。<br />
          Project URL: {supabaseUrl}
        </div>
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

function CardView({ card, onMove, onDelete }: { card: LabCard; onMove: (id: string, direction: number) => void; onDelete: (id: string) => void }) {
  const risk = riskAssessment(card);
  const stageIndex = STAGES.findIndex((stage) => stage.value === card.stage);

  return (
    <div className={`lab-card ${risk.level}`}>
      <div className="card-top">
        <div>
          <div className="patient">👤 {card.patient}</div>
          <div className="card-id">{card.id.slice(0, 8)}</div>
        </div>
        <div className="badges">
          <span>{deviceLabel(card.device_category)}</span>
          <span className={risk.level}>{risk.label}</span>
        </div>
      </div>

      <div className="card-body">
        <div>📦 {card.device_name}</div>
        <div>📅 装着予定日 {card.fitting_date}</div>
        <div className={dateClass(card.fitting_date)}>{fittingLabel(card.fitting_date)}</div>
        <div>🗓️ 来院予定日 {card.visit_date}</div>
        <div className={dateClass(card.visit_date)}>{visitLabel(card.visit_date)}</div>
        {card.memo && <div className="memo">📝 {card.memo}</div>}
      </div>

      <div className="card-actions">
        <button disabled={stageIndex <= 0} onClick={() => onMove(card.id, -1)}>戻す</button>
        <button className="primary" disabled={stageIndex >= STAGES.length - 1} onClick={() => onMove(card.id, 1)}>次へ</button>
      </div>

      {card.stage === "bonding" && (
        <button className="delete-button" onClick={() => window.confirm(`${card.patient}さんのカードを削除しますか？`) && onDelete(card.id)}>
          装着完了として削除
        </button>
      )}
    </div>
  );
}

function AddModal({ onAdd, onClose }: { onAdd: (card: NewLabCard) => void; onClose: () => void }) {
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
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>新しいカードを登録</h2>
          <button onClick={onClose}>閉じる</button>
        </div>

        <div className="modal-grid">
          <label>
            患者名
            <input placeholder="例：山田 花子" value={form.patient} onChange={(event) => setForm({ ...form, patient: event.target.value })} />
          </label>

          <label>
            装着予定日
            <input type="date" value={form.fitting_date} onChange={(event) => setForm({ ...form, fitting_date: event.target.value })} />
            <small>装置を実際に装着する予定日</small>
          </label>

          <label>
            装置カテゴリ
            <select
              value={form.device_category}
              onChange={(event) => {
                const next = event.target.value as Device;
                setForm({ ...form, device_category: next, device_name: DEVICE_NAMES[next][0] });
              }}
            >
              {DEVICES.map((device) => <option key={device.value} value={device.value}>{device.label}</option>)}
            </select>
          </label>

          <label>
            詳細な装置名
            <select value={form.device_name} onChange={(event) => setForm({ ...form, device_name: event.target.value })}>
              {DEVICE_NAMES[form.device_category].map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>

          <label>
            来院予定日
            <input type="date" value={form.visit_date} onChange={(event) => setForm({ ...form, visit_date: event.target.value })} />
            <small>患者さんが来院する予約日・確認日</small>
          </label>

          <label>
            現在の進行状況
            <select value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value as Stage })}>
              {STAGES.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
            </select>
          </label>

          <label className="memo-field">
            自由記入欄・メモ
            <textarea
              value={form.memo || ""}
              onChange={(event) => setForm({ ...form, memo: event.target.value })}
              placeholder="再スキャン済み、急ぎ依頼など"
            />
          </label>
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>キャンセル</button>
          <button className="primary" onClick={submit}>登録する</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [cards, setCards] = useState<LabCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [query, setQuery] = useState("");
  const [deviceFilter, setDeviceFilter] = useState<Device | "all">("all");
  const [stageFilter, setStageFilter] = useState<Stage | "all">("all");
  const [scheduleFilter, setScheduleFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    async function initAuth() {
      const { data, error } = await supabase.auth.getSession();
      if (error) setErrorMessage(error.message);
      setUser(data.session?.user ?? null);
      setAuthChecked(true);
    }

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) loadCards();
    if (!user) setCards([]);
  }, [user]);

  async function loadCards() {
    setLoadingCards(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("lab_cards")
      .select("*")
      .order("created_at", { ascending: true });

    setLoadingCards(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setCards((data || []) as LabCard[]);
  }

  async function addCard(card: NewLabCard) {
    setErrorMessage("");

    const { error } = await supabase.from("lab_cards").insert([card]);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setModalOpen(false);
    await loadCards();
  }

  async function moveCard(id: string, direction: number) {
    const current = cards.find((card) => card.id === id);
    if (!current) return;

    const currentIndex = STAGES.findIndex((stage) => stage.value === current.stage);
    const nextStage = STAGES[currentIndex + direction];
    if (!nextStage) return;

    const { error } = await supabase
      .from("lab_cards")
      .update({ stage: nextStage.value })
      .eq("id", id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await loadCards();
  }

  async function deleteCard(id: string) {
    const { error } = await supabase.from("lab_cards").delete().eq("id", id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await loadCards();
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  const filteredCards = useMemo(() => {
    const searchText = query.trim().toLowerCase();

    return cards.filter((card) => {
      const searchable = [
        card.patient,
        card.device_name,
        deviceLabel(card.device_category),
        stageLabel(card.stage),
        card.fitting_date,
        card.visit_date,
        card.memo || "",
      ].join(" ").toLowerCase();

      if (searchText && !searchable.includes(searchText)) return false;
      if (deviceFilter !== "all" && card.device_category !== deviceFilter) return false;
      if (stageFilter !== "all" && card.stage !== stageFilter) return false;

      const fittingDiff = daysUntil(card.fitting_date);
      const visitDiff = daysUntil(card.visit_date);

      if (scheduleFilter === "today") return fittingDiff === 0 || visitDiff === 0;
      if (scheduleFilter === "soon") return (fittingDiff >= 0 && fittingDiff <= 3) || (visitDiff >= 0 && visitDiff <= 3);
      if (scheduleFilter === "overdue") return card.stage !== "bonding" && (fittingDiff < 0 || visitDiff < 0);

      return true;
    });
  }, [cards, query, deviceFilter, stageFilter, scheduleFilter]);

  const urgentCards = useMemo(() => {
    return filteredCards
      .map((card) => ({ card, risk: riskAssessment(card) }))
      .filter((item) => item.risk.level === "critical" || item.risk.level === "warning")
      .sort((a, b) => a.risk.priority - b.risk.priority);
  }, [filteredCards]);

  const stats = useMemo(() => {
    return {
      total: cards.length,
      todayBonding: cards.filter((card) => card.stage === "bonding" && daysUntil(card.fitting_date) === 0).length,
      approval: cards.filter((card) => card.stage === "approval").length,
      soon: cards.filter((card) => {
        const fittingDiff = daysUntil(card.fitting_date);
        const visitDiff = daysUntil(card.visit_date);
        return (fittingDiff >= 0 && fittingDiff <= 3) || (visitDiff >= 0 && visitDiff <= 3);
      }).length,
      overdue: cards.filter((card) => card.stage !== "bonding" && (daysUntil(card.fitting_date) < 0 || daysUntil(card.visit_date) < 0)).length,
      riskHigh: cards.filter((card) => {
        const risk = riskAssessment(card);
        return risk.level === "critical" || risk.level === "warning";
      }).length,
    };
  }, [cards]);

  if (!authChecked) return <div className="loading">読み込み中...</div>;

  if (!user) return <LoginScreen onLogin={setUser} />;

  return (
    <div className="page">
      <div className="container">
        <header className="top-bar">
          <div>
            <h1>技工物 進行表</h1>
            <p>Supabase連携版です。PC・スマホ・別PCでカードを共有できます。</p>
            <p className="auth-status">ログイン中: {user.email}</p>
          </div>
          <div className="top-actions">
            <button onClick={loadCards} disabled={loadingCards}>再読み込み</button>
            <button onClick={logout}>ログアウト</button>
            <button className="primary" onClick={() => setModalOpen(true)}>+ カード追加</button>
          </div>
        </header>

        {errorMessage && <div className="error-panel">エラー: {errorMessage}</div>}

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
            {DEVICES.map((device) => <option key={device.value} value={device.value}>{device.label}</option>)}
          </select>
          <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as Stage | "all")}>
            <option value="all">全進行状況</option>
            {STAGES.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
          </select>
          <select value={scheduleFilter} onChange={(event) => setScheduleFilter(event.target.value)}>
            <option value="all">全日程</option>
            <option value="today">本日関連</option>
            <option value="soon">3日以内</option>
            <option value="overdue">超過のみ</option>
          </select>
        </section>

        {urgentCards.length > 0 && (
          <section className="urgent-panel">
            <h2>⚠ 来院日までに間に合わない可能性があるカード</h2>
            <div className="urgent-grid">
              {urgentCards.map(({ card, risk }) => (
                <div key={`urgent-${card.id}`} className={`urgent-card ${risk.level}`}>
                  <div className="urgent-head">
                    <strong>{card.patient}</strong>
                    <span>{risk.label}</span>
                  </div>
                  <p>{deviceLabel(card.device_category)} / {card.device_name}</p>
                  <p>現在工程: {stageLabel(card.stage)}</p>
                  <p>来院予定: {card.visit_date}</p>
                  <p>装着予定: {card.fitting_date}</p>
                  <small>{risk.message}</small>
                </div>
              ))}
            </div>
          </section>
        )}

        <main className="device-sections">
          {loadingCards ? (
            <div className="loading-card">カードを読み込み中...</div>
          ) : (
            DEVICES.filter((device) => deviceFilter === "all" || device.value === deviceFilter).map((device) => {
              const rowCards = filteredCards.filter((card) => card.device_category === device.value);

              return (
                <section key={device.value} className="device-section">
                  <div className="device-section-header">
                    <div>
                      <h2>{device.label}</h2>
                      <p>{rowCards.length}件</p>
                    </div>
                    <span>{device.label}</span>
                  </div>

                  <div className="stage-grid">
                    {STAGES.map((stage) => {
                      const columnCards = rowCards.filter((card) => card.stage === stage.value);

                      return (
                        <div key={`${device.value}-${stage.value}`} className="stage-cell">
                          <div className="stage-cell-header">
                            <strong>{stage.label}</strong>
                            <span>{columnCards.length}</span>
                          </div>

                          {columnCards.length === 0 ? (
                            <div className="empty">カードなし</div>
                          ) : (
                            <div className="card-stack">
                              {columnCards.map((card) => (
                                <CardView key={card.id} card={card} onMove={moveCard} onDelete={deleteCard} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </main>
      </div>

      {modalOpen && <AddModal onAdd={addCard} onClose={() => setModalOpen(false)} />}
    </div>
  );
}
