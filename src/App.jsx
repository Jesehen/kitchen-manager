import { useState, useMemo, useEffect } from "react";

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function toDateStr(d) { return d.toISOString().slice(0, 10); }
function addDays(dateStr, n) {
  const d = new Date(dateStr); d.setDate(d.getDate() + n); return toDateStr(d);
}
function diffDays(dateStr) {
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.round((d - TODAY) / 86400000);
}
function getStatus(expiryDate) {
  if (!expiryDate) return "fresh";
  const diff = diffDays(expiryDate);
  if (diff < 0) return "expired";
  if (diff <= 2) return "soon";
  return "fresh";
}
function getStatusLabel(expiryDate) {
  if (!expiryDate) return "";
  const diff = diffDays(expiryDate);
  if (diff < 0) return "已过期";
  if (diff === 0) return "今日到期";
  if (diff <= 2) return `${diff}天后到期`;
  return `${diff}天后到期`;
}

// 模糊匹配：判断两个食材名是否相似
function fuzzyMatch(a, b) {
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const aliases = [
    ["猪肉","五花肉","排骨","猪排","猪腩"],
    ["鸡肉","鸡腿","鸡胸","鸡翅","整鸡"],
    ["牛肉","牛腩","牛排","牛腱"],
    ["大蒜","蒜","蒜头","蒜瓣","蒜末"],
    ["生姜","姜","姜片","姜末"],
    ["葱","小葱","大葱","葱花","葱段"],
    ["西红柿","番茄"],
    ["土豆","马铃薯"],
    ["西兰花","西蓝花","花椰菜"],
  ];
  for (const group of aliases) {
    if (group.some(x => a.includes(x)) && group.some(x => b.includes(x))) return true;
  }
  return false;
}

function matchRecipe(recipe, ingredients) {
  const main = recipe.details.filter(d => !d.common);
  if (main.length === 0) return { score: 0, have: [], missing: [] };
  const have = [], missing = [];
  for (const item of main) {
    const found = ingredients.find(i => fuzzyMatch(i.name, item.name));
    if (found) have.push({ ...item, inFridge: found.qty, unit: item.unit || found.unit });
    else missing.push(item);
  }
  return { score: have.length / main.length, have, missing };
}

const DAYS = ["一","二","三","四","五","六","日"];
function getWeekDates(offset = 0) {
  const dow = TODAY.getDay();
  const monday = new Date(TODAY);
  monday.setDate(TODAY.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i); return d;
  });
}

function useLocalStorage(key, init) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : init; }
    catch { return init; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }, [key, val]);
  return [val, setVal];
}

const ST_COLOR = { fresh:"#16a34a", soon:"#d97706", expired:"#dc2626" };
const ST_BG    = { fresh:"#f0fdf4", soon:"#fffbeb", expired:"#fef2f2" };
const ST_LABEL = { fresh:"新鲜",   soon:"快到期",  expired:"已过期" };
const ST_BORDER= { fresh:"#d1fae5",soon:"#fcd34d", expired:"#fca5a5" };

const ICONS = ["🍳","🥬","🥩","🥘","🍲","🥚","🥦","🍜","🍛","🥗","🍱","🫕","🥙","🍝","🥞","🍤","🦐","🐟","🥕","🫛"];

export default function App() {
  const [tab, setTab] = useState("fridge");
  const [ingredients, setIngredients] = useLocalStorage("kit_ingredients", []);
  const [recipes, setRecipes] = useLocalStorage("kit_recipes", []);
  const [mealPlan, setMealPlan] = useLocalStorage("kit_mealplan", {});
  const [allTags, setAllTags] = useLocalStorage("kit_tags", ["快手","素食","汤类","荤菜"]);
  const [nextIngId, setNextIngId] = useLocalStorage("kit_nii", 1);
  const [nextRecId, setNextRecId] = useLocalStorage("kit_nri", 1);

  // Fridge state
  const [ingFilter, setIngFilter] = useState("all");
  const [ingName, setIngName] = useState("");
  const [ingZone, setIngZone] = useState("冷藏");
  const [ingQty, setIngQty] = useState("");
  const [ingUnit, setIngUnit] = useState("个");
  const [ingInDate, setIngInDate] = useState(toDateStr(TODAY));
  const [ingShelfDays, setIngShelfDays] = useState("");

  // Recipe state
  const [recipeFilter, setRecipeFilter] = useState("all");
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [analyzing, setAnalyzing] = useState(null);
  const [analyzeServings, setAnalyzeServings] = useState(2);

  // New recipe form
  const [rName, setRName] = useState("");
  const [rIcon, setRIcon] = useState("🍳");
  const [rTime, setRTime] = useState("");
  const [rServings, setRServings] = useState(2);
  const [rTags, setRTags] = useState([]);
  const [rDetails, setRDetails] = useState([{ name:"", need:"", unit:"", common:false }]);
  const [rSteps, setRSteps] = useState([""]);
  const [newTag, setNewTag] = useState("");
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Plan state
  const [planModal, setPlanModal] = useState(null); // { key, type }
  const [planInput, setPlanInput] = useState("");
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  const weekDates = getWeekDates(weekOffset);
  const weekLabel = useMemo(() => {
    const first = weekDates[0], last = weekDates[6];
    const range = `${first.getMonth()+1}月${first.getDate()}日 - ${last.getMonth()+1}月${last.getDate()}日`;
    if (weekOffset === 0) return `本周 · ${range}`;
    if (weekOffset === -1) return `上周 · ${range}`;
    if (weekOffset === 1) return `下周 · ${range}`;
    return range;
  }, [weekDates, weekOffset]);

  // Computed
  const expiry = (inDate, shelfDays) => shelfDays ? addDays(inDate, parseInt(shelfDays)) : null;
  const filteredIng = useMemo(() => {
    if (ingFilter === "soon") return ingredients.filter(i => ["soon","expired"].includes(getStatus(expiry(i.inDate, i.shelfDays))));
    if (ingFilter !== "all") return ingredients.filter(i => i.zone === ingFilter);
    return ingredients;
  }, [ingredients, ingFilter]);

  const filteredRecipes = useMemo(() => {
    if (recipeFilter === "可做") return recipes.filter(r => matchRecipe(r, ingredients).score >= 0.5);
    if (recipeFilter !== "all") return recipes.filter(r => r.tags?.includes(recipeFilter));
    return recipes;
  }, [recipes, recipeFilter, ingredients]);

  const totalCount = ingredients.length;
  const soonCount = ingredients.filter(i => getStatus(expiry(i.inDate, i.shelfDays)) === "soon").length;
  const expCount  = ingredients.filter(i => getStatus(expiry(i.inDate, i.shelfDays)) === "expired").length;

  // ── Fridge ──
  function addIng() {
    if (!ingName.trim()) return;
    setIngredients(prev => [...prev, {
      id: nextIngId, name: ingName.trim(), zone: ingZone,
      qty: ingQty ? parseFloat(ingQty) : null, unit: ingUnit,
      inDate: ingInDate, shelfDays: ingShelfDays || null,
    }]);
    setNextIngId(n => n + 1);
    setIngName(""); setIngQty(""); setIngShelfDays("");
  }
  function delIng(id) { setIngredients(prev => prev.filter(i => i.id !== id)); }

  // ── Recipe ──
  function parsePaste(text) {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    let name = "", steps = [], details = [];
    const timeMatch = text.match(/(\d+)\s*分钟/);
    const time = timeMatch ? timeMatch[0] : "";
    for (const line of lines) {
      if (!name && line.length < 20 && !line.match(/^\d/)) { name = line; continue; }
      if (line.match(/^[\d\-\.\•\*]/) || line.match(/步骤|做法|方法/)) {
        steps.push(line.replace(/^[\d\.\-\•\*、]\s*/, "").trim());
        continue;
      }
      const ingMatch = line.match(/^(.+?)[：:]\s*(.+)/);
      if (ingMatch) {
        const qmatch = ingMatch[2].match(/([\d\.]+)\s*([^\d\s]+)/);
        if (qmatch) details.push({ name: ingMatch[1].trim(), need: parseFloat(qmatch[1]), unit: qmatch[2], common: false });
        else details.push({ name: ingMatch[1].trim(), need: "", unit: "适量", common: false });
      }
    }
    if (details.length === 0) {
      const ingPat = /([^\d\s，,、。\n]{1,6})[^\d]*?([\d\.]+)\s*([^\d\s，,、。\n]{1,3})/g;
      let m;
      while ((m = ingPat.exec(text)) !== null) {
        details.push({ name: m[1], need: parseFloat(m[2]), unit: m[3], common: false });
      }
    }
    setRName(name || "新菜谱");
    setRTime(time);
    setRSteps(steps.length ? steps : [""]);
    setRDetails(details.length ? details : [{ name:"", need:"", unit:"", common:false }]);
    setPasteText("");
  }

  function saveRecipe() {
    if (!rName.trim()) return;
    const recipe = {
      id: nextRecId, icon: rIcon, name: rName.trim(), time: rTime,
      servings: rServings, tags: rTags,
      details: rDetails.filter(d => d.name.trim()),
      steps: rSteps.filter(s => s.trim()),
    };
    setRecipes(prev => [...prev, recipe]);
    setNextRecId(n => n + 1);
    setShowAddRecipe(false);
    setRName(""); setRIcon("🍳"); setRTime(""); setRServings(2);
    setRTags([]); setRDetails([{ name:"", need:"", unit:"", common:false }]); setRSteps([""]);
  }

  function delRecipe(id) { setRecipes(prev => prev.filter(r => r.id !== id)); }

  // ── Tags ──
  function addTag() {
    if (!newTag.trim() || allTags.includes(newTag.trim())) return;
    setAllTags(prev => [...prev, newTag.trim()]);
    setNewTag("");
  }
  function delTag(tag) {
    setAllTags(prev => prev.filter(t => t !== tag));
    setRecipes(prev => prev.map(r => ({ ...r, tags: r.tags?.filter(t => t !== tag) || [] })));
  }

  // ── Plan ──
  function savePlan() {
    if (!planModal) return;
    setMealPlan(prev => ({ ...prev, [planModal.key]: planInput.trim() }));
    setPlanModal(null); setPlanInput("");
  }
  function pickRecipeForPlan(recipeName) {
    if (!planModal) return;
    setMealPlan(prev => ({ ...prev, [planModal.key]: recipeName }));
    setShowRecipePicker(false); setPlanModal(null);
  }

  // ── Analysis ──
  const analysisResult = useMemo(() => {
    if (!analyzing) return null;
    const scale = analyzeServings / (analyzing.servings || 2);
    return analyzing.details.map(item => {
      const needed = item.need ? +(item.need * scale).toFixed(1) : null;
      if (item.common) return { ...item, needed, status: "common" };
      const found = ingredients.find(i => fuzzyMatch(i.name, item.name));
      if (!found) return { ...item, needed, status: "missing", inFridge: 0 };
      if (!needed || !found.qty) return { ...item, needed, status: "ok", inFridge: found.qty };
      if (found.qty >= needed) return { ...item, needed, status: "ok", inFridge: found.qty };
      return { ...item, needed, status: "partial", inFridge: found.qty, shortfall: +(needed - found.qty).toFixed(1) };
    });
  }, [analyzing, analyzeServings, ingredients]);

  // ── Styles ──
  const s = {
    tab: (k) => ({
      padding: "8px 16px", borderRadius: 8, border: "0.5px solid",
      borderColor: tab===k ? "#6366f1" : "#e2e8f0",
      background: tab===k ? "#eef2ff" : "transparent",
      color: tab===k ? "#4338ca" : "#64748b",
      fontWeight: tab===k ? 500 : 400, fontSize: 14, cursor: "pointer",
    }),
    chip: (active) => ({
      fontSize: 12, padding: "4px 12px", borderRadius: 20, border: "0.5px solid",
      borderColor: active ? "#6366f1" : "#e2e8f0",
      background: active ? "#eef2ff" : "transparent",
      color: active ? "#4338ca" : "#64748b", cursor: "pointer",
    }),
    input: { padding: "8px 10px", borderRadius: 8, border: "0.5px solid #e2e8f0", fontSize: 14, width: "100%" },
    card: { background: "#fff", border: "0.5px solid #e2e8f0", borderRadius: 12, padding: "1rem" },
    row: (st) => ({
      background: ST_BG[st]||"#fff", border: `0.5px solid ${ST_BORDER[st]||"#e2e8f0"}`,
      borderRadius: 10, padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: 10,
    }),
  };

  const modalBg = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 };
  const modalBox = { background: "#fff", borderRadius: 16, width: "100%", maxWidth: 500, maxHeight: "88vh", overflowY: "auto" };

  return (
    <div style={{ fontFamily: "system-ui,sans-serif", padding: "1rem 0", maxWidth: 720 }}>

      {/* ── Analysis Modal ── */}
      {analyzing && analysisResult && (
        <div style={modalBg}>
          <div style={modalBox}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "0.5px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 24 }}>{analyzing.icon}</div>
                  <div style={{ fontSize: 17, fontWeight: 500 }}>{analyzing.name}</div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>⏱ {analyzing.time} · 基准 {analyzing.servings} 人份</div>
                </div>
                <button onClick={() => setAnalyzing(null)} style={{ background:"none", border:"none", fontSize:20, color:"#94a3b8", cursor:"pointer" }}>✕</button>
              </div>
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#64748b" }}>几人份：</span>
                {[1,2,3,4,6].map(n => (
                  <button key={n} onClick={() => setAnalyzeServings(n)} style={{
                    width:32, height:32, borderRadius:8, border:"0.5px solid",
                    borderColor: analyzeServings===n ? "#6366f1" : "#e2e8f0",
                    background: analyzeServings===n ? "#eef2ff" : "transparent",
                    color: analyzeServings===n ? "#4338ca" : "#64748b", cursor:"pointer", fontSize:13,
                  }}>{n}</button>
                ))}
              </div>
            </div>
            <div style={{ padding: "1rem 1.5rem" }}>
              {/* Missing */}
              {analysisResult.filter(i=>["missing","partial"].includes(i.status)).length > 0 && (
                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ fontSize:12, fontWeight:500, color:"#dc2626", marginBottom:8, letterSpacing:"0.05em" }}>需要购买</div>
                  {analysisResult.filter(i=>["missing","partial"].includes(i.status)).map((item,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"0.5px solid #f1f5f9" }}>
                      <span style={{ flex:1, fontSize:13, fontWeight:500 }}>{item.name}</span>
                      <span style={{ fontSize:12, color:"#64748b" }}>{item.status==="partial" ? `冰箱剩 ${item.inFridge}${item.unit}，还缺` : "冰箱没有，需要"}</span>
                      <span style={{ fontSize:13, fontWeight:500, padding:"3px 10px", borderRadius:20, background: item.status==="missing"?"#fef2f2":"#fffbeb", color: item.status==="missing"?"#dc2626":"#d97706" }}>
                        {item.status==="partial" ? `${item.shortfall}${item.unit}` : item.needed ? `${item.needed}${item.unit}` : "适量"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {/* Have */}
              {analysisResult.filter(i=>i.status==="ok").length > 0 && (
                <div style={{ marginBottom:"1rem" }}>
                  <div style={{ fontSize:12, fontWeight:500, color:"#16a34a", marginBottom:8 }}>冰箱已有</div>
                  {analysisResult.filter(i=>i.status==="ok").map((item,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"0.5px solid #f1f5f9" }}>
                      <span style={{ flex:1, fontSize:13 }}>{item.name}</span>
                      <span style={{ fontSize:12, color:"#64748b" }}>需要 {item.needed}{item.unit}</span>
                      <span style={{ fontSize:13, padding:"3px 10px", borderRadius:20, background:"#f0fdf4", color:"#16a34a" }}>✓ 足够</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Common */}
              {analysisResult.filter(i=>i.status==="common").length > 0 && (
                <div style={{ marginBottom:"1rem" }}>
                  <div style={{ fontSize:12, fontWeight:500, color:"#94a3b8", marginBottom:8 }}>厨房常备</div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {analysisResult.filter(i=>i.status==="common").map((item,i) => (
                      <span key={i} style={{ fontSize:12, padding:"3px 10px", borderRadius:20, background:"#f8fafc", border:"0.5px solid #e2e8f0", color:"#64748b" }}>
                        {item.name} {item.needed}{item.unit}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {/* Steps */}
              {analyzing.steps?.length > 0 && (
                <div style={{ marginBottom:"1rem" }}>
                  <div style={{ fontSize:12, fontWeight:500, color:"#64748b", marginBottom:8 }}>烹饪步骤</div>
                  {analyzing.steps.map((step,i) => (
                    <div key={i} style={{ display:"flex", gap:10, marginBottom:8 }}>
                      <span style={{ width:22, height:22, borderRadius:"50%", background:"#eef2ff", color:"#4338ca", fontSize:12, fontWeight:500, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{i+1}</span>
                      <span style={{ fontSize:13, color:"#374151", lineHeight:1.6 }}>{step}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Summary */}
              {(() => {
                const missing = analysisResult.filter(i=>["missing","partial"].includes(i.status));
                return (
                  <div style={{ background: missing.length===0?"#f0fdf4":"#fffbeb", border:`0.5px solid ${missing.length===0?"#86efac":"#fcd34d"}`, borderRadius:10, padding:"0.75rem 1rem", textAlign:"center" }}>
                    <div style={{ fontSize:14, fontWeight:500, color: missing.length===0?"#16a34a":"#b45309" }}>
                      {missing.length===0 ? `✓ 食材齐全，可以做 ${analyzeServings} 人份！` : `还差 ${missing.map(i=>i.name).join("、")} 等 ${missing.length} 种食材`}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Add Recipe Modal ── */}
      {showAddRecipe && (
        <div style={modalBg}>
          <div style={{ ...modalBox, maxWidth: 560 }}>
            <div style={{ padding:"1.25rem 1.5rem", borderBottom:"0.5px solid #e2e8f0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:16, fontWeight:500 }}>添加菜谱</span>
              <button onClick={() => setShowAddRecipe(false)} style={{ background:"none", border:"none", fontSize:20, color:"#94a3b8", cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ padding:"1rem 1.5rem", display:"flex", flexDirection:"column", gap:12 }}>
              {/* Paste */}
              <div>
                <div style={{ fontSize:12, color:"#64748b", marginBottom:6 }}>粘贴菜谱文字自动解析（可选）</div>
                <textarea value={pasteText} onChange={e=>setPasteText(e.target.value)}
                  placeholder="从小红书、菜谱网站复制文字粘贴到这里，点击解析自动填写..."
                  style={{ ...s.input, height:80, resize:"vertical", fontFamily:"inherit" }} />
                <button onClick={() => parsePaste(pasteText)} disabled={!pasteText.trim()}
                  style={{ marginTop:6, padding:"6px 14px", borderRadius:8, border:"0.5px solid #6366f1", background:"#eef2ff", color:"#4338ca", fontSize:13, cursor:"pointer" }}>
                  自动解析
                </button>
              </div>
              <hr style={{ border:"none", borderTop:"0.5px solid #e2e8f0" }} />
              {/* Icon + Name */}
              <div style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:12, color:"#64748b", marginBottom:6 }}>图标</div>
                  <button onClick={() => setShowIconPicker(v=>!v)} style={{ fontSize:28, background:"#f8fafc", border:"0.5px solid #e2e8f0", borderRadius:10, padding:"6px 10px", cursor:"pointer" }}>{rIcon}</button>
                  {showIconPicker && (
                    <div style={{ position:"absolute", background:"#fff", border:"0.5px solid #e2e8f0", borderRadius:10, padding:10, display:"flex", flexWrap:"wrap", gap:6, width:220, zIndex:100, boxShadow:"0 4px 20px rgba(0,0,0,0.1)" }}>
                      {ICONS.map(ic => <button key={ic} onClick={() => { setRIcon(ic); setShowIconPicker(false); }} style={{ fontSize:22, background:"none", border:"none", cursor:"pointer", padding:4, borderRadius:6 }}>{ic}</button>)}
                    </div>
                  )}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, color:"#64748b", marginBottom:6 }}>菜名</div>
                  <input value={rName} onChange={e=>setRName(e.target.value)} placeholder="西红柿炒鸡蛋" style={s.input} />
                </div>
              </div>
              {/* Time + Servings */}
              <div style={{ display:"flex", gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, color:"#64748b", marginBottom:6 }}>烹饪时间</div>
                  <input value={rTime} onChange={e=>setRTime(e.target.value)} placeholder="15分钟" style={s.input} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, color:"#64748b", marginBottom:6 }}>基准人份</div>
                  <select value={rServings} onChange={e=>setRServings(parseInt(e.target.value))} style={s.input}>
                    {[1,2,3,4,6].map(n => <option key={n} value={n}>{n}人份</option>)}
                  </select>
                </div>
              </div>
              {/* Tags */}
              <div>
                <div style={{ fontSize:12, color:"#64748b", marginBottom:6 }}>标签</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
                  {allTags.map(tag => (
                    <button key={tag} onClick={() => setRTags(prev => prev.includes(tag) ? prev.filter(t=>t!==tag) : [...prev, tag])}
                      style={{ ...s.chip(rTags.includes(tag)), fontSize:12 }}>{tag}</button>
                  ))}
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <input value={newTag} onChange={e=>setNewTag(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTag()} placeholder="新建标签" style={{ ...s.input, flex:1 }} />
                  <button onClick={addTag} style={{ padding:"8px 12px", borderRadius:8, border:"0.5px solid #6366f1", background:"#eef2ff", color:"#4338ca", fontSize:13, cursor:"pointer" }}>添加</button>
                </div>
              </div>
              {/* Ingredients */}
              <div>
                <div style={{ fontSize:12, color:"#64748b", marginBottom:6 }}>食材明细</div>
                {rDetails.map((d,i) => (
                  <div key={i} style={{ display:"flex", gap:6, marginBottom:6, alignItems:"center" }}>
                    <input value={d.name} onChange={e=>setRDetails(prev=>{const n=[...prev];n[i]={...n[i],name:e.target.value};return n;})} placeholder="食材名" style={{ ...s.input, flex:2 }} />
                    <input value={d.need} onChange={e=>setRDetails(prev=>{const n=[...prev];n[i]={...n[i],need:e.target.value};return n;})} placeholder="用量" type="number" style={{ ...s.input, flex:1 }} />
                    <input value={d.unit} onChange={e=>setRDetails(prev=>{const n=[...prev];n[i]={...n[i],unit:e.target.value};return n;})} placeholder="单位" style={{ ...s.input, flex:1 }} />
                    <label style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, color:"#64748b", whiteSpace:"nowrap" }}>
                      <input type="checkbox" checked={d.common} onChange={e=>setRDetails(prev=>{const n=[...prev];n[i]={...n[i],common:e.target.checked};return n;})} />常备
                    </label>
                    <button onClick={() => setRDetails(prev=>prev.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:16 }}>✕</button>
                  </div>
                ))}
                <button onClick={() => setRDetails(prev=>[...prev, {name:"",need:"",unit:"",common:false}])} style={{ fontSize:13, color:"#6366f1", background:"none", border:"none", cursor:"pointer", padding:"4px 0" }}>+ 添加食材</button>
              </div>
              {/* Steps */}
              <div>
                <div style={{ fontSize:12, color:"#64748b", marginBottom:6 }}>烹饪步骤</div>
                {rSteps.map((st,i) => (
                  <div key={i} style={{ display:"flex", gap:6, marginBottom:6, alignItems:"center" }}>
                    <span style={{ width:22, height:22, borderRadius:"50%", background:"#eef2ff", color:"#4338ca", fontSize:12, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{i+1}</span>
                    <input value={st} onChange={e=>setRSteps(prev=>{const n=[...prev];n[i]=e.target.value;return n;})} placeholder={`步骤 ${i+1}`} style={{ ...s.input, flex:1 }} />
                    <button onClick={() => setRSteps(prev=>prev.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:16 }}>✕</button>
                  </div>
                ))}
                <button onClick={() => setRSteps(prev=>[...prev, ""])} style={{ fontSize:13, color:"#6366f1", background:"none", border:"none", cursor:"pointer", padding:"4px 0" }}>+ 添加步骤</button>
              </div>
              <button onClick={saveRecipe} style={{ padding:"10px", borderRadius:8, border:"none", background:"#4338ca", color:"#fff", fontSize:14, cursor:"pointer", fontWeight:500 }}>保存菜谱</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Plan Meal Modal ── */}
      {planModal && (
        <div style={modalBg}>
          <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:440 }}>
            <div style={{ padding:"1.25rem 1.5rem", borderBottom:"0.5px solid #e2e8f0", display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:15, fontWeight:500 }}>{planModal.type==="l"?"午餐":"晚餐"}</span>
              <button onClick={() => { setPlanModal(null); setShowRecipePicker(false); }} style={{ background:"none", border:"none", fontSize:20, color:"#94a3b8", cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ padding:"1rem 1.5rem" }}>
              {!showRecipePicker ? (
                <>
                  <input value={planInput} onChange={e=>setPlanInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&savePlan()} placeholder="手动输入菜名..." style={{ ...s.input, marginBottom:10 }} autoFocus />
                  <button onClick={() => setShowRecipePicker(true)} style={{ width:"100%", padding:"9px", borderRadius:8, border:"0.5px solid #6366f1", background:"#eef2ff", color:"#4338ca", fontSize:14, cursor:"pointer", marginBottom:10 }}>
                    从菜谱库选择
                  </button>
                  <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                    <button onClick={() => setPlanModal(null)} style={{ padding:"8px 16px", borderRadius:8, border:"0.5px solid #e2e8f0", background:"transparent", cursor:"pointer" }}>取消</button>
                    <button onClick={savePlan} style={{ padding:"8px 16px", borderRadius:8, border:"none", background:"#4338ca", color:"#fff", cursor:"pointer" }}>保存</button>
                  </div>
                </>
              ) : (
                <div>
                  <div style={{ fontSize:13, color:"#64748b", marginBottom:10 }}>选择菜谱</div>
                  {recipes.length === 0 ? (
                    <div style={{ textAlign:"center", padding:"1.5rem", color:"#94a3b8", fontSize:14 }}>菜谱库暂无菜谱</div>
                  ) : recipes.map(r => (
                    <div key={r.id} onClick={() => pickRecipeForPlan(r.name)} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px", borderRadius:10, border:"0.5px solid #e2e8f0", marginBottom:6, cursor:"pointer", background:"#fff" }}
                      onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                      <span style={{ fontSize:22 }}>{r.icon}</span>
                      <div>
                        <div style={{ fontSize:14, fontWeight:500 }}>{r.name}</div>
                        <div style={{ fontSize:12, color:"#64748b" }}>⏱ {r.time}</div>
                      </div>
                      {(() => { const m = matchRecipe(r, ingredients); return (
                        <span style={{ marginLeft:"auto", fontSize:12, padding:"2px 8px", borderRadius:20, background: m.score>=0.8?"#f0fdf4":m.score>=0.5?"#fffbeb":"#f8fafc", color: m.score>=0.8?"#16a34a":m.score>=0.5?"#d97706":"#94a3b8" }}>
                          {m.score>=0.8?"✓ 食材足":"◑ 部分有"}
                        </span>
                      ); })()}
                    </div>
                  ))}
                  <button onClick={() => setShowRecipePicker(false)} style={{ marginTop:6, fontSize:13, color:"#64748b", background:"none", border:"none", cursor:"pointer" }}>← 返回手动输入</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display:"flex", gap:8, marginBottom:"1.5rem" }}>
        {[["fridge","冰箱食材"],["plan","每周菜谱"],["recipes","菜谱库"]].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)} style={s.tab(k)}>{l}</button>
        ))}
      </div>

      {/* ══ FRIDGE ══ */}
      {tab === "fridge" && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:"1.5rem" }}>
            {[[totalCount,"食材总数","#1e293b"],[soonCount,"即将过期","#d97706"],[expCount,"已过期","#dc2626"]].map(([v,l,c]) => (
              <div key={l} style={{ background:"#f8fafc", borderRadius:8, padding:"0.9rem 1rem" }}>
                <div style={{ fontSize:12, color:"#64748b", marginBottom:4 }}>{l}</div>
                <div style={{ fontSize:22, fontWeight:500, color:c }}>{v}</div>
              </div>
            ))}
          </div>
          {/* Add form */}
          <div style={{ background:"#f8fafc", borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
            <div style={{ fontSize:13, fontWeight:500, color:"#64748b", marginBottom:10 }}>添加食材</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
              <input value={ingName} onChange={e=>setIngName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addIng()} placeholder="食材名称" style={{ ...s.input, flex:2, minWidth:100 }} />
              <select value={ingZone} onChange={e=>setIngZone(e.target.value)} style={{ ...s.input, flex:1, minWidth:70 }}>
                <option>冷藏</option><option>冷冻</option><option>常温</option>
              </select>
              <input value={ingQty} onChange={e=>setIngQty(e.target.value)} placeholder="数量" type="number" style={{ ...s.input, flex:"0 0 70px" }} />
              <select value={ingUnit} onChange={e=>setIngUnit(e.target.value)} style={{ ...s.input, flex:"0 0 65px" }}>
                {["个","块","g","kg","ml","L","头","片","把","根","汤匙","茶匙"].map(u=><option key={u}>{u}</option>)}
              </select>
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
              <div style={{ flex:1, minWidth:130 }}>
                <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4 }}>入库日期</div>
                <input type="date" value={ingInDate} onChange={e=>setIngInDate(e.target.value)} style={s.input} />
              </div>
              <div style={{ flex:1, minWidth:130 }}>
                <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4 }}>保质天数（天）</div>
                <input value={ingShelfDays} onChange={e=>setIngShelfDays(e.target.value)} placeholder="如：7" type="number" style={s.input} />
              </div>
              {ingInDate && ingShelfDays && (
                <div style={{ flex:1, minWidth:130 }}>
                  <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4 }}>到期日</div>
                  <div style={{ padding:"8px 10px", borderRadius:8, background:"#fff", border:"0.5px solid #e2e8f0", fontSize:14, color:"#64748b" }}>
                    {addDays(ingInDate, parseInt(ingShelfDays))}
                  </div>
                </div>
              )}
            </div>
            <button onClick={addIng} style={{ padding:"8px 20px", borderRadius:8, border:"0.5px solid #6366f1", background:"#eef2ff", color:"#4338ca", fontSize:14, cursor:"pointer" }}>添加</button>
          </div>
          {/* Filters */}
          <div style={{ display:"flex", gap:8, marginBottom:"1rem", flexWrap:"wrap" }}>
            {[["all","全部"],["冷藏","冷藏"],["冷冻","冷冻"],["常温","常温"],["soon","即将过期"]].map(([f,l]) => (
              <button key={f} onClick={() => setIngFilter(f)} style={s.chip(ingFilter===f)}>{l}</button>
            ))}
          </div>
          {/* List */}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {filteredIng.length === 0
              ? <div style={{ textAlign:"center", padding:"2rem", color:"#94a3b8", fontSize:14 }}>暂无食材，快去添加吧</div>
              : filteredIng.map(it => {
                const exp = expiry(it.inDate, it.shelfDays);
                const st = getStatus(exp);
                return (
                  <div key={it.id} style={s.row(st)}>
                    <span style={{ fontSize:11, background:"#f1f5f9", border:"0.5px solid #e2e8f0", borderRadius:20, padding:"2px 8px", color:"#64748b" }}>{it.zone}</span>
                    <span style={{ flex:1, fontSize:14, fontWeight:500, color:"#1e293b" }}>{it.name}</span>
                    {it.qty!=null && <span style={{ fontSize:12, color:"#94a3b8" }}>{it.qty}{it.unit}</span>}
                    {exp && <span style={{ fontSize:12, color:"#64748b" }}>{getStatusLabel(exp)}</span>}
                    <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, fontWeight:500, background:ST_BG[st], color:ST_COLOR[st] }}>{ST_LABEL[st]}</span>
                    <button onClick={() => delIng(it.id)} style={{ background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:14, padding:"2px 6px" }}>✕</button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ══ PLAN ══ */}
      {tab === "plan" && (
        <div>
          {/* Week nav */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1rem" }}>
            <button onClick={() => setWeekOffset(w => w-1)} style={{ width:36, height:36, borderRadius:8, border:"0.5px solid #e2e8f0", background:"#fff", color:"#64748b", fontSize:16, cursor:"pointer" }}>‹</button>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:14, fontWeight:600, color:"#1e293b" }}>{weekLabel}</div>
              {weekOffset !== 0 && (
                <button onClick={() => setWeekOffset(0)} style={{ fontSize:11, color:"#6366f1", background:"none", border:"none", cursor:"pointer", marginTop:2, padding:0 }}>回到本周</button>
              )}
            </div>
            <button onClick={() => setWeekOffset(w => w+1)} style={{ width:36, height:36, borderRadius:8, border:"0.5px solid #e2e8f0", background:"#fff", color:"#64748b", fontSize:16, cursor:"pointer" }}>›</button>
          </div>
          {/* Day list */}
          <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:"1.5rem" }}>
            {weekDates.map((dt, i) => {
              const key = toDateStr(dt);
              const isToday = dt.getTime() === TODAY.getTime();
              const lunch = mealPlan[key+"_l"] || "";
              const dinner = mealPlan[key+"_d"] || "";
              return (
                <div key={i} style={{ display:"flex", alignItems:"stretch", gap:10, background:"#fff", border:`0.5px solid ${isToday?"#6366f1":"#e2e8f0"}`, borderRadius:12, padding:"8px 10px" }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", width:46, flexShrink:0, borderRight:"0.5px solid #f1f5f9", paddingRight:10 }}>
                    <div style={{ fontSize:11, color: isToday?"#6366f1":"#94a3b8", fontWeight: isToday?600:400 }}>周{DAYS[i]}</div>
                    <div style={{ fontSize:18, fontWeight:600, color: isToday?"#4338ca":"#1e293b", lineHeight:"22px" }}>{dt.getDate()}</div>
                    {isToday && <div style={{ fontSize:9, color:"#6366f1" }}>今天</div>}
                  </div>
                  <div style={{ flex:1, display:"flex", gap:8 }}>
                    <div onClick={() => { setPlanModal({key:key+"_l",type:"l"}); setPlanInput(lunch); }}
                      style={{ flex:1, borderRadius:8, padding:"6px 10px", cursor:"pointer", background:lunch?"#f0fdf4":"#f8fafc", minWidth:0 }}>
                      <div style={{ fontSize:10, color:"#94a3b8", marginBottom:2 }}>午餐</div>
                      <div style={{ fontSize:13, fontWeight: lunch?500:400, color:lunch?"#16a34a":"#cbd5e1", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{lunch||"+ 添加"}</div>
                    </div>
                    <div onClick={() => { setPlanModal({key:key+"_d",type:"d"}); setPlanInput(dinner); }}
                      style={{ flex:1, borderRadius:8, padding:"6px 10px", cursor:"pointer", background:dinner?"#f0fdf4":"#f8fafc", minWidth:0 }}>
                      <div style={{ fontSize:10, color:"#94a3b8", marginBottom:2 }}>晚餐</div>
                      <div style={{ fontSize:13, fontWeight: dinner?500:400, color:dinner?"#16a34a":"#cbd5e1", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{dinner||"+ 添加"}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Matched recipes suggestion */}
          {recipes.length > 0 && (
            <div>
              <div style={{ fontSize:13, fontWeight:500, color:"#64748b", marginBottom:8 }}>根据冰箱食材推荐</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {recipes.filter(r => matchRecipe(r, ingredients).score >= 0.5)
                  .sort((a,b) => matchRecipe(b,ingredients).score - matchRecipe(a,ingredients).score)
                  .slice(0,6).map(r => {
                    const m = matchRecipe(r, ingredients);
                    return (
                      <div key={r.id} style={{ background:"#fff", border:"0.5px solid #e2e8f0", borderRadius:10, padding:"8px 12px", display:"flex", alignItems:"center", gap:8, cursor:"pointer" }}
                        onClick={() => { setPlanModal({key: toDateStr(TODAY)+"_d", type:"d"}); setPlanInput(r.name); }}>
                        <span style={{ fontSize:18 }}>{r.icon}</span>
                        <div>
                          <div style={{ fontSize:13, fontWeight:500 }}>{r.name}</div>
                          <div style={{ fontSize:11, color: m.score>=0.8?"#16a34a":"#d97706" }}>{m.score>=0.8?"✓ 食材充足":"◑ 部分食材"}</div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ RECIPES ══ */}
      {tab === "recipes" && (
        <div>
          {/* Tag management */}
          <div style={{ background:"#f8fafc", borderRadius:10, padding:"10px 12px", marginBottom:"1rem" }}>
            <div style={{ fontSize:12, color:"#64748b", marginBottom:8 }}>标签管理</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {allTags.map(tag => (
                <span key={tag} style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, padding:"3px 10px", borderRadius:20, background:"#eef2ff", color:"#4338ca", border:"0.5px solid #c7d2fe" }}>
                  {tag}
                  <button onClick={() => delTag(tag)} style={{ background:"none", border:"none", color:"#6366f1", cursor:"pointer", fontSize:12, padding:0, lineHeight:1 }}>×</button>
                </span>
              ))}
              <div style={{ display:"flex", gap:4 }}>
                <input value={newTag} onChange={e=>setNewTag(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTag()} placeholder="新标签" style={{ padding:"3px 8px", borderRadius:20, border:"0.5px solid #e2e8f0", fontSize:12, width:80 }} />
                <button onClick={addTag} style={{ padding:"3px 10px", borderRadius:20, border:"0.5px solid #6366f1", background:"#eef2ff", color:"#4338ca", fontSize:12, cursor:"pointer" }}>+</button>
              </div>
            </div>
          </div>
          {/* Filters + Add button */}
          <div style={{ display:"flex", gap:8, marginBottom:"1rem", flexWrap:"wrap", alignItems:"center" }}>
            {[["all","全部"],["可做","食材足够"],...allTags.map(t=>[t,t])].map(([f,l]) => (
              <button key={f} onClick={() => setRecipeFilter(f)} style={s.chip(recipeFilter===f)}>{l}</button>
            ))}
            <button onClick={() => setShowAddRecipe(true)} style={{ marginLeft:"auto", padding:"6px 16px", borderRadius:8, border:"none", background:"#4338ca", color:"#fff", fontSize:13, cursor:"pointer", fontWeight:500 }}>+ 添加菜谱</button>
          </div>
          {/* Recipe grid */}
          {filteredRecipes.length === 0
            ? <div style={{ textAlign:"center", padding:"3rem", color:"#94a3b8", fontSize:14 }}>{recipes.length===0?"菜谱库是空的，点击右上角添加你的第一道菜吧 🍳":"没有匹配的菜谱"}</div>
            : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12 }}>
                {filteredRecipes.map(r => {
                  const m = matchRecipe(r, ingredients);
                  const mc = m.score>=0.8?"#16a34a":m.score>=0.5?"#d97706":"#94a3b8";
                  const ml = m.score>=0.8?"✓ 食材充足":m.score>=0.5?"◑ 部分足够":"○ 食材不足";
                  return (
                    <div key={r.id} style={{ background:"#fff", border:"0.5px solid #e2e8f0", borderRadius:12, padding:"1rem", cursor:"pointer", position:"relative" }}
                      onClick={() => { setAnalyzing(r); setAnalyzeServings(r.servings||2); }}
                      onMouseEnter={e=>{ e.currentTarget.style.borderColor="#6366f1"; e.currentTarget.style.background="#eef2ff"; }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.background="#fff"; }}>
                      <button onClick={e=>{ e.stopPropagation(); delRecipe(r.id); }} style={{ position:"absolute", top:8, right:8, background:"none", border:"none", color:"#cbd5e1", cursor:"pointer", fontSize:14 }}>✕</button>
                      <div style={{ fontSize:26, marginBottom:6 }}>{r.icon}</div>
                      <div style={{ fontSize:14, fontWeight:500, color:"#1e293b", marginBottom:4 }}>{r.name}</div>
                      {r.tags?.length>0 && <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:6 }}>{r.tags.map(t=><span key={t} style={{ fontSize:10, padding:"1px 6px", borderRadius:20, background:"#f1f5f9", color:"#64748b" }}>{t}</span>)}</div>}
                      <div style={{ fontSize:11, color:"#94a3b8" }}>⏱ {r.time} · {r.servings}人份</div>
                      <div style={{ fontSize:11, color:mc, marginTop:4 }}>{ml}</div>
                      <div style={{ fontSize:11, color:"#6366f1", marginTop:4 }}>点击查看分析 →</div>
                    </div>
                  );
                })}
              </div>
          }
        </div>
      )}
    </div>
  );
}
