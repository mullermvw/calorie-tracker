import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  Trash2,
  Settings,
  X,
  Loader2,
  ImagePlus,
  Pencil,
  UtensilsCrossed,
  Plus,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
} from "recharts";

const COLORS = {
  bg: "#EDEAE2",
  card: "#FFFFFF",
  ink: "#2B2823",
  inkSoft: "#847C6E",
  line: "#DDD7C8",
  avocado: "#3F5A3E",
  avocadoSoft: "#DCE5DA",
  mango: "#D98A2B",
  mangoSoft: "#F3E2C8",
  tomato: "#B23A2A",
  tomatoSoft: "#F2DAD5",
};

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function niceDate(d = new Date()) {
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function resizeImage(file, maxDim = 640, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the photo"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load the photo"));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function estimateNutrition({ imageBase64, notesText, descriptionText }) {
  let content;
  if (imageBase64) {
    let promptText = "Look at this meal photo and estimate its nutrition.";
    if (notesText && notesText.trim()) {
      promptText += ` The user has also noted these specific ingredients or details to make the estimate more accurate: "${notesText.trim()}". Weigh these notes alongside what you see in the photo — they take priority over guesswork.`;
    }
    promptText +=
      ' Respond with ONLY raw JSON, no markdown fences, no preamble, in exactly this shape: {"meal_name": "short name", "items": ["item 1", "item 2"], "calories": number, "protein_g": number, "confidence": "low|medium|high", "note": "one short sentence caveat about the estimate"}. Estimate for the full visible portion shown.';
    content = [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
      { type: "text", text: promptText },
    ];
  } else {
    const promptText = `Estimate the nutrition for a meal made of these ingredients (use any quantities given, otherwise assume a typical single serving amount):\n${descriptionText}\n\nRespond with ONLY raw JSON, no markdown fences, no preamble, in exactly this shape: {"meal_name": "short name", "items": ["item 1", "item 2"], "calories": number, "protein_g": number, "confidence": "low|medium|high", "note": "one short sentence caveat about the estimate"}.`;
    content = [{ type: "text", text: promptText }];
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content }],
    }),
  });
  const data = await response.json();
  const text = (data.content || []).map((b) => b.text || "").join("").trim();
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

function PlateRing({ value, goal, label, color, softColor, unit }) {
  const size = 168;
  const stroke = 13;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r + stroke / 2 + 4} fill="none" stroke={COLORS.line} strokeWidth={1.5} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={softColor} strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 30, fontWeight: 600, color: COLORS.ink, lineHeight: 1 }}>
            {Math.round(value)}
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.inkSoft, marginTop: 4 }}>
            / {goal}{unit}
          </span>
        </div>
      </div>
      <span style={{ fontFamily: "'Fraunces', serif", fontSize: 16, color: COLORS.ink, letterSpacing: 0.2 }}>{label}</span>
    </div>
  );
}

function ConfidenceBadge({ confidence }) {
  const map = {
    high: { bg: COLORS.avocadoSoft, fg: COLORS.avocado, text: "High confidence" },
    medium: { bg: COLORS.mangoSoft, fg: COLORS.mango, text: "Medium confidence" },
    low: { bg: COLORS.tomatoSoft, fg: COLORS.tomato, text: "Low confidence" },
    manual: { bg: "#EAE7DF", fg: COLORS.inkSoft, text: "Manual entry" },
  };
  const c = map[confidence] || map.medium;
  return (
    <span style={{ background: c.bg, color: c.fg, fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>
      {c.text}
    </span>
  );
}

function Thumb({ thumbnail, name, size = 56 }) {
  if (thumbnail) {
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0, border: `2px solid ${COLORS.line}` }}>
        <img src={thumbnail} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        border: `2px solid ${COLORS.line}`,
        background: COLORS.mangoSoft,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <UtensilsCrossed size={size * 0.38} color={COLORS.mango} />
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${COLORS.line}`,
  fontFamily: "'Inter', sans-serif",
  fontSize: 14.5,
  color: COLORS.ink,
  background: "#fff",
};

const labelStyle = { display: "block", fontSize: 13, color: COLORS.inkSoft, marginBottom: 6, marginTop: 14 };

const primaryBtn = {
  width: "100%",
  background: COLORS.avocado,
  color: "#fff",
  border: "none",
  borderRadius: 10,
  padding: "12px",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 14.5,
  fontFamily: "'Inter', sans-serif",
};

const secondaryBtn = {
  width: "100%",
  background: "#fff",
  color: COLORS.ink,
  border: `1px solid ${COLORS.line}`,
  borderRadius: 10,
  padding: "12px",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 14.5,
  fontFamily: "'Inter', sans-serif",
};

function segBtn(active) {
  return {
    flex: 1,
    padding: "9px 0",
    borderRadius: 999,
    border: "none",
    cursor: "pointer",
    fontSize: 13.5,
    fontWeight: 600,
    fontFamily: "'Inter', sans-serif",
    background: active ? COLORS.avocado : "transparent",
    color: active ? "#fff" : COLORS.inkSoft,
    transition: "background 0.2s ease",
  };
}

function ResultPreview({ preview, onSave, onDiscard }) {
  if (!preview) return null;
  return (
    <div style={{ marginTop: 16, background: COLORS.avocadoSoft, borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600 }}>{preview.meal_name || preview.name}</span>
        <ConfidenceBadge confidence={preview.confidence} />
      </div>
      {(preview.items || []).length > 0 && (
        <div style={{ color: COLORS.inkSoft, fontSize: 13, marginTop: 6 }}>{(preview.items || []).join(", ")}</div>
      )}
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, marginTop: 10 }}>
        <span style={{ color: COLORS.avocado, fontWeight: 700 }}>{Math.round(preview.calories ?? preview.calories_g ?? 0)}</span> cal ·{" "}
        <span style={{ color: COLORS.mango, fontWeight: 700 }}>{Math.round(preview.protein_g ?? preview.protein ?? 0)}g</span> protein
      </div>
      {preview.note && <div style={{ color: COLORS.inkSoft, fontSize: 12.5, marginTop: 6 }}>{preview.note}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button onClick={onDiscard} style={{ ...secondaryBtn, flex: 1 }}>Redo</button>
        <button onClick={onSave} style={{ ...primaryBtn, flex: 1 }}>Save meal</button>
      </div>
    </div>
  );
}

export default function MealTracker() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState("today"); // "today" | "week"
  const [meals, setMeals] = useState([]);
  const [goals, setGoals] = useState({ calories: 2000, protein: 90 });
  const [error, setError] = useState(null);

  const [showSettings, setShowSettings] = useState(false);
  const [draftGoals, setDraftGoals] = useState(goals);

  const [showAdd, setShowAdd] = useState(false);
  const [addTab, setAddTab] = useState("photo"); // "photo" | "manual"
  const [photoData, setPhotoData] = useState(null); // { dataUrl, base64 }
  const [notesText, setNotesText] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualIngredients, setManualIngredients] = useState("");
  const [manualOverride, setManualOverride] = useState(false);
  const [manualCalories, setManualCalories] = useState("");
  const [manualProtein, setManualProtein] = useState("");
  const [estimating, setEstimating] = useState(false);
  const [preview, setPreview] = useState(null);

  const [editMeal, setEditMeal] = useState(null);
  const [refineNotes, setRefineNotes] = useState("");
  const [editCalories, setEditCalories] = useState("");
  const [editProtein, setEditProtein] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const [weekData, setWeekData] = useState([]);
  const [weekLoading, setWeekLoading] = useState(false);

  const modalFileInputRef = useRef(null);
  const dateKey = todayKey();

  useEffect(() => {
    (async () => {
      try {
        const g = await window.storage.get("goals");
        if (g && g.value) setGoals(JSON.parse(g.value));
      } catch (e) {}
      try {
        const m = await window.storage.get(`meals:${dateKey}`);
        if (m && m.value) setMeals(JSON.parse(m.value));
      } catch (e) {}
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (view === "week") loadWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const saveMeals = useCallback(
    async (next) => {
      setMeals(next);
      try {
        await window.storage.set(`meals:${dateKey}`, JSON.stringify(next));
      } catch (e) {
        console.error("Could not save meal log", e);
      }
    },
    [dateKey]
  );

  const saveGoals = async (next) => {
    setGoals(next);
    try {
      await window.storage.set("goals", JSON.stringify(next));
    } catch (e) {
      console.error("Could not save goals", e);
    }
  };

  function buildWeekDates() {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      arr.push(d);
    }
    return arr;
  }

  async function loadWeek() {
    setWeekLoading(true);
    const dates = buildWeekDates();
    const results = [];
    for (const d of dates) {
      const key = todayKey(d);
      let dayMeals = [];
      try {
        const res = await window.storage.get(`meals:${key}`);
        if (res && res.value) dayMeals = JSON.parse(res.value);
      } catch (e) {}
      const calories = dayMeals.reduce((s, m) => s + (m.calories || 0), 0);
      const protein = dayMeals.reduce((s, m) => s + (m.protein || 0), 0);
      results.push({
        date: key,
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
        full: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        calories,
        protein,
        count: dayMeals.length,
        isToday: key === dateKey,
      });
    }
    setWeekData(results);
    setWeekLoading(false);
  }

  function resetAddModal() {
    setPhotoData(null);
    setNotesText("");
    setManualName("");
    setManualIngredients("");
    setManualOverride(false);
    setManualCalories("");
    setManualProtein("");
    setPreview(null);
    setError(null);
  }

  function openAdd() {
    resetAddModal();
    setAddTab("photo");
    setShowAdd(true);
  }

  function closeAdd() {
    setShowAdd(false);
    resetAddModal();
  }

  async function handleModalPhotoSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await resizeImage(file);
      setPhotoData({ dataUrl, base64: dataUrl.split(",")[1] });
      setPreview(null);
    } catch (err) {
      setError("Couldn't read that photo. Try a different one.");
    }
  }

  async function estimateFromPhoto() {
    if (!photoData) return;
    setEstimating(true);
    setError(null);
    try {
      const result = await estimateNutrition({ imageBase64: photoData.base64, notesText });
      setPreview(result);
    } catch (err) {
      console.error(err);
      setError("Couldn't estimate that meal. Try again, or add a bit more detail below.");
    } finally {
      setEstimating(false);
    }
  }

  async function estimateFromManual() {
    if (!manualIngredients.trim()) {
      setError("Add at least one ingredient first.");
      return;
    }
    setEstimating(true);
    setError(null);
    try {
      const description = `${manualName ? `Meal name: ${manualName}\n` : ""}Ingredients:\n${manualIngredients}`;
      const result = await estimateNutrition({ descriptionText: description });
      setPreview(result);
    } catch (err) {
      console.error(err);
      setError("Couldn't estimate that meal. Double check the ingredient list and try again.");
    } finally {
      setEstimating(false);
    }
  }

  async function saveFromPreview() {
    const entry = {
      id: `${Date.now()}`,
      time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      thumbnail: photoData ? photoData.dataUrl : null,
      name: preview.meal_name || manualName || "Meal",
      items: preview.items || [],
      calories: Number(preview.calories) || 0,
      protein: Number(preview.protein_g) || 0,
      confidence: preview.confidence || "medium",
      note: preview.note || "",
    };
    await saveMeals([entry, ...meals]);
    closeAdd();
  }

  async function saveManualDirect() {
    if (!manualCalories && !manualProtein) {
      setError("Enter at least a calorie or protein value.");
      return;
    }
    const entry = {
      id: `${Date.now()}`,
      time: new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      thumbnail: null,
      name: manualName || "Meal",
      items: manualIngredients.split("\n").map((s) => s.trim()).filter(Boolean),
      calories: Number(manualCalories) || 0,
      protein: Number(manualProtein) || 0,
      confidence: "manual",
      note: "Entered manually",
    };
    await saveMeals([entry, ...meals]);
    closeAdd();
  }

  const deleteMeal = async (id) => {
    await saveMeals(meals.filter((m) => m.id !== id));
  };

  function openEdit(meal) {
    setEditMeal(meal);
    setRefineNotes("");
    setEditCalories(String(meal.calories));
    setEditProtein(String(meal.protein));
    setError(null);
  }

  function closeEdit() {
    setEditMeal(null);
    setRefineNotes("");
    setError(null);
  }

  async function recalcEdit() {
    if (!editMeal) return;
    setEditBusy(true);
    setError(null);
    try {
      let result;
      if (editMeal.thumbnail) {
        const base64 = editMeal.thumbnail.split(",")[1];
        result = await estimateNutrition({ imageBase64: base64, notesText: refineNotes });
      } else {
        const description = `${editMeal.name ? `Meal name: ${editMeal.name}\n` : ""}Ingredients:\n${(editMeal.items || []).join("\n")}\n${refineNotes}`;
        result = await estimateNutrition({ descriptionText: description });
      }
      const updated = {
        ...editMeal,
        name: result.meal_name || editMeal.name,
        items: result.items || editMeal.items,
        calories: Number(result.calories) || editMeal.calories,
        protein: Number(result.protein_g) || editMeal.protein,
        confidence: result.confidence || "medium",
        note: result.note || "",
      };
      await saveMeals(meals.map((m) => (m.id === editMeal.id ? updated : m)));
      closeEdit();
    } catch (err) {
      console.error(err);
      setError("Couldn't recalculate that estimate. Try again.");
    } finally {
      setEditBusy(false);
    }
  }

  async function saveEditNumbers() {
    const updated = {
      ...editMeal,
      calories: Number(editCalories) || 0,
      protein: Number(editProtein) || 0,
      confidence: "manual",
      note: "Edited manually",
    };
    await saveMeals(meals.map((m) => (m.id === editMeal.id ? updated : m)));
    closeEdit();
  }

  const totals = meals.reduce(
    (acc, m) => ({ calories: acc.calories + m.calories, protein: acc.protein + m.protein }),
    { calories: 0, protein: 0 }
  );

  if (!ready) return null;

  return (
    <div style={{ background: COLORS.bg, minHeight: "100%", fontFamily: "'Inter', sans-serif", color: COLORS.ink, paddingBottom: 100 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
        * { box-sizing: border-box; }
        button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid ${COLORS.avocado}; outline-offset: 2px; }
        textarea { font-family: 'Inter', sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ maxWidth: 460, margin: "0 auto", padding: "28px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600 }}>
              {view === "today" ? "Today's plate" : "This week"}
            </div>
            <div style={{ color: COLORS.inkSoft, fontSize: 14, marginTop: 2 }}>
              {view === "today" ? niceDate() : weekData.length ? `${weekData[0].full} – ${weekData[6].full}` : ""}
            </div>
          </div>
          <button
            onClick={() => {
              setDraftGoals(goals);
              setShowSettings(true);
            }}
            aria-label="Edit goals"
            style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 999, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <Settings size={18} color={COLORS.inkSoft} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 4, background: "#E2DDCF", borderRadius: 999, padding: 4, marginTop: 18 }}>
          <button style={segBtn(view === "today")} onClick={() => setView("today")}>Today</button>
          <button style={segBtn(view === "week")} onClick={() => setView("week")}>This week</button>
        </div>

        {view === "today" ? (
          <>
            <div style={{ background: COLORS.card, borderRadius: 20, border: `1px solid ${COLORS.line}`, marginTop: 20, padding: "24px 16px", display: "flex", justifyContent: "space-around" }}>
              <PlateRing value={totals.calories} goal={goals.calories} label="Calories" color={COLORS.avocado} softColor={COLORS.avocadoSoft} unit="" />
              <PlateRing value={totals.protein} goal={goals.protein} label="Protein" color={COLORS.mango} softColor={COLORS.mangoSoft} unit="g" />
            </div>

            {error && (
              <div style={{ marginTop: 16, background: COLORS.tomatoSoft, border: `1px solid ${COLORS.tomato}`, color: COLORS.tomato, borderRadius: 12, padding: "10px 14px", fontSize: 14 }}>
                {error}
              </div>
            )}

            <div style={{ marginTop: 28 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, marginBottom: 12 }}>Meals logged</div>

              {meals.length === 0 && (
                <div style={{ color: COLORS.inkSoft, fontSize: 14, background: COLORS.card, border: `1px dashed ${COLORS.line}`, borderRadius: 16, padding: "28px 16px", textAlign: "center" }}>
                  Nothing logged yet. Add a meal photo, or enter one manually, to start tracking today.
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {meals.map((m) => (
                  <div key={m.id} style={{ display: "flex", gap: 12, background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: 12, alignItems: "center" }}>
                    <Thumb thumbnail={m.thumbnail} name={m.name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 15.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
                        <span style={{ color: COLORS.inkSoft, fontSize: 12, flexShrink: 0 }}>{m.time}</span>
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: COLORS.ink, marginTop: 4 }}>
                        <span style={{ color: COLORS.avocado, fontWeight: 600 }}>{m.calories}</span> cal ·{" "}
                        <span style={{ color: COLORS.mango, fontWeight: 600 }}>{m.protein}g</span> protein
                      </div>
                      {m.note && <div style={{ color: COLORS.inkSoft, fontSize: 12, marginTop: 3 }}>{m.note}</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => openEdit(m)} aria-label={`Edit ${m.name}`} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                        <Pencil size={16} color={COLORS.inkSoft} />
                      </button>
                      <button onClick={() => deleteMeal(m.id)} aria-label={`Remove ${m.name}`} style={{ background: "none", border: "none", cursor: "pointer", padding: 6 }}>
                        <Trash2 size={16} color={COLORS.inkSoft} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div style={{ marginTop: 20 }}>
            {weekLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: COLORS.inkSoft, fontSize: 14, padding: "20px 0" }}>
                <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                Loading the week…
              </div>
            ) : (
              <>
                <div style={{ background: COLORS.card, borderRadius: 20, border: `1px solid ${COLORS.line}`, padding: "18px 14px" }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, marginBottom: 8, color: COLORS.avocado }}>Calories</div>
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={weekData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 8, fontSize: 12 }}
                        formatter={(v) => [`${v} cal`, ""]}
                        labelFormatter={() => ""}
                      />
                      <ReferenceLine y={goals.calories} stroke={COLORS.tomato} strokeDasharray="4 4" />
                      <Bar dataKey="calories" fill={COLORS.avocado} radius={[6, 6, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ background: COLORS.card, borderRadius: 20, border: `1px solid ${COLORS.line}`, padding: "18px 14px", marginTop: 14 }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, marginBottom: 8, color: COLORS.mango }}>Protein</div>
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={weekData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 8, fontSize: 12 }}
                        formatter={(v) => [`${v} g`, ""]}
                        labelFormatter={() => ""}
                      />
                      <ReferenceLine y={goals.protein} stroke={COLORS.tomato} strokeDasharray="4 4" />
                      <Bar dataKey="protein" fill={COLORS.mango} radius={[6, 6, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                  {weekData.map((d) => (
                    <div
                      key={d.date}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: d.isToday ? COLORS.avocadoSoft : COLORS.card,
                        border: `1px solid ${d.isToday ? COLORS.avocado : COLORS.line}`,
                        borderRadius: 12,
                        padding: "10px 14px",
                      }}
                    >
                      <span style={{ fontSize: 13.5, fontWeight: d.isToday ? 600 : 500 }}>{d.full}{d.isToday ? " · today" : ""}</span>
                      {d.count > 0 ? (
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5 }}>
                          <span style={{ color: COLORS.avocado, fontWeight: 600 }}>{d.calories}</span> cal ·{" "}
                          <span style={{ color: COLORS.mango, fontWeight: 600 }}>{d.protein}g</span>
                        </span>
                      ) : (
                        <span style={{ fontSize: 12.5, color: COLORS.inkSoft }}>No meals logged</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {view === "today" && (
        <div style={{ position: "fixed", bottom: 24, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <button
            onClick={openAdd}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: COLORS.avocado,
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "14px 26px",
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "'Inter', sans-serif",
              cursor: "pointer",
              boxShadow: "0 8px 24px rgba(63,90,62,0.35)",
            }}
          >
            <Plus size={18} />
            Add meal
          </button>
        </div>
      )}

      {/* Goals modal */}
      {showSettings && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(43,40,35,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 10 }}>
          <div style={{ background: COLORS.card, borderRadius: 20, padding: 24, width: "100%", maxWidth: 360 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600 }}>Daily goals</span>
              <button onClick={() => setShowSettings(false)} style={{ background: "none", border: "none", cursor: "pointer" }} aria-label="Close">
                <X size={20} color={COLORS.inkSoft} />
              </button>
            </div>
            <label style={labelStyle}>Calories</label>
            <input type="number" value={draftGoals.calories} onChange={(e) => setDraftGoals({ ...draftGoals, calories: Number(e.target.value) })} style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace" }} />
            <label style={labelStyle}>Protein (g)</label>
            <input type="number" value={draftGoals.protein} onChange={(e) => setDraftGoals({ ...draftGoals, protein: Number(e.target.value) })} style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace" }} />
            <button
              onClick={async () => {
                await saveGoals(draftGoals);
                setShowSettings(false);
              }}
              style={{ ...primaryBtn, marginTop: 20 }}
            >
              Save goals
            </button>
          </div>
        </div>
      )}

      {/* Add meal modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(43,40,35,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 10 }}>
          <div style={{ background: COLORS.card, borderRadius: 20, padding: 24, width: "100%", maxWidth: 400, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600 }}>Add a meal</span>
              <button onClick={closeAdd} style={{ background: "none", border: "none", cursor: "pointer" }} aria-label="Close">
                <X size={20} color={COLORS.inkSoft} />
              </button>
            </div>

            <div style={{ display: "flex", gap: 4, background: "#E2DDCF", borderRadius: 999, padding: 4 }}>
              <button style={segBtn(addTab === "photo")} onClick={() => { setAddTab("photo"); setPreview(null); setError(null); }}>Photo</button>
              <button style={segBtn(addTab === "manual")} onClick={() => { setAddTab("manual"); setPreview(null); setError(null); }}>Manual entry</button>
            </div>

            {error && (
              <div style={{ marginTop: 14, background: COLORS.tomatoSoft, border: `1px solid ${COLORS.tomato}`, color: COLORS.tomato, borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
                {error}
              </div>
            )}

            {addTab === "photo" && (
              <div style={{ marginTop: 16 }}>
                {!photoData && (
                  <button
                    onClick={() => modalFileInputRef.current?.click()}
                    style={{
                      width: "100%",
                      border: `1.5px dashed ${COLORS.line}`,
                      borderRadius: 14,
                      background: "transparent",
                      padding: "30px 16px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      color: COLORS.inkSoft,
                    }}
                  >
                    <Camera size={22} color={COLORS.avocado} />
                    <span style={{ fontSize: 14 }}>Choose or take a photo</span>
                  </button>
                )}

                {photoData && !preview && (
                  <>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <img src={photoData.dataUrl} alt="Meal preview" style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover", border: `1px solid ${COLORS.line}` }} />
                      <button onClick={() => modalFileInputRef.current?.click()} style={{ ...secondaryBtn, width: "auto", padding: "8px 14px", fontSize: 13 }}>
                        Choose different photo
                      </button>
                    </div>
                    <label style={labelStyle}>Add ingredient details for a more accurate estimate (optional)</label>
                    <textarea
                      value={notesText}
                      onChange={(e) => setNotesText(e.target.value)}
                      placeholder={"e.g. extra 2 tbsp olive oil dressing, no rice, large portion"}
                      rows={3}
                      style={{ ...inputStyle, resize: "vertical" }}
                    />
                    <button onClick={estimateFromPhoto} disabled={estimating} style={{ ...primaryBtn, marginTop: 16, opacity: estimating ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      {estimating && <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />}
                      {estimating ? "Estimating…" : "Estimate nutrition"}
                    </button>
                  </>
                )}

                <ResultPreview
                  preview={preview}
                  onSave={saveFromPreview}
                  onDiscard={() => setPreview(null)}
                />
              </div>
            )}

            {addTab === "manual" && (
              <div style={{ marginTop: 16 }}>
                <label style={{ ...labelStyle, marginTop: 0 }}>Meal name (optional)</label>
                <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="e.g. Lunch" style={inputStyle} />

                <label style={labelStyle}>Ingredients, one per line</label>
                <textarea
                  value={manualIngredients}
                  onChange={(e) => setManualIngredients(e.target.value)}
                  placeholder={"2 eggs\n1 slice whole wheat toast\n1 tsp butter"}
                  rows={4}
                  style={{ ...inputStyle, resize: "vertical" }}
                />

                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13.5, color: COLORS.ink, cursor: "pointer" }}>
                  <input type="checkbox" checked={manualOverride} onChange={(e) => { setManualOverride(e.target.checked); setPreview(null); }} />
                  I already know the calories and protein
                </label>

                {manualOverride ? (
                  <>
                    <label style={labelStyle}>Calories</label>
                    <input type="number" value={manualCalories} onChange={(e) => setManualCalories(e.target.value)} style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace" }} />
                    <label style={labelStyle}>Protein (g)</label>
                    <input type="number" value={manualProtein} onChange={(e) => setManualProtein(e.target.value)} style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace" }} />
                    <button onClick={saveManualDirect} style={{ ...primaryBtn, marginTop: 16 }}>Save meal</button>
                  </>
                ) : (
                  <>
                    {!preview && (
                      <button onClick={estimateFromManual} disabled={estimating} style={{ ...primaryBtn, marginTop: 16, opacity: estimating ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        {estimating && <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />}
                        {estimating ? "Estimating…" : "Estimate nutrition"}
                      </button>
                    )}
                    <ResultPreview preview={preview} onSave={saveFromPreview} onDiscard={() => setPreview(null)} />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <input ref={modalFileInputRef} type="file" accept="image/*" onChange={handleModalPhotoSelect} style={{ display: "none" }} />

      {/* Edit / refine meal modal */}
      {editMeal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(43,40,35,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 10 }}>
          <div style={{ background: COLORS.card, borderRadius: 20, padding: 24, width: "100%", maxWidth: 400, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600 }}>{editMeal.name}</span>
              <button onClick={closeEdit} style={{ background: "none", border: "none", cursor: "pointer" }} aria-label="Close">
                <X size={20} color={COLORS.inkSoft} />
              </button>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
              <Thumb thumbnail={editMeal.thumbnail} name={editMeal.name} size={48} />
              <div style={{ fontSize: 13, color: COLORS.inkSoft }}>{(editMeal.items || []).join(", ") || "No ingredients listed"}</div>
            </div>

            {error && (
              <div style={{ marginTop: 4, marginBottom: 10, background: COLORS.tomatoSoft, border: `1px solid ${COLORS.tomato}`, color: COLORS.tomato, borderRadius: 10, padding: "9px 12px", fontSize: 13 }}>
                {error}
              </div>
            )}

            <label style={{ ...labelStyle, marginTop: 6 }}>Add ingredient details to refine the estimate</label>
            <textarea
              value={refineNotes}
              onChange={(e) => setRefineNotes(e.target.value)}
              placeholder="e.g. also had 1 tbsp peanut butter, portion was half this size"
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <button onClick={recalcEdit} disabled={editBusy} style={{ ...primaryBtn, marginTop: 12, opacity: editBusy ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {editBusy && <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />}
              {editBusy ? "Recalculating…" : "Recalculate with AI"}
            </button>

            <div style={{ borderTop: `1px solid ${COLORS.line}`, marginTop: 20, paddingTop: 16 }}>
              <div style={{ fontSize: 13, color: COLORS.inkSoft, marginBottom: 8 }}>Or enter the numbers yourself</div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelStyle, marginTop: 0 }}>Calories</label>
                  <input type="number" value={editCalories} onChange={(e) => setEditCalories(e.target.value)} style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ ...labelStyle, marginTop: 0 }}>Protein (g)</label>
                  <input type="number" value={editProtein} onChange={(e) => setEditProtein(e.target.value)} style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace" }} />
                </div>
              </div>
              <button onClick={saveEditNumbers} style={{ ...secondaryBtn, marginTop: 12 }}>Save these numbers</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
