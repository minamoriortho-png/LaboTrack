import { useMemo, useState } from "react";
import "./style.css";

type Stage = "impression" | "order" | "approval" | "delivery" | "bonding";
type Device = "labial" | "lingual" | "aligner" | "band" | "bite";

type LabCard = {
  id: string;
  patient: string;
  deviceCategory: Device;
  deviceName: string;
  stage: Stage;
  fittingDate: string;
  visitDate: string;
};

const LOGIN = {
  username: "admin",
  password: "lab2026",
};

const devices: { value: Device; label: string }[] = [
  { value: "labial", label: "ラビアル" },
  { value: "lingual", label: "リンガル" },
  { value: "aligner", label: "アライナー" },
  { value: "band", label: "バンド系装置" },
  { value: "bite", label: "バイト" },
];

const stages: { value: Stage; label: string }[] = [
  { value: "impression", label: "印象" },
  { value: "order", label: "発注（プリント）" },
  { value: "approval", label: "承認" },
  { value: "delivery", label: "納品" },
  { value: "bonding", label: "装着" },
];

const stageDurations: Record<Stage, number> = {
  impression: 1,
  order: 7,
  approval: 14,
  delivery: 0,
  bonding: 0,
};

const deviceNames: Record<Device, string[]> = {
  labial: ["メタルブラケット", "セラミックブラケット", "ホワイトワイヤー", "部分ラビアル"],
  lingual: ["フルリンガル", "上顎リンガル", "リンガル保定装置"],
  aligner: ["アライナー初回", "追加アライナー", "リファインメント"],
  band: ["急速拡大装置", "リンガルアーチ", "ナンスホールディングアーチ", "TPA"],
  bite: ["バイトプレート", "前歯部バイトターボ", "リンガルボタン関連"],
};

const initialCards: LabCard[] = [
  {
    id: "CARD-001",
    patient: "山田 花子",
    deviceCategory: "lingual",
    deviceName: "フルリンガル",
    stage: "approval",
    fittingDate: "2026-05-18",
    visitDate: "2026-05-17",
  },
  {
    id: "CARD-002",
    patient: "田中 太郎",
    deviceCategory: "aligner",
    deviceName: "アライナー初回",
    stage: "delivery",
    fittingDate: "2026-05-15",
    visitDate: "2026-05-15",
  },
  {
    id: "CARD-003",
    patient: "佐藤 美咲",
    deviceCategory: "band",
    deviceName: "急速拡大装置",
    stage: "order",
    fittingDate: "2026-05-22",
    visitDate: "2026-05-20",
  },
  {
    id: "CARD-004",
    patient: "中村 健",
    deviceCategory: "labial",
    deviceName: "ホワイトワイヤー",
    stage: "impression",
    fittingDate: "2026-05-25",
    visitDate: "2026-05-24",
  },
  {
    id: "CARD-005",
    patient: "高橋 彩",
    deviceCategory: "bite",
    deviceName: "前歯部バイトターボ",
    stage: "bonding",
    fittingDate: "2026-05-10",
    visitDate: "2026-05-10",
  },
];

function deviceLabel(value: Device) {
  return devices.find((device) => device.value === value)?.label ?? value;
}

function stageLabel(value: Stage) {
  return stages.find((stage) => stage.value === value)?.label ?? value;
}

function todayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function daysUntil(dateString: string) {
  const target = new Date(`${dateString}T00:00:00`);
  return Math.ceil((target.getTime() - todayStart().getTime()) / 86400000);
}

function remainingLeadDays(stage: Stage) {
  const index = stages.findIndex((item) => item.value === stage);
  return stages.slice(index, stages.length - 1).reduce((sum, item) => sum + stageDurations[item.value], 0);
}

function risk(card: LabCard) {
  if (card.stage === "bonding") {
    return { level: "done", label: "装着段階", message: "装着工程まで進んでいます", priority: 99 };
  }

  const need = remainingLeadDays(card.stage);
  const remain = Math.min(daysUntil(card.visitDate), daysUntil(card.fittingDate));

  if (remain < 0) {
    return { level: "critical", label: "要至急対応", message: "来院日または装着日を超過しています", priority: 0 };
  }

  if (need > remain) {
    return { level: "critical", label: "間に合わない可能性高", message: `残り必要日数${need}日に対して残り${remain}日です`, priority: 1 };
  }

  if (need === remain) {
    return { level: "warning", label: "間に合わない可能性あり", message: `残り必要日数${need}日と残り${remain}日が同じです`, priority: 2 };
  }

  if (remain - need <= 2) {
    return { level: "warning", label: "日程接近", message: `必要日数差が${remain - need}日しかありません`, priority: 3 };
  }

  return { level: "normal", label: "進行中", message: "現時点では日程に余裕があります", priority: 4 };
}

function dateLabel(dateString: string, type: "visit" | "fitting") {
  const diff = daysUntil(dateString);
  if (diff < 0) return `${Math.abs(diff)}日経過`;
  if (diff === 0) return type === "visit" ? "本日来院予定" : "本日装着";
  return type === "visit" ? `来院まで${diff}日` : `装着まで${diff}日`;
}

function dateClass(dateString: string) {
  const diff = daysUntil(dateString);
  if (diff < 0) return "date danger";
  if (diff <= 2) return "date warning";
  return "date";
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (username === LOGIN.username && password === LOGIN.password) {
      sessionStorage.setItem("lab-progress-auth", "true");
      onLogin();
      return;
    }
    setError("ユーザー名またはパスワードが違います");
  }

  return (
    <div className="loginPage">
      <form className="loginCard" onSubmit={submit}>
        <h1>技工物 進行表</h1>
        <p>ログインして進捗管理画面を開きます</p>
        <label>
          ユーザー名
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="admin" autoComplete="username" />
        </label>
        <label>
          パスワード
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="パスワード" autoComplete="current-password" />
        </label>
        {error && <div className="error">{error}</div>}
        <button type="submit" className="primary full">ログイン</button>
        <div className="note">
          初期ログイン: admin / lab2026<br />
          本番ではVercel Authentication、Supabase Auth、Firebase Authなどを推奨します。
        </div>
      </form>
    </div>
  );
}

function Summary({ title, value, sub }: { title: string; value: number; sub: string }) {
  return (
    <div className="summary">
      <div className="summaryTitle">{title}</div>
      <div className="summaryValue">{value}</div>
      <div className="summarySub">{sub}</div>
    </div>
  );
}

function LabCardView({ card, onMove, onDelete }: { card: LabCard; onMove: (id: string, direction: number) => void; onDelete: (id: string) => void }) {
  const status = risk(card);
  const index = stages.findIndex((stage) => stage.value === card.stage);
  const canBack = index > 0;
  const canNext = index < stages.length - 1;

  return (
    <div className={`labCard ${status.level}`}>
      <div className="cardTop">
        <div>
          <div className="patient">👤 {card.patient}</div>
          <div className="cardId">{card.id}</div>
        </div>
        <div className="badges">
          <span>{deviceLabel(card.deviceCategory)}</span>
          <span className={status.level}>{status.label}</span>
        </div>
      </div>
      <div className="cardBody">
        <div>📦 {card.deviceName}</div>
        <div>📅 装着日 {card.fittingDate}</div>
        <div className={dateClass(card.fittingDate)}>{dateLabel(card.fittingDate, "fitting")}</div>
        <div>🗓️ 来院予定 {card.visitDate}</div>
        <div className={dateClass(card.visitDate)}>{dateLabel(card.visitDate, "visit")}</div>
      </div>
      <div className="cardActions">
        <button disabled={!canBack} onClick={() => onMove(card.id, -1)}>戻す</button>
        <button className="primary" disabled={!canNext} onClick={() => onMove(card.id, 1)}>次へ</button>
      </div>
      {card.stage === "bonding" && (
        <button
          className="deleteButton"
          onClick={() => {
            if (window.confirm(`${card.patient}さんのカードを削除しますか？`)) onDelete(card.id);
          }}
        >
          装着完了として削除
        </button>
      )}
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => sessionStorage.getItem("lab-progress-auth") === "true");
  const [cards, setCards] = useState<LabCard[]>(initialCards);
  const [query, setQuery] = useState("");
  const [deviceFilter, setDeviceFilter] = useState<Device | "all">("all");
  const [stageFilter, setStageFilter] = useState<Stage | "all">("all");
  const [scheduleFilter, setScheduleFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Omit<LabCard, "id">>({
    patient: "",
    deviceCategory: "labial",
    deviceName: "メタルブラケット",
    stage: "impression",
    fittingDate: "",
    visitDate: "",
  });

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return cards.filter((card) => {
      const searchable = [card.patient, card.deviceName, deviceLabel(card.deviceCategory), stageLabel(card.stage), card.fittingDate, card.visitDate].join(" ").toLowerCase();
      if (text && !searchable.includes(text)) return false;
      if (deviceFilter !== "all" && card.deviceCategory !== deviceFilter) return false;
      if (stageFilter !== "all" && card.stage !== stageFilter) return false;
      if (scheduleFilter === "today") return daysUntil(card.visitDate) === 0 || daysUntil(card.fittingDate) === 0;
      if (scheduleFilter === "soon") return (daysUntil(card.visitDate) >= 0 && daysUntil(card.visitDate) <= 3) || (daysUntil(card.fittingDate) >= 0 && daysUntil(card.fittingDate) <= 3);
      if (scheduleFilter === "overdue") return card.stage !== "bonding" && (daysUntil(card.visitDate) < 0 || daysUntil(card.fittingDate) < 0);
      return true;
    });
  }, [cards, query, deviceFilter, stageFilter, scheduleFilter]);

  const urgent = useMemo(() => {
    return filtered
      .map((card) => ({ card, status: risk(card) }))
      .filter(({ status }) => status.level === "critical" || status.level === "warning")
      .sort((a, b) => a.status.priority - b.status.priority);
  }, [filtered]);

  const stats = useMemo(() => {
    return {
      total: cards.length,
      todayBonding: cards.filter((card) => card.stage === "bonding" && daysUntil(card.fittingDate) === 0).length,
      approval: cards.filter((card) => card.stage === "approval").length,
      soon: cards.filter((card) => (daysUntil(card.visitDate) >= 0 && daysUntil(card.visitDate) <= 3) || (daysUntil(card.fittingDate) >= 0 && daysUntil(card.fittingDate) <= 3)).length,
      overdue: cards.filter((card) => card.stage !== "bonding" && (daysUntil(card.visitDate) < 0 || daysUntil(card.fittingDate) < 0)).length,
      risk: cards.filter((card) => ["critical", "warning"].includes(risk(card).level)).length,
    };
  }, [cards]);

  function moveCard(id: string, direction: number) {
    setCards((prev) =>
      prev.map((card) => {
        if (card.id !== id) return card;
        const index = stages.findIndex((stage) => stage.value === card.stage);
        const next = stages[index + direction];
        return next ? { ...card, stage: next.value } : card;
      })
    );
  }

  function deleteCard(id: string) {
    setCards((prev) => prev.filter((card) => card.id !== id));
  }

  function addCard() {
    if (!form.patient || !form.fittingDate || !form.visitDate) return;
    setCards((prev) => [...prev, { id: `CARD-${String(prev.length + 1).padStart(3, "0")}`, ...form }]);
    setModalOpen(false);
    setForm({
      patient: "",
      deviceCategory: "labial",
      deviceName: "メタルブラケット",
      stage: "impression",
      fittingDate: "",
      visitDate: "",
    });
  }

  function logout() {
    sessionStorage.removeItem("lab-progress-auth");
    setLoggedIn(false);
  }

  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />;

  return (
    <div className="page">
      <div className="container">
        <header className="topBar">
          <div>
            <h1>技工物 進行表</h1>
            <p>縦軸を装置カテゴリ、横軸を進行状況にしたマトリクス型の進捗ボード</p>
          </div>
          <div className="topButtons">
            <button onClick={logout}>ログアウト</button>
            <button className="primary" onClick={() => setModalOpen(true)}>+ カード追加</button>
          </div>
        </header>

        <section className="summaryGrid">
          <Summary title="全カード数" value={stats.total} sub="現在管理中の技工物" />
          <Summary title="本日装着" value={stats.todayBonding} sub="装着列かつ本日予定" />
          <Summary title="承認待ち" value={stats.approval} sub="承認列にあるカード" />
          <Summary title="日程が近い" value={stats.soon} sub="装着日または来院日が3日以内" />
          <Summary title="遅延・要対応" value={stats.overdue} sub="未装着で日付超過" />
          <Summary title="間に合わない可能性" value={stats.risk} sub="上部に自動表示されるカード" />
        </section>

        <section className="filters">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="患者名・装置名・日付で検索" />
          <select value={deviceFilter} onChange={(event) => setDeviceFilter(event.target.value as Device | "all")}>
            <option value="all">全装置カテゴリ</option>
            {devices.map((device) => <option key={device.value} value={device.value}>{device.label}</option>)}
          </select>
          <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as Stage | "all")}>
            <option value="all">全進行状況</option>
            {stages.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
          </select>
          <select value={scheduleFilter} onChange={(event) => setScheduleFilter(event.target.value)}>
            <option value="all">全日程</option>
            <option value="today">本日関連</option>
            <option value="soon">3日以内</option>
            <option value="overdue">超過のみ</option>
          </select>
        </section>

        {urgent.length > 0 && (
          <section className="urgentPanel">
            <h2>⚠ 来院日までに間に合わない可能性があるカード</h2>
            <div className="urgentGrid">
              {urgent.map(({ card, status }) => (
                <div key={`urgent-${card.id}`} className={`urgentCard ${status.level}`}>
                  <strong>{card.patient}</strong>
                  <span>{status.label}</span>
                  <p>{deviceLabel(card.deviceCategory)} / {card.deviceName}</p>
                  <p>現在工程: {stageLabel(card.stage)}</p>
                  <p>来院予定: {card.visitDate}</p>
                  <p>装着予定: {card.fittingDate}</p>
                  <small>{status.message}</small>
                </div>
              ))}
            </div>
          </section>
        )}

        <main className="matrixWrap">
          <div className="matrix">
            <div />
            {stages.map((stage) => (
              <div key={stage.value} className="stageHeader">
                <strong>{stage.label}</strong>
                <span>{filtered.filter((card) => card.stage === stage.value).length}</span>
              </div>
            ))}

            {devices.filter((device) => deviceFilter === "all" || device.value === deviceFilter).map((device) => (
              <div className="matrixRow" key={device.value}>
                <div className="deviceHeader">
                  <strong>{device.label}</strong>
                  <span>{filtered.filter((card) => card.deviceCategory === device.value).length}件</span>
                </div>
                {stages.map((stage) => {
                  const cellCards = filtered.filter((card) => card.deviceCategory === device.value && card.stage === stage.value);
                  return (
                    <div key={`${device.value}-${stage.value}`} className="cell">
                      {cellCards.length === 0 ? <div className="empty">カードなし</div> : cellCards.map((card) => (
                        <LabCardView key={card.id} card={card} onMove={moveCard} onDelete={deleteCard} />
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </main>
      </div>

      {modalOpen && (
        <div className="modalBackdrop" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modalHeader">
              <h2>新しいカードを登録</h2>
              <button onClick={() => setModalOpen(false)}>閉じる</button>
            </div>
            <div className="modalGrid">
              <input placeholder="患者名" value={form.patient} onChange={(event) => setForm({ ...form, patient: event.target.value })} />
              <input type="date" value={form.fittingDate} onChange={(event) => setForm({ ...form, fittingDate: event.target.value })} />
              <select value={form.deviceCategory} onChange={(event) => {
                const next = event.target.value as Device;
                setForm({ ...form, deviceCategory: next, deviceName: deviceNames[next][0] });
              }}>
                {devices.map((device) => <option key={device.value} value={device.value}>{device.label}</option>)}
              </select>
              <select value={form.deviceName} onChange={(event) => setForm({ ...form, deviceName: event.target.value })}>
                {deviceNames[form.deviceCategory].map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <input type="date" value={form.visitDate} onChange={(event) => setForm({ ...form, visitDate: event.target.value })} />
              <select value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value as Stage })}>
                {stages.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
              </select>
            </div>
            <div className="modalActions">
              <button onClick={() => setModalOpen(false)}>キャンセル</button>
              <button className="primary" onClick={addCard}>登録する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
