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

const OTHER_OPTIONS = [
  "バイトチェック",
  "TPA",
  "その他",
];

function getDeviceLabel(value: string) {
  return DEVICE_CATEGORIES.find((category) => category.value === value)?.label || value;
}

function getStageLabel(value: string) {
  return STAGE_LABELS[value] || value;
}

export default function App() {
  const [cards, setCards] = useState<Card[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [deviceFilter, setDeviceFilter] = useState("all");

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

    load();
  }

  async function move(id: string, dir: number) {
    const c = cards.find((card) => card.id === id);
    if (!c) return;

    const idx = STAGES.indexOf(c.stage);
    const next = STAGES[idx + dir];
    if (!next) return;

    setErrorMessage("");

    const { error } = await supabase
      .from("lab_cards")
      .update({ stage: next })
      .eq("id", id);

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

  const visibleCards = useMemo(() => {
    if (deviceFilter === "all") return cards;
    return cards.filter((card) => card.device_category === deviceFilter);
  }, [cards, deviceFilter]);

  if (loading) {
    return <div className="loading">読み込み中...</div>;
  }

  if (!user) {
    return <Login onLogin={login} errorMessage={errorMessage} />;
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>技工物 進行管理</h1>
          <p>Supabase連携版。PC・スマホ・別PCでカードを共有できます。</p>
          <p className="small">ログイン中: {user.email}</p>
        </div>
        <div className="headerActions">
          <button onClick={load}>再読み込み</button>
          <button onClick={logout}>ログアウト</button>
        </div>
      </header>

      {errorMessage && <div className="errorBox">エラー: {errorMessage}</div>}

      <section className="panel">
        <AddForm onAdd={add} />
      </section>

      <section className="filterBar">
        <label>
          装置カテゴリー
          <select value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)}>
            <option value="all">全装置カテゴリー</option>
            {DEVICE_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <main className="categorySections">
        {DEVICE_CATEGORIES.filter((category) => deviceFilter === "all" || category.value === deviceFilter).map((category) => {
          const categoryCards = visibleCards.filter((card) => card.device_category === category.value);

          return (
            <section key={category.value} className="categorySection">
              <div className="categoryHeader">
                <h2>{category.label}</h2>
                <span>{categoryCards.length}件</span>
              </div>

              <div className="stageGrid">
                {STAGES.map((stage) => {
                  const stageCards = categoryCards.filter((card) => card.stage === stage);

                  return (
                    <div key={`${category.value}-${stage}`} className="stageColumn">
                      <div className="stageHeader">
                        <strong>{getStageLabel(stage)}</strong>
                        <span>{stageCards.length}</span>
                      </div>

                      {stageCards.length === 0 ? (
                        <div className="empty">カードなし</div>
                      ) : (
                        <div className="cardStack">
                          {stageCards.map((card) => (
                            <div key={card.id} className="labCard">
                              <div className="cardTop">
                                <strong>{card.patient}</strong>
                                <span>{getDeviceLabel(card.device_category)}</span>
                              </div>

                              <div className="cardBody">
                                <div>装置名：{card.device_name}</div>
                                <div>装着予定日：{card.fitting_date}</div>
                                <div>来院予定日：{card.visit_date}</div>
                                {card.memo && <div className="memo">メモ：{card.memo}</div>}
                              </div>

                              <div className="cardActions">
                                <button onClick={() => move(card.id, -1)}>← 戻す</button>
                                <button onClick={() => move(card.id, 1)}>次へ →</button>
                              </div>

                              {card.stage === "bonding" && (
                                <button className="deleteButton" onClick={() => remove(card.id)}>
                                  装着完了として削除
                                </button>
                              )}
                            </div>
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
    </div>
  );
}

function Login({
  onLogin,
  errorMessage,
}: {
  onLogin: (e: string, p: string) => void;
  errorMessage: string;
}) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  return (
    <div className="loginPage">
      <div className="loginCard">
        <h2>ログイン</h2>
        <p>Supabase Authenticationで作成したユーザーでログインしてください。</p>

        <label>
          メールアドレス
          <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        <label>
          パスワード
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
        </label>

        {errorMessage && <div className="errorText">{errorMessage}</div>}

        <button className="primary" onClick={() => onLogin(email, pass)}>
          ログイン
        </button>
      </div>
    </div>
  );
}

function AddForm({ onAdd }: { onAdd: (c: any) => void }) {
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

    setF({
      patient: "",
      device_category: "labial",
      device_name: "",
      stage: "impression",
      fitting_date: "",
      visit_date: "",
      memo: "",
    });
  }

  return (
    <div className="addForm">
      <label>
        患者名
        <input value={f.patient} placeholder="患者" onChange={(e) => setF({ ...f, patient: e.target.value })} />
      </label>

      <label>
        装置カテゴリー
        <select value={f.device_category} onChange={(e) => setF({ ...f, device_category: e.target.value, device_name: "" })}>
          {DEVICE_CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        装着予定日
        <input type="date" value={f.fitting_date} onChange={(e) => setF({ ...f, fitting_date: e.target.value })} />
      </label>

      <label>
        来院予定日
        <input type="date" value={f.visit_date} onChange={(e) => setF({ ...f, visit_date: e.target.value })} />
      </label>

      <label>
        詳細な装置名
        {f.device_category === "retainer" ? (
          <select value={f.device_name} onChange={(e) => setF({ ...f, device_name: e.target.value })}>
            <option value="">リテーナー種類を選択</option>
            {RETAINER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : f.device_category === "other" ? (
          <select value={f.device_name} onChange={(e) => setF({ ...f, device_name: e.target.value })}>
            <option value="">その他の装置名を選択</option>
            {OTHER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input value={f.device_name} placeholder="装置名" onChange={(e) => setF({ ...f, device_name: e.target.value })} />
        )}
      </label>

      <label>
        現在の進行状況
        <select value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value })}>
          {STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {getStageLabel(stage)}
            </option>
          ))}
        </select>
      </label>

      <label className="memoField">
        自由記入欄・メモ
        <textarea value={f.memo} placeholder="メモ" onChange={(e) => setF({ ...f, memo: e.target.value })} />
      </label>

      <button className="primary" onClick={submit}>
        追加
      </button>
    </div>
  );
}
