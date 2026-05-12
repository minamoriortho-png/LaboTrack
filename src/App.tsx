import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

type Card = {
  id: string;
  patient: string;
  device_category: string;
  device_name: string;
  stage: string;
  fitting_date: string;
  visit_date: string;
  memo: string;
};

const STAGES = ["impression", "order", "approval", "delivery", "bonding"];

const STAGE_LABELS: Record<string, string> = {
  impression: "印象",
  order: "発注（プリント）",
  approval: "承認",
  delivery: "納品",
  bonding: "装着",
};

const STAGE_DAYS: Record<string, number> = {
  impression: 1,
  order: 7,
  approval: 14,
  delivery: 0,
  bonding: 0,
};

const DEVICE_CATEGORIES = [
  { value: "labial", label: "ラビアル" },
  { value: "lingual", label: "リンガル" },
  { value: "aligner", label: "アライナー" },
  { value: "band", label: "バンド系装置" },
  { value: "retainer", label: "リテーナー" },
  { value: "other", label: "その他" },
];

const RETAINER_OPTIONS = [
  "プレートタイプ",
  "クリアリテーナー",
  "ボンデッドリンガルリテーナー",
];

const OTHER_OPTIONS = ["バイトチェック", "TPA", "その他"];

function getDeviceLabel(value: string) {
  return DEVICE_CATEGORIES.find((category) => category.value === value)?.label || value;
}

function getStageLabel(value: string) {
  return STAGE_LABELS[value] || value;
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

function remainingLeadDays(stage: string) {
  const stageIndex = STAGES.indexOf(stage);
  if (stageIndex === -1) return 0;
  return STAGES.slice(stageIndex, STAGES.length - 1).reduce((sum, currentStage) => {
    return sum + (STAGE_DAYS[currentStage] || 0);
  }, 0);
}

function riskAssessment(card: Card) {
  if (card.stage === "bonding") {
    return {
      level: "done",
      label: "装着段階",
      message: "装着工程まで進んでいます",
      priority: 99,
    };
  }

  const need = remainingLeadDays(card.stage);
  const remain = Math.min(daysUntil(card.visit_date), daysUntil(card.fitting_date));

  if (remain < 0) {
    return {
      level: "critical",
      label: "要至急対応",
      message: "来院日または装着日を超過しています",
      priority: 0,
    };
  }

  if (need > remain) {
    return {
      level: "critical",
      label: "間に合わない可能性高",
      message: `残り必要日数${need}日に対して残り${remain}日です`,
      priority: 1,
    };
  }

  if (need === remain) {
    return {
      level: "warning",
      label: "間に合わない可能性あり",
      message: `残り必要日数${need}日と残り${remain}日が同じです`,
      priority: 2,
    };
  }

  if (remain - need <= 2) {
    return {
      level: "warning",
      label: "日程接近",
      message: `必要日数差が${remain - need}日しかありません`,
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

function dateLabel(dateString: string, type: "fit" | "visit") {
  const diff = daysUntil(dateString);
  if (diff < 0) return `${Math.abs(diff)}日経過`;
  if (diff === 0) return type === "fit" ? "本日装着" : "本日来院予定";
  return type === "fit" ? `装着まで${diff}日` : `来院まで${diff}日`;
}

function dateClass(dateString: string) {
  const diff = daysUntil(dateString);
  if (diff < 0) return "date danger";
  if (diff <= 2) return "date warning";
  return "date";
}

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
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      load();
    } else {
      setCards([]);
    }
  }, [user]);

  async function load() {
    setErrorMessage("");
    const { data, error } = await supabase
      .from("lab_cards")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setCards(data || []);
  }

  async function login(email: string, password: string) {
    setErrorMessage("");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (!error) {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user);
    } else {
      setErrorMessage(error.message);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  async function add(card: Omit<Card, "id">) {
    setErrorMessage("");
    const { error } = await supabase.from("lab_cards").insert([card]);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setModalOpen(false);
    load();
  }

  async function move(id: string, dir: number) {
    const card = cards.find((c) => c.id === id);
    if (!card) return;

    const idx = STAGES.indexOf(card.stage);
    const next = STAGES[idx + dir];
    if (!next) return;

    setErrorMessage("");
    const { error } = await supabase.from("lab_cards").update({ stage: next }).eq("id", id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    load();
  }

  async function remove(id: string) {
    setErrorMessage("");
    const { error } = await supabase.from("lab_cards").delete().eq("id", id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    load();
  }

  const filteredCards = useMemo(() => {
    const searchText = query.trim().toLowerCase();

    return cards.filter((card) => {
      const searchable = [
        card.patient,
        card.device_name,
        getDeviceLabel(card.device_category),
        getStageLabel(card.stage),
        card.fitting_date,
        card.visit_date,
        card.memo || "",
      ]
        .join(" ")
        .toLowerCase();

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
      .filter(({ risk }) => risk.level === "critical" || risk.level === "warning")
      .sort((a, b) => {
        if (a.risk.priority !== b.risk.priority) return a.risk.priority - b.risk.priority;
        const aMin = Math.min(daysUntil(a.card.visit_date), daysUntil(a.card.fitting_date));
        const bMin = Math.min(daysUntil(b.card.visit_date), daysUntil(b.card.fitting_date));
        return aMin - bMin;
      });
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

  if (loading) return <div className="loading">読み込み中...</div>;

  if (!user) return <Login onLogin={login} errorMessage={errorMessage} />;

  return (
    <div className="page">
      <header className="topBar">
        <div>
          <h1>技工物 進行表</h1>
          <p>来院日までに間に合わない可能性があるカードを最上部に自動表示します。</p>
          <p className="small">ログイン中: {user.email}</p>
        </div>
        <div className="topActions">
          <button onClick={load}>再読み込み</button>
          <button onClick={logout}>ログアウト</button>
          <button className="primary" onClick={() => setModalOpen(true)}>+ カード追加</button>
        </div>
      </header>

      {errorMessage && <div className="errorBox">エラー: {errorMessage}</div>}

      <section className="summaryGrid">
        <Summary title="全カード数" value={stats.total} sub="現在管理中の技工物" />
        <Summary title="本日装着" value={stats.todayBonding} sub="装着列かつ本日予定" />
        <Summary title="承認待ち" value={stats.approval} sub="承認列にあるカード" />
        <Summary title="日程が近い" value={stats.soon} sub="装着日または来院日が3日以内" />
        <Summary title="遅延・要対応" value={stats.overdue} sub="未装着で日付超過" />
        <Summary title="間に合わない可能性" value={stats.riskHigh} sub="上部に自動表示" />
      </section>

      <section className="filters">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="患者名・装置名・日付・メモで検索" />
        <select value={deviceFilter} onChange={(event) => setDeviceFilter(event.target.value)}>
          <option value="all">全装置カテゴリ</option>
          {DEVICE_CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>{category.label}</option>
          ))}
        </select>
        <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
          <option value="all">全進行状況</option>
          {STAGES.map((stage) => (
            <option key={stage} value={stage}>{getStageLabel(stage)}</option>
          ))}
        </select>
        <select value={scheduleFilter} onChange={(event) => setScheduleFilter(event.target.value)}>
          <option value="all">全日程</option>
          <option value="today">本日関連</option>
          <option value="soon">3日以内</option>
          <option value="overdue">超過のみ</option>
        </select>
      </section>

      {urgentCards.length > 0 && (
        <section className="urgentPanel">
          <h2>⚠ 来院日までに間に合わない可能性があるカード</h2>
          <div className="urgentGrid">
            {urgentCards.map(({ card, risk }) => (
              <div key={`urgent-${card.id}`} className={`urgentCard ${risk.level}`}>
                <div className="urgentHead">
                  <strong>{card.patient}</strong>
                  <span>{risk.label}</span>
                </div>
                <p>{getDeviceLabel(card.device_category)} / {card.device_name}</p>
                <p>現在工程: {getStageLabel(card.stage)}</p>
                <p>来院予定: {card.visit_date}</p>
                <p>装着予定: {card.fitting_date}</p>
                <small>{risk.message}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      <main className="deviceSections">
        {DEVICE_CATEGORIES.filter((category) => deviceFilter === "all" || category.value === deviceFilter).map((category) => {
          const categoryCards = filteredCards.filter((card) => card.device_category === category.value);

          return (
            <section key={category.value} className="deviceSection">
              <div className="deviceSectionHeader">
                <div>
                  <h2>{category.label}</h2>
                  <p>{categoryCards.length}件</p>
                </div>
                <span>{category.label}</span>
              </div>

              <div className="stageGrid">
                {STAGES.map((stage) => {
                  const stageCards = categoryCards.filter((card) => card.stage === stage);

                  return (
                    <div key={`${category.value}-${stage}`} className="stageCell">
                      <div className="stageCellHeader">
                        <strong>{getStageLabel(stage)}</strong>
                        <span>{stageCards.length}</span>
                      </div>

                      {stageCards.length === 0 ? (
                        <div className="empty">カードなし</div>
                      ) : (
                        <div className="cardStack">
                          {stageCards.map((card) => (
                            <CardView key={card.id} card={card} onMove={move} onDelete={remove} />
                          ))}
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

      {modalOpen && <AddModal onAdd={add} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

function Login({ onLogin, errorMessage }: { onLogin: (e: string, p: string) => void; errorMessage: string }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  return (
    <div className="loginPage">
      <div className="loginCard">
        <h2>ログイン</h2>
        <p>Supabase Authenticationで作成したユーザーでログインしてください。</p>
        <label>メールアドレス<input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>パスワード<input type="password" value={pass} onChange={(e) => setPass(e.target.value)} /></label>
        {errorMessage && <div className="errorText">{errorMessage}</div>}
        <button className="primary" onClick={() => onLogin(email, pass)}>ログイン</button>
      </div>
    </div>
  );
}

function Summary({ title, value, sub }: { title: string; value: number; sub: string }) {
  return (
    <div className="summaryCard">
      <div className="summaryTitle">{title}</div>
      <div className="summaryValue">{value}</div>
      <div className="summarySub">{sub}</div>
    </div>
  );
}

function CardView({ card, onMove, onDelete }: { card: Card; onMove: (id: string, dir: number) => void; onDelete: (id: string) => void }) {
  const risk = riskAssessment(card);
  const stageIndex = STAGES.indexOf(card.stage);

  return (
    <div className={`labCard ${risk.level}`}>
      <div className="cardTop">
        <div>
          <strong>{card.patient}</strong>
          <div className="cardId">{card.id.slice(0, 8)}</div>
        </div>
        <div className="badges">
          <span>{getDeviceLabel(card.device_category)}</span>
          <span className={risk.level}>{risk.label}</span>
        </div>
      </div>
      <div className="cardBody">
        <div>装置名：{card.device_name}</div>
        <div>装着予定日：{card.fitting_date}</div>
        <div className={dateClass(card.fitting_date)}>{dateLabel(card.fitting_date, "fit")}</div>
        <div>来院予定日：{card.visit_date}</div>
        <div className={dateClass(card.visit_date)}>{dateLabel(card.visit_date, "visit")}</div>
        {card.memo && <div className="memo">メモ：{card.memo}</div>}
      </div>
      <div className="cardActions">
        <button disabled={stageIndex <= 0} onClick={() => onMove(card.id, -1)}>戻す</button>
        <button className="primary" disabled={stageIndex >= STAGES.length - 1} onClick={() => onMove(card.id, 1)}>次へ</button>
      </div>
      {card.stage === "bonding" && (
        <button className="deleteButton" onClick={() => window.confirm(`${card.patient}さんのカードを削除しますか？`) && onDelete(card.id)}>
          装着完了として削除
        </button>
      )}
    </div>
  );
}

function AddModal({ onAdd, onClose }: { onAdd: (c: any) => void; onClose: () => void }) {
  const [f, setF] = useState({
    patient: "",
    device_category: "labial",
    device_name: "",
    stage: "impression",
    fitting_date: "",
    visit_date: "",
    memo: "",
  });

  function submit() {
    if (!f.patient || !f.device_name || !f.fitting_date || !f.visit_date) {
      alert("患者名・詳細な装置名・装着予定日・来院予定日は必須です");
      return;
    }
    onAdd(f);
  }

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modalHeader">
          <h2>新しいカードを登録</h2>
          <button onClick={onClose}>閉じる</button>
        </div>

        <div className="modalGrid">
          <label>患者名<input value={f.patient} placeholder="例：山田 花子" onChange={(e) => setF({ ...f, patient: e.target.value })} /></label>

          <label>装着予定日<input type="date" value={f.fitting_date} onChange={(e) => setF({ ...f, fitting_date: e.target.value })} /><small>装置を実際に装着する予定日</small></label>

          <label>装置カテゴリ<select value={f.device_category} onChange={(e) => setF({ ...f, device_category: e.target.value, device_name: "" })}>{DEVICE_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>

          <label>詳細な装置名{f.device_category === "retainer" ? (<select value={f.device_name} onChange={(e) => setF({ ...f, device_name: e.target.value })}><option value="">リテーナー種類を選択</option>{RETAINER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>) : f.device_category === "other" ? (<select value={f.device_name} onChange={(e) => setF({ ...f, device_name: e.target.value })}><option value="">その他の装置名を選択</option>{OTHER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>) : (<input value={f.device_name} placeholder="装置名" onChange={(e) => setF({ ...f, device_name: e.target.value })} />)}</label>

          <label>来院予定日<input type="date" value={f.visit_date} onChange={(e) => setF({ ...f, visit_date: e.target.value })} /><small>患者さんが来院する予約日・確認日</small></label>

          <label>現在の進行状況<select value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}>{STAGES.map((stage) => <option key={stage} value={stage}>{getStageLabel(stage)}</option>)}</select></label>

          <label className="memoField">自由記入欄・メモ<textarea value={f.memo} placeholder="再スキャン済み、急ぎ依頼など" onChange={(e) => setF({ ...f, memo: e.target.value })} /></label>
        </div>

        <div className="modalActions">
          <button onClick={onClose}>キャンセル</button>
          <button className="primary" onClick={submit}>登録する</button>
        </div>
      </div>
    </div>
  );
}

const style = document.createElement("style");
style.innerHTML = `
*{box-sizing:border-box}body{margin:0;color:#0f172a;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f8fafc}button,input,select,textarea{font:inherit}button{border:1px solid #cbd5e1;border-radius:14px;padding:10px 14px;background:#fff;cursor:pointer;font-weight:700}button:disabled{cursor:not-allowed;opacity:.45}input,select,textarea{width:100%;border:1px solid #cbd5e1;border-radius:14px;padding:10px 12px;background:#fff}textarea{min-height:92px;resize:vertical}.primary{border-color:#0f172a;background:#0f172a;color:#fff}.loading{min-height:100vh;display:grid;place-items:center;color:#64748b}.page{padding:24px;display:grid;gap:20px}.topBar{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start}.topBar h1{margin:0;font-size:32px}.topBar p{margin:8px 0 0;color:#64748b}.small{font-size:12px}.topActions{display:flex;gap:8px;flex-wrap:wrap}.errorBox{padding:12px 16px;border-radius:16px;border:1px solid #fecdd3;background:#fff1f2;color:#be123c;font-weight:700}.summaryGrid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.summaryCard,.filters,.urgentPanel,.deviceSection,.stageCell,.labCard,.modal,.loginCard{background:#fff;border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 1px 2px rgba(15,23,42,.04)}.summaryCard{padding:16px}.summaryTitle{font-size:12px;color:#64748b}.summaryValue{margin-top:4px;font-size:28px;font-weight:800}.summarySub{margin-top:4px;color:#94a3b8;font-size:12px}.filters{display:grid;grid-template-columns:minmax(280px,1fr) 220px 220px 220px;gap:12px;padding:16px}.urgentPanel{padding:16px;border-color:#fecdd3;background:#fff1f2}.urgentPanel h2{margin:0 0 12px;color:#9f1239;font-size:18px}.urgentGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.urgentCard{display:grid;gap:6px;padding:14px;border-radius:18px;border:1px solid #e2e8f0;background:#fff}.urgentHead{display:flex;justify-content:space-between;gap:8px}.urgentHead span{width:fit-content;border-radius:999px;padding:4px 8px;font-size:11px;font-weight:800}.urgentCard.critical{border-color:#fda4af;background:#fff1f2}.urgentCard.critical span{background:#ffe4e6;color:#be123c}.urgentCard.warning{border-color:#fcd34d;background:#fffbeb}.urgentCard.warning span{background:#fef3c7;color:#b45309}.urgentCard p{margin:0;font-size:13px}.urgentCard small{color:#475569}.deviceSections{display:grid;gap:20px;overflow-x:auto}.deviceSection{min-width:1180px;padding:16px;border-radius:24px}.deviceSectionHeader{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.deviceSectionHeader h2{margin:0;font-size:20px}.deviceSectionHeader p{margin:4px 0 0;color:#64748b;font-size:13px}.deviceSectionHeader>span,.stageCellHeader span,.badges span{border-radius:999px;padding:4px 8px;background:#f1f5f9;color:#334155;font-size:11px;font-weight:800}.stageGrid{display:grid;grid-template-columns:repeat(5,minmax(220px,1fr));gap:12px;align-items:start}.stageCell{min-height:220px;display:grid;grid-template-rows:auto 1fr;align-content:start;padding:12px;background:#f8fafc}.stageCellHeader{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}.empty{min-height:150px;display:grid;place-items:center;border:1px dashed #cbd5e1;border-radius:20px;color:#94a3b8}.cardStack{display:grid;gap:12px}.labCard{display:grid;gap:12px;padding:14px}.labCard.critical{border-color:#fda4af;background:#fff1f2}.labCard.warning{border-color:#fcd34d;background:#fffbeb}.labCard.done{border-color:#86efac;background:#ecfdf5}.cardTop{display:flex;justify-content:space-between;gap:8px}.cardId{margin-top:4px;color:#94a3b8;font-size:11px}.badges{display:grid;gap:6px;justify-items:end}.badges span.critical{background:#ffe4e6;color:#be123c}.badges span.warning{background:#fef3c7;color:#b45309}.badges span.done{background:#d1fae5;color:#047857}.cardBody{display:grid;gap:8px;color:#334155;font-size:13px}.date{color:#64748b;font-size:11px}.date.warning{color:#d97706}.date.danger{color:#e11d48}.memo{padding:8px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;color:#475569;line-height:1.6}.cardActions{display:flex;gap:8px}.cardActions button{flex:1}.deleteButton{width:100%;border-color:#fecdd3;background:#ffe4e6;color:#be123c}.loginPage{min-height:100vh;display:grid;place-items:center;padding:24px}.loginCard{width:100%;max-width:420px;padding:24px;display:grid;gap:12px}.loginCard h2{margin:0}.loginCard p{color:#64748b;margin:0}.loginCard label,.modalGrid label{display:grid;gap:6px;font-size:13px;font-weight:800;color:#334155}.loginCard small,.modalGrid small{color:#94a3b8;font-size:11px;font-weight:500}.errorText{color:#be123c;font-size:13px}.modalBackdrop{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:20px;background:rgba(15,23,42,.35)}.modal{width:100%;max-width:760px;padding:20px;max-height:calc(100vh - 40px);overflow-y:auto}.modalHeader,.modalActions{display:flex;justify-content:space-between;align-items:center;gap:12px}.modalHeader h2{margin:0}.modalGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px}.memoField{grid-column:1/-1}.modalActions{justify-content:flex-end;margin-top:16px}@media(max-width:1200px){.summaryGrid,.urgentGrid{grid-template-columns:repeat(3,minmax(0,1fr))}.filters{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:760px){.page{padding:12px}.topBar h1{font-size:24px}.topActions{width:100%}.topActions button{flex:1}.summaryGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.filters{grid-template-columns:1fr}.urgentGrid{grid-template-columns:1fr}.deviceSections{overflow-x:visible}.deviceSection{min-width:0;padding:12px}.stageGrid{grid-template-columns:1fr}.stageCell{min-height:auto}.modalGrid{grid-template-columns:1fr}.modal{max-height:calc(100vh - 24px)}}
`;
if (!document.head.querySelector("style[data-lab-progress]")) {
  style.setAttribute("data-lab-progress", "true");
  document.head.appendChild(style);
}
