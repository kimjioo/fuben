"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type DungeonRule = {
  name: string;
  six: number;
  iron: number;
  crystal: number;
  special: number;
};

type RecordItem = {
  id: string;
  date: string;
  characterId: string;
  nickname: string;
  dungeon: string;
  six: number;
  iron: number;
  crystal: number;
  special: string;
  specialCount: number;
  note: string;
  createdAt: string;
};

const rules: DungeonRule[] = [
  { name: "狼神殿", six: 6, iron: 0, crystal: 1, special: 2 },
  { name: "白帝江关", six: 14, iron: 0, crystal: 2, special: 8 },
  { name: "达摩洞", six: 12, iron: 0, crystal: 2, special: 4 },
  { name: "冷龙峰", six: 10, iron: 0, crystal: 2, special: 5 },
  { name: "范阳夜变", six: 10, iron: 0, crystal: 2, special: 5 },
  { name: "会战弓月城", six: 10, iron: 5, crystal: 0, special: 0 },
  { name: "辉天堑", six: 10, iron: 0, crystal: 1, special: 0 },
  { name: "九老洞", six: 12, iron: 0, crystal: 2, special: 3 },
  { name: "西津渡", six: 6, iron: 0, crystal: 1, special: 2 },
  { name: "武狱黑牢", six: 12, iron: 0, crystal: 2, special: 4 },
  { name: "河阳之战", six: 10, iron: 0, crystal: 2, special: 8 },
  { name: "敖龙岛", six: 12, iron: 0, crystal: 2, special: 6 },
];

const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

const emptyForm = {
  date: today,
  characterId: "",
  nickname: "",
  dungeon: "狼神殿",
  six: 0,
  iron: 0,
  crystal: 0,
  special: "",
  specialCount: 0,
  note: "",
};

function Stepper({
  value,
  onChange,
  max,
  accent,
}: {
  value: number;
  onChange: (value: number) => void;
  max: number;
  accent: string;
}) {
  return (
    <div className="stepper" style={{ "--accent": accent } as React.CSSProperties}>
      <button type="button" disabled={max === 0} onClick={() => onChange(Math.max(0, value - 1))} aria-label="减少 1">
        −
      </button>
      <input
        aria-label="掉落数量"
        type="number"
        min="0"
        max={max}
        disabled={max === 0}
        value={value}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
      />
      <button type="button" disabled={max === 0} onClick={() => onChange(Math.min(max, value + 1))} aria-label="增加 1">
        +
      </button>
    </div>
  );
}

export default function Home() {
  const [form, setForm] = useState(emptyForm);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("blackbook-records-v1");
    if (stored) {
      try {
        setRecords(JSON.parse(stored));
      } catch {
        setRecords([]);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem("blackbook-records-v1", JSON.stringify(records));
  }, [records, hydrated]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeRule = rules.find((rule) => rule.name === form.dungeon) ?? rules[0];
  const filteredRecords = useMemo(() => {
    const key = filter.trim().toLowerCase();
    const list = key
      ? records.filter((item) =>
          [item.nickname, item.characterId, item.dungeon, item.special].some((value) =>
            value.toLowerCase().includes(key),
          ),
        )
      : records;
    return showAll ? list : list.slice(0, 4);
  }, [records, filter, showAll]);

  const todayRecords = records.filter((record) => record.date === today);
  const todayDrops = todayRecords.reduce(
    (total, record) => total + record.six + record.iron + record.crystal + record.specialCount,
    0,
  );

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.characterId.trim() || !form.nickname.trim()) {
      setToast("请先填写黑本 ID 和群友昵称");
      return;
    }
    if (
      form.six > activeRule.six ||
      form.iron > activeRule.iron ||
      form.crystal > activeRule.crystal ||
      form.specialCount > activeRule.special
    ) {
      setToast("有掉落数量超过该副本的可掉落上限");
      return;
    }

    const now = new Date();
    const next: RecordItem = {
      ...form,
      characterId: form.characterId.trim(),
      nickname: form.nickname.trim(),
      special: form.special.trim(),
      id: `${Date.now()}`,
      createdAt: now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    };
    setRecords((current) => [next, ...current]);
    setForm((current) => ({ ...emptyForm, date: current.date, characterId: current.characterId, nickname: current.nickname, dungeon: current.dungeon }));
    setToast("记录已保存到本机");
  }

  function duplicate(record: RecordItem) {
    setForm({
      date: today,
      characterId: record.characterId,
      nickname: record.nickname,
      dungeon: record.dungeon,
      six: 0,
      iron: 0,
      crystal: 0,
      special: "",
      specialCount: 0,
      note: "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    setToast("已带入上一条成员信息");
  }

  function remove(id: string) {
    setRecords((current) => current.filter((item) => item.id !== id));
    setToast("记录已删除");
  }

  function exportCsv() {
    const header = [
      "日期",
      "黑本id",
      "黑本群友昵称",
      "副本名称",
      "计数列（隐藏）",
      "可掉六级boss数",
      "可掉小铁boss数",
      "可掉玄晶boss数",
      "可掉其它特殊数",
      "六级",
      "特殊",
      "特殊计数列",
      "铁（当期十人限定）",
      "备注",
    ];
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = records.map((record) => {
      const rule = rules.find((item) => item.name === record.dungeon) ?? rules[0];
      const specials = [record.crystal ? "玄晶" : "", record.special].filter(Boolean).join(" / ");
      return [
        record.date,
        record.characterId,
        record.nickname,
        record.dungeon,
        1,
        rule.six / 2,
        rule.iron,
        rule.crystal,
        rule.special,
        record.six,
        specials,
        record.crystal + record.specialCount,
        record.iron,
        record.note,
      ].map(escape).join(",");
    });
    const blob = new Blob(["\uFEFF", header.map(escape).join(","), "\n", rows.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `炸鸡团黑本记录-${today}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast(`已导出 ${records.length} 条记录`);
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">炸</div>
          <div>
            <strong>炸鸡团</strong>
            <span>黑本记录册</span>
          </div>
        </div>
        <nav aria-label="主导航">
          <a className="active" href="#entry"><span>✦</span> 录入台</a>
          <a href="#recent"><span>◷</span> 最近记录</a>
          <a href="#rules"><span>◇</span> 掉落规则</a>
        </nav>
        <div className="sync-card">
          <span className="status-dot" />
          <div><strong>本机记录模式</strong><small>数据仅保存在当前浏览器</small></div>
        </div>
        <div className="sidebar-footer">数据结构兼容现有 Excel 统计</div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">DUNGEON LOG · 2026</p>
            <h1>副本记录录入</h1>
            <p>把每一次黑本掉落，记得清清楚楚。</p>
          </div>
          <div className="today-card">
            <div><span>今日记录</span><strong>{todayRecords.length}</strong></div>
            <i />
            <div><span>今日掉落</span><strong>{todayDrops}</strong></div>
          </div>
        </header>

        <form id="entry" className="entry-card" onSubmit={submit}>
          <div className="section-head">
            <div><span className="section-index">01</span><div><h2>本次副本</h2><p>先确认成员和副本，掉落上限会自动带入</p></div></div>
            <span className="required-note"><b>*</b> 为必填项</span>
          </div>

          <div className="form-grid basics">
            <label>
              <span>日期 <b>*</b></span>
              <input type="date" value={form.date} onChange={(event) => update("date", event.target.value)} required />
            </label>
            <label>
              <span>黑本 ID <b>*</b></span>
              <input value={form.characterId} onChange={(event) => update("characterId", event.target.value)} placeholder="游戏角色名" required />
            </label>
            <label>
              <span>群友昵称 <b>*</b></span>
              <input value={form.nickname} onChange={(event) => update("nickname", event.target.value)} placeholder="群内常用昵称" required />
            </label>
            <label className="dungeon-select">
              <span>副本名称 <b>*</b></span>
              <select value={form.dungeon} onChange={(event) => update("dungeon", event.target.value)}>
                {rules.map((rule) => <option key={rule.name}>{rule.name}</option>)}
              </select>
            </label>
          </div>

          <div id="rules" className="rule-strip">
            <div className="rule-title"><span>自动</span><div><strong>{activeRule.name}</strong><small>本次可掉落上限</small></div></div>
            <div className="rule-value orange"><span>六级</span><strong>{activeRule.six}</strong></div>
            <div className="rule-value blue"><span>小铁</span><strong>{activeRule.iron}</strong></div>
            <div className="rule-value purple"><span>玄晶</span><strong>{activeRule.crystal}</strong></div>
            <div className="rule-value gold"><span>其他特殊</span><strong>{activeRule.special}</strong></div>
          </div>

          <div className="divider" />

          <div className="section-head compact">
            <div><span className="section-index">02</span><div><h2>实际掉落</h2><p>没有掉落的项目保持为 0 即可</p></div></div>
            <span className="hint">数量会参与掉率统计</span>
          </div>

          <div className="drop-grid">
            <div className="drop-card orange">
              <div className="drop-icon">六</div><div className="drop-copy"><strong>六级五行石</strong><span>上限 {activeRule.six}</span></div>
              <Stepper value={form.six} onChange={(value) => update("six", value)} max={activeRule.six} accent="#ff9c4b" />
            </div>
            <div className={`drop-card blue ${activeRule.iron === 0 ? "muted" : ""}`}>
              <div className="drop-icon">铁</div><div className="drop-copy"><strong>小铁</strong><span>{activeRule.iron ? `上限 ${activeRule.iron}` : "本副本不统计"}</span></div>
              <Stepper value={form.iron} onChange={(value) => update("iron", value)} max={activeRule.iron} accent="#74c9ff" />
            </div>
            <div className={`drop-card purple ${activeRule.crystal === 0 ? "muted" : ""}`}>
              <div className="drop-icon">晶</div><div className="drop-copy"><strong>玄晶</strong><span>{activeRule.crystal ? `上限 ${activeRule.crystal}` : "本副本不统计"}</span></div>
              <Stepper value={form.crystal} onChange={(value) => update("crystal", value)} max={activeRule.crystal} accent="#b49cff" />
            </div>
          </div>

          <div className="special-row">
            <label className="special-input">
              <span>其他特殊掉落</span>
              <input value={form.special} onChange={(event) => update("special", event.target.value)} placeholder="例如：麒麟、挂件、外观…" />
              <small>多个掉落可用“ / ”分隔</small>
            </label>
            <label className="special-count">
              <span>特殊数量</span>
              <input type="number" min="0" max={activeRule.special || 99} value={form.specialCount} onChange={(event) => update("specialCount", Number(event.target.value) || 0)} />
            </label>
          </div>

          <label className="note-field">
            <span>备注</span>
            <textarea value={form.note} onChange={(event) => update("note", event.target.value)} placeholder="双闪、首通、补录等需要说明的情况…" maxLength={120} />
            <small>{form.note.length} / 120</small>
          </label>

          <div className="form-actions">
            <button className="secondary" type="button" onClick={() => setForm(emptyForm)}>清空本次</button>
            <div className="save-note"><span>✓</span><div><strong>自动保存在当前浏览器</strong><small>导出后可直接合并到统计表</small></div></div>
            <button className="primary" type="submit"><span>＋</span> 加入副本记录</button>
          </div>
        </form>

        <section id="recent" className="recent-section">
          <div className="recent-head">
            <div><p className="eyebrow">RECENT LOGS</p><h2>最近记录</h2></div>
            <div className="table-actions">
              <label className="search-box"><span>⌕</span><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="搜索昵称、副本…" /></label>
              <button type="button" onClick={exportCsv}>⇩ 导出 CSV</button>
            </div>
          </div>

          <div className="record-list">
            {filteredRecords.map((record) => (
              <article className="record-row" key={record.id}>
                <div className="avatar">{record.nickname.slice(0, 1)}</div>
                <div className="record-person"><strong>{record.nickname}</strong><span>{record.characterId}</span></div>
                <div className="record-dungeon"><span>副本</span><strong>{record.dungeon}</strong></div>
                <div className="loot-pills">
                  {record.six > 0 && <span className="loot orange">六级 × {record.six}</span>}
                  {record.iron > 0 && <span className="loot blue">小铁 × {record.iron}</span>}
                  {record.crystal > 0 && <span className="loot purple">玄晶 × {record.crystal}</span>}
                  {record.special && <span className="loot gold">{record.special} × {record.specialCount || 1}</span>}
                  {!record.six && !record.iron && !record.crystal && !record.special && <span className="empty-loot">无掉落</span>}
                </div>
                <div className="record-time"><strong>{record.createdAt}</strong><span>{record.date}</span></div>
                <div className="row-actions">
                  <button type="button" onClick={() => duplicate(record)} title="复用成员信息">↗</button>
                  <button className="delete" type="button" onClick={() => remove(record.id)} title="删除记录">×</button>
                </div>
              </article>
            ))}
            {!filteredRecords.length && <div className="empty-state">没有找到匹配的记录</div>}
          </div>
          {records.length > 4 && !filter && (
            <button className="show-more" type="button" onClick={() => setShowAll((value) => !value)}>
              {showAll ? "收起记录" : `查看全部 ${records.length} 条记录`}
            </button>
          )}
        </section>

        <footer><span>炸鸡团黑本记录册</span><p>本页为独立录入副本 · 字段结构兼容现有统计插件</p></footer>
      </section>

      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}
