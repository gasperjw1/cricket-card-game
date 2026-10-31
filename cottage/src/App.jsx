import { useState, useEffect, useCallback, useRef } from "react";
import WildReignScreen from "./WildReignScreen";

const BASE                = import.meta.env.BASE_URL;
const IMG_GIRL            = BASE + "girl.png";
const IMG_GUY             = BASE + "guy.png";
const IMG_COTTAGE_ROOM             = BASE + "cottage_room.png";
const IMG_COTTAGE_ROOM_OCCUPIED    = BASE + "cottage_room_occupied.jpeg";
const IMG_BROWNSTONE_ROOM          = BASE + "brownstone_room.jpeg";
const IMG_BROWNSTONE_ROOM_OCCUPIED = BASE + "brownstone_room_occupied.jpeg";
const IMG_EXT             = BASE + "exterior.png";
const IMG_SHOP            = BASE + "flower_shop.jpeg";
const IMG_SHOP_OCCUPIED   = BASE + "flower_shop_occupied.jpeg";
const IMG_POT_IN_HAND     = BASE + "pot_in_hand.png";

// ─── Constants ────────────────────────────────────────────────────────────────
const WEEK_MS = 7 * 86_400_000;
const MAX_INVENTORY = 6;

const FLOWERS = [
  { name: "Rose",          key: "rose",          emoji: "🌹", price: 10 },
  { name: "Tulip",         key: "tulip",         emoji: "🌷", price: 10 },
  { name: "Sunflower",     key: "sunflower",     emoji: "🌻", price: 10 },
  { name: "Lily",          key: "lily",          emoji: "🌸", price: 10 },
  { name: "Orchid",        key: "orchid",        emoji: "🪷", price: 10 },
  { name: "Hydrangea",     key: "hydrangea",     emoji: "💐", price: 10 },
  { name: "Daisy",         key: "daisy",         emoji: "🌼", price: 10 },
  { name: "Carnation",     key: "carnation",     emoji: "🌺", price: 10 },
  { name: "Peony",         key: "peony",         emoji: "🌸", price: 10 },
  { name: "Chrysanthemum", key: "chrysanthemum", emoji: "🌼", price: 10 },
  { name: "Gerbera Daisy", key: "gerbera_daisy", emoji: "🌻", price: 10 },
  { name: "Daffodil",      key: "daffodil",      emoji: "🌼", price: 10 },
  { name: "Lavender",      key: "lavender",      emoji: "💜", price: 10 },
  { name: "Marigold",      key: "marigold",      emoji: "🌼", price: 10 },
  { name: "Gladiolus",     key: "gladiolus",     emoji: "🌷", price: 10 },
];

// flower image paths
function flowerImg(key, type) {
  // type: "potted" | "single_bloomed" | "singular_unbloomed" | "bouquet_bloomed" | "bouquet_unbloomed"
  return `${BASE}flowers/${type}_${key}.png`;
}

// given a phase ("unbloomed"|"bloomed"), return the right single-flower image
function flowerPhaseImg(key, phase) {
  return phase === "bloomed" ? flowerImg(key, "single_bloomed") : flowerImg(key, "singular_unbloomed");
}

const AVATARS = [
  { key: "girl", src: IMG_GIRL, label: "Her" },
  { key: "guy",  src: IMG_GUY,  label: "Him" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function other(house) { return house === "left" ? "right" : "left"; }

// Player is "online" if they polled within the last 2.5 minutes
function isOnline(player) {
  return player?.lastSeen != null && Date.now() - player.lastSeen < 150_000;
}

function formatCountdown(ms) {
  if (ms <= 0) return "now";
  const DAY   = 86_400_000;
  const days  = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / 3_600_000);
  const mins  = Math.floor((ms % 3_600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function makeApi(token) {
  return async function api(path, body = undefined) {
    const res = await fetch(`/cottage/api/${path}`, {
      method: body !== undefined ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }
    return res.json();
  };
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const CREAM = "#FDF8F0";
const WARM  = "#8B6914";
const SAGE  = "#6B7C5E";
const TERRA = "#C85A2E";
const FF    = "'Playfair Display', serif";
const LF    = "'Lato', sans-serif";

function btn(variant) {
  const base = {
    padding: "9px 20px", borderRadius: 8, border: "none",
    cursor: "pointer", fontFamily: LF, fontWeight: 600, fontSize: 14,
    transition: "opacity .15s",
  };
  if (variant === "sage")  return { ...base, background: SAGE,  color: "white" };
  if (variant === "ghost") return { ...base, background: "transparent", color: WARM, border: "1.5px solid " + WARM };
  if (variant === "muted") return { ...base, background: "#E8E0D0", color: WARM };
  return { ...base, background: TERRA, color: "white" };
}

const card = {
  background: CREAM, borderRadius: 16, padding: 28,
  maxWidth: 480, width: "100%",
  boxShadow: "0 16px 48px rgba(0,0,0,.22)",
  maxHeight: "90vh", overflowY: "auto",
  fontFamily: LF,
};

const overlay = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,.52)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 100, padding: 20,
};

const inp = {
  padding: "10px 14px", borderRadius: 8,
  border: "1.5px solid " + WARM, fontFamily: LF, fontSize: 15,
  background: "white", color: "#333", outline: "none",
};

function ModalHeader({ title, onClose }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <h2 style={{ fontFamily: FF, color: WARM, margin: 0, fontSize: "1.3rem" }}>{title}</h2>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: SAGE, lineHeight: 1 }}>✕</button>
    </div>
  );
}

function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#F0EAE0", borderRadius: 8, padding: 4 }}>
      {tabs.map(([key, label]) => (
        <button key={key} onClick={() => onChange(key)} style={{
          flex: 1, padding: "8px 0", borderRadius: 6, border: "none",
          cursor: "pointer", fontFamily: LF, fontWeight: 600, fontSize: 13,
          background: active === key ? "white" : "transparent",
          color: active === key ? WARM : SAGE,
          boxShadow: active === key ? "0 2px 6px rgba(0,0,0,.1)" : "none",
        }}>{label}</button>
      ))}
    </div>
  );
}

// ─── SetupScreen ──────────────────────────────────────────────────────────────
function SetupScreen({ onSetup }) {
  const [step, setStep]     = useState("house"); // "house" | "profile"
  const [house, setHouse]   = useState(null);
  const [name, setName]     = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0].key);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  async function handleSubmit() {
    if (!name.trim() || !house) return;
    setLoading(true);
    setError("");
    try {
      await onSetup(name.trim(), house, avatar);
    } catch (e) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: LF,
      background: `linear-gradient(rgba(0,0,0,.32),rgba(0,0,0,.32)), url(${IMG_EXT}) center/cover`,
    }}>
      <div style={{ ...card, textAlign: "center", maxWidth: 420 }}>
        <div style={{ fontSize: 52, marginBottom: 8 }}>🏡</div>
        <h1 style={{ fontFamily: FF, color: WARM, margin: "0 0 4px", fontSize: "1.8rem" }}>
          Our Little Cottage
        </h1>
        <p style={{ color: SAGE, fontStyle: "italic", margin: "0 0 28px" }}>
          Welcome home. Let's get you set up.
        </p>

        {step === "house" && (
          <>
            <p style={{ color: WARM, fontWeight: 600, marginBottom: 16 }}>Which house is yours?</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 24 }}>
              {[
                { key: "left",  label: "Left Cottage",  emoji: "🏡", desc: "The cozy yellow cottage" },
                { key: "right", label: "Right Condo",   emoji: "🏢", desc: "The brownstone apartment" },
              ].map(h => (
                <div key={h.key} onClick={() => setHouse(h.key)} style={{
                  flex: 1, cursor: "pointer", borderRadius: 12,
                  border: house === h.key ? `2px solid ${TERRA}` : "2px solid #E8E0D0",
                  background: house === h.key ? "#FFF0E8" : "white",
                  padding: "20px 12px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                }}>
                  <span style={{ fontSize: 36 }}>{h.emoji}</span>
                  <span style={{ color: WARM, fontWeight: 700, fontSize: 13 }}>{h.label}</span>
                  <span style={{ color: SAGE, fontSize: 11 }}>{h.desc}</span>
                </div>
              ))}
            </div>
            <button
              style={{ ...btn(), width: "100%" }}
              disabled={!house}
              onClick={() => setStep("profile")}
            >
              This is my home →
            </button>
          </>
        )}

        {step === "profile" && (
          <>
            <p style={{ color: WARM, fontWeight: 600, marginBottom: 16 }}>
              {house === "left" ? "🏡 Left Cottage" : "🏢 Right Condo"} — Who are you?
            </p>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: SAGE, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                Choose your avatar
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                {AVATARS.map(a => (
                  <div key={a.key} onClick={() => setAvatar(a.key)} style={{
                    cursor: "pointer", borderRadius: 12,
                    border: avatar === a.key ? `2px solid ${TERRA}` : "2px solid #E8E0D0",
                    background: avatar === a.key ? "#FFF0E8" : "white",
                    padding: "10px 16px",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    minWidth: 80,
                  }}>
                    <img src={a.src} alt={a.label} style={{ width: 56, height: 56, objectFit: "contain" }} />
                    <span style={{ fontSize: 12, color: WARM, fontWeight: 600 }}>{a.label}</span>
                  </div>
                ))}
                <div style={{
                  borderRadius: 12, border: "2px dashed #D0C8BC",
                  padding: "10px 16px", minWidth: 80,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  opacity: 0.45,
                }}>
                  <div style={{ width: 56, height: 56, background: "#EEE8DF", borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>?</div>
                  <span style={{ fontSize: 12, color: SAGE }}>Soon</span>
                </div>
              </div>
            </div>

            <input
              style={{ ...inp, width: "100%", boxSizing: "border-box", marginBottom: 14 }}
              placeholder="Type your name…"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              autoFocus
            />
            {error && <p style={{ color: TERRA, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ ...btn("muted"), flex: "0 0 auto" }} onClick={() => setStep("house")}>← Back</button>
              <button
                style={{ ...btn(), flex: 1 }}
                disabled={!name.trim() || loading}
                onClick={handleSubmit}
              >
                {loading ? "Setting up…" : "Come inside ✨"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── ExteriorScreen ───────────────────────────────────────────────────────────
function ExteriorScreen({ myHouse, global, onDoor, onMailbox, onShowModal, onShop, onWildReign, debug }) {
  const me = global[myHouse];
  const partner = global[other(myHouse)];
  const hasmail = me?.mailbox?.length > 0;
  const partnerOutside = isOnline(partner) && partner?.currentView === "exterior";

  // Which mailbox opens collect vs compose
  function handleLeftMailbox()  { onMailbox(myHouse === "left"  ? "collect" : "compose"); }
  function handleRightMailbox() { onMailbox(myHouse === "right" ? "collect" : "compose"); }

  return (
    <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", fontFamily: LF }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: FF, color: WARM, fontSize: "1.1rem" }}>
          Our Little Cottage
        </div>
        <div style={{ color: WARM, fontWeight: 700 }}>🪙 {me?.coins ?? 0}</div>
      </div>

      <div style={{ position: "relative", width: "100%", borderRadius: 12, overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,.18)" }}>
        <img src={IMG_EXT} alt="exterior" style={{ width: "100%", height: "auto", display: "block" }} />

        {/* Left (cottage) mailbox */}
        <div onClick={handleLeftMailbox} style={{
          position: "absolute", bottom: "18%", left: "12%",
          width: "7%", paddingBottom: "9%",
          cursor: "pointer", borderRadius: 4,
          outline: debug ? "2px dashed red" : "none",
        }} />

        {/* Mail badge — shown if YOU have mail and YOUR mailbox is the left one */}
        {hasmail && myHouse === "left" && (
          <div style={{
            position: "absolute", bottom: "34%", left: "11%",
            background: TERRA, color: "white", borderRadius: "50%",
            width: 22, height: 22, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 13, fontWeight: 700,
            pointerEvents: "none", zIndex: 5, boxShadow: "0 2px 6px rgba(0,0,0,.3)",
          }}>!</div>
        )}

        {/* Cottage door */}
        <div onClick={() => onDoor("left")} style={{
          position: "absolute", bottom: "30%", left: "34%",
          width: "5%", paddingBottom: "12%",
          cursor: "pointer", borderRadius: 4,
          outline: debug ? "2px dashed blue" : "none",
        }} />

        {/* Condo building */}
        <div onClick={() => onDoor("right")} style={{
          position: "absolute", bottom: "38%", left: "89%",
          width: "6%", height: "20%",
          cursor: "pointer", borderRadius: 4,
          outline: debug ? "2px dashed orange" : "none",
        }} />

        {/* Right (condo) mailbox */}
        <div onClick={handleRightMailbox} style={{
          position: "absolute", bottom: "18%", left: "88%",
          width: "5%", paddingBottom: "8%",
          cursor: "pointer", borderRadius: 4,
          outline: debug ? "2px dashed orange" : "none",
        }} />

        {/* Mail badge for right-side player */}
        {hasmail && myHouse === "right" && (
          <div style={{
            position: "absolute", bottom: "34%", left: "87%",
            background: TERRA, color: "white", borderRadius: "50%",
            width: 22, height: 22, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 13, fontWeight: 700,
            pointerEvents: "none", zIndex: 5, boxShadow: "0 2px 6px rgba(0,0,0,.3)",
          }}>!</div>
        )}

        {/* My character sprite */}
        <img src={me?.avatar === "guy" ? IMG_GUY : IMG_GIRL} alt="character" style={{
          position: "absolute", bottom: "12%", left: myHouse === "left" ? "42%" : "52%",
          height: "28%", width: "auto", pointerEvents: "none",
          transform: myHouse === "right" ? "scaleX(-1)" : "none",
        }} />

        {/* Partner sprite — visible when they're also on the exterior */}
        {partnerOutside && (
          <img src={partner?.avatar === "guy" ? IMG_GUY : IMG_GIRL} alt="partner" style={{
            position: "absolute", bottom: "12%", left: other(myHouse) === "left" ? "42%" : "52%",
            height: "28%", width: "auto", pointerEvents: "none",
            transform: other(myHouse) === "right" ? "scaleX(-1)" : "none",
          }} />
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <button style={btn("primary")} onClick={onShop}>
          🌺 Flower Shop
        </button>
        <button style={btn("primary")} onClick={onWildReign}>
          🃏 Wild Reign
        </button>
      </div>
    </div>
  );
}

// ─── InteriorScreen ───────────────────────────────────────────────────────────
const ROOM_CONFIG = {
  left: {
    img:         IMG_COTTAGE_ROOM,
    occupiedImg: IMG_COTTAGE_ROOM_OCCUPIED,
    alt:         "cottage interior",
    bookshelf: { top: "5%",  left: "0%",  width: "12%", height: "90%" },
    vase:      { top: "43%", left: "14%", width: "5%",  height: "14%" },
    // anchor = vase opening center; flower bottom lands here. Calibrate with configure_flower_pos.py
    flowerAnchorX: "17.89%",
    flowerAnchorY: "45.91%",
    flowerWidth:   "3.5%",
  },
  right: {
    img:         IMG_BROWNSTONE_ROOM,
    occupiedImg: IMG_BROWNSTONE_ROOM_OCCUPIED,
    alt:         "brownstone interior",
    bookshelf: { top: "37%", left: "28%", width: "12%", height: "35%" },
    vase:      { top: "62%", left: "41%", width: "6%",  height: "14%" },
    // anchor = vase opening center; flower bottom lands here. Calibrate with configure_flower_pos.py
    flowerAnchorX: "49.89%",
    flowerAnchorY: "67.33%",
    flowerWidth:   "3.5%",
  },


};

function InteriorScreen({ myHouse, visitingHouse, global, onBack, onShowModal, debug }) {
  const me = global[visitingHouse];
  const partner = global[other(myHouse)];
  const vase = me?.vase;
  const flower = vase?.flower ?? null;
  const dead = flower?.phase === "withered";
  const cfg = ROOM_CONFIG[visitingHouse] ?? ROOM_CONFIG.left;

  // Show occupied image when partner is also currently in this room
  const partnerHere = isOnline(partner) && partner?.currentView === `interior-${visitingHouse}`;
  const roomImg = partnerHere ? cfg.occupiedImg : cfg.img;

  return (
    <div style={{ width: "100%", maxWidth: 900, margin: "0 auto" }}>
      <button onClick={onBack} style={{ ...btn("ghost"), marginBottom: 12 }}>← Outside</button>

      <div style={{ position: "relative", width: "100%", borderRadius: 12, overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,.18)" }}>
        <img src={roomImg} alt={cfg.alt} style={{ width: "100%", height: "auto", display: "block" }} />

        {/* Bookshelf */}
        <div onClick={() => onShowModal("scrapbook")} style={{
          position: "absolute", ...cfg.bookshelf,
          cursor: "pointer", borderRadius: 4,
          outline: debug ? "2px dashed purple" : "none",
        }} />

        {/* Vase hotspot */}
        <div onClick={() => onShowModal("vase")} style={{
          position: "absolute", ...cfg.vase,
          cursor: "pointer",
          outline: debug ? "2px dashed green" : "none",
        }} />

        {/* Flower image: anchor point = vase opening; bottom of PNG lands at anchor */}
        {flower && (() => {
          const key = FLOWERS.find(f => f.name === flower.name)?.key;
          if (!key) return null;
          return (
            <img
              src={flowerPhaseImg(key, flower.phase)}
              alt={flower.name}
              style={{
                position: "absolute",
                left: cfg.flowerAnchorX,
                top: cfg.flowerAnchorY,
                transform: "translate(-50%, -100%)",
                width: cfg.flowerWidth,
                zIndex: 2,
                pointerEvents: "none",
                filter: dead
                  ? "grayscale(1) opacity(0.55)"
                  : flower.phase === "bloomed"
                  ? "drop-shadow(0 2px 8px rgba(255,180,0,.55))"
                  : "drop-shadow(0 1px 3px rgba(0,0,0,.3))",
                transition: "filter .4s",
              }}
            />
          );
        })()}
      </div>
    </div>
  );
}

// ─── MailboxModal ─────────────────────────────────────────────────────────────
function MailboxModal({ mode, myHouse, global, api, refresh, onClose }) {
  const [text, setText]         = useState("");
  const [selectedFlower, setSF] = useState(null);
  const [sent, setSent]         = useState(false);
  const [loading, setLoading]   = useState(false);

  const me = global[myHouse];
  const cooldownMs = me?.lastLetterSent
    ? Math.max(0, WEEK_MS - (Date.now() - me.lastLetterSent))
    : 0;
  const canLetter = cooldownMs === 0;
  const MAX = 500;
  const otherName = global[other(myHouse)]?.name ?? "them";

  async function collectAll() {
    setLoading(true);
    try { await api("collect-mail", {}); await refresh(); onClose(); }
    finally { setLoading(false); }
  }

  async function sendLetter() {
    if (!text.trim() || !canLetter) return;
    setLoading(true);
    try {
      await api("send-letter", { text: text.trim(), inventoryItemId: selectedFlower?.id ?? null });
      setSent(true);
      await refresh();
    } finally { setLoading(false); }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <ModalHeader
          title={mode === "collect" ? "📬 Your Mailbox" : `✉️ Write to ${otherName}`}
          onClose={onClose}
        />

        {/* ── Collect mode ── */}
        {mode === "collect" && (
          me?.mailbox?.length === 0 ? (
            <p style={{ color: SAGE, textAlign: "center", padding: "24px 0" }}>No new mail today. 💌</p>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                {me.mailbox.map(item => (
                  <div key={item.id} style={{ background: "white", borderRadius: 10, padding: "12px 16px", border: "1px solid #E8E0D0" }}>
                    {item.flowerEmoji && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 24 }}>{item.flowerEmoji}</span>
                        <span style={{ color: WARM, fontWeight: 600, fontSize: 13 }}>{item.flowerName}</span>
                      </div>
                    )}
                    <p style={{ margin: 0, color: "#555", fontSize: 13, lineHeight: 1.5 }}>
                      {item.letterText.slice(0, 120)}{item.letterText.length > 120 ? "…" : ""}
                    </p>
                    <div style={{ color: SAGE, fontSize: 11, marginTop: 6 }}>
                      from {global[item.fromHouse]?.name ?? item.fromHouse}
                    </div>
                  </div>
                ))}
              </div>
              <button style={{ ...btn(), width: "100%" }} disabled={loading} onClick={collectAll}>
                {loading ? "Collecting…" : "Collect everything ✨"}
              </button>
            </>
          )
        )}

        {/* ── Compose mode ── */}
        {mode === "compose" && (
          sent ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✉️</div>
              <h3 style={{ fontFamily: FF, color: WARM, margin: "0 0 8px" }}>Letter sent! 💌</h3>
              <p style={{ color: SAGE, margin: "0 0 20px" }}>Your words are on their way to {otherName}.</p>
              <button style={{ ...btn("muted"), width: "100%" }} onClick={onClose}>Close</button>
            </div>
          ) : !canLetter ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
              <h3 style={{ fontFamily: FF, color: WARM, margin: "0 0 8px" }}>Next letter in</h3>
              <p style={{ fontSize: 28, fontWeight: 700, color: TERRA, margin: "0 0 8px" }}>
                {formatCountdown(cooldownMs)}
              </p>
              <p style={{ color: SAGE, fontSize: 13, margin: 0 }}>One letter a week keeps it special.</p>
            </div>
          ) : (
            <>
              {me?.inventory?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: SAGE, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                    Attach a flower — optional
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {me.inventory.map(item => {
                      const f = FLOWERS.find(f => f.name === item.flowerName);
                      const selected = selectedFlower?.id === item.id;
                      return (
                        <button key={item.id} onClick={() => setSF(selected ? null : item)} style={{
                          width: 52, height: 52, padding: 4, borderRadius: 10,
                          border: selected ? `2px solid ${TERRA}` : "2px solid #E8E0D0",
                          background: selected ? "#FFF0E8" : "white",
                          cursor: "pointer", overflow: "hidden",
                        }}>
                          {f
                            ? <img src={flowerImg(f.key, "singular_unbloomed")} alt={f.name}
                                style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                            : <span style={{ fontSize: 22 }}>{item.flowerEmoji}</span>
                          }
                        </button>
                      );
                    })}
                  </div>
                  {selectedFlower && (
                    <p style={{ color: SAGE, fontSize: 12, margin: "8px 0 0" }}>
                      {selectedFlower.flowerName} will be included 🌱
                    </p>
                  )}
                </div>
              )}
              <textarea
                style={{ ...inp, width: "100%", boxSizing: "border-box", height: 180, resize: "vertical", lineHeight: 1.6 }}
                placeholder={`Write something to ${otherName}…`}
                value={text}
                onChange={e => setText(e.target.value.slice(0, MAX))}
                autoFocus
              />
              <div style={{ fontSize: 11, color: SAGE, textAlign: "right", margin: "4px 0 14px" }}>
                {text.length}/{MAX}
              </div>
              <button
                style={{ ...btn(), width: "100%" }}
                disabled={!text.trim() || loading}
                onClick={sendLetter}
              >
                {loading ? "Sending…" : `Send letter${selectedFlower ? ` + ${selectedFlower.flowerEmoji}` : ""} ✨`}
              </button>
            </>
          )
        )}
      </div>
    </div>
  );
}

// ─── FlowerDetailModal ────────────────────────────────────────────────────────
function FlowerDetailModal({ flower, me, api, refresh, onClose }) {
  const [buying, setBuying] = useState(false);
  const [bought, setBought] = useState(false);

  const inventoryFull = (me?.inventory?.length ?? 0) >= MAX_INVENTORY;
  const cantAfford    = (me?.coins ?? 0) < flower.price;
  const blocked       = inventoryFull || cantAfford;

  async function buy() {
    setBuying(true);
    try {
      await api("buy-flower", { flowerName: flower.name, flowerEmoji: flower.emoji, price: flower.price });
      await refresh();
      setBought(true);
    } finally { setBuying(false); }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...card, maxWidth: 360, textAlign: "center" }} onClick={e => e.stopPropagation()}>
        <ModalHeader title={flower.name} onClose={onClose} />

        {bought ? (
          <>
            <div style={{ fontSize: 48, margin: "16px 0 8px" }}>🎉</div>
            <p style={{ color: WARM, fontWeight: 600, marginBottom: 20 }}>
              Added to your bag!
            </p>
            <button style={{ ...btn("muted"), width: "100%" }} onClick={onClose}>Done</button>
          </>
        ) : (
          <>
            {/* Single flower — for sale */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: SAGE, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                Single Flower
              </div>
              <img
                src={flowerImg(flower.key, "singular_unbloomed")}
                alt={flower.name}
                style={{ height: 160, width: "auto", objectFit: "contain" }}
              />
              <div style={{ color: WARM, fontWeight: 700, fontSize: 18, margin: "8px 0 4px" }}>
                🪙 {flower.price}
              </div>
              <div style={{ color: SAGE, fontSize: 12 }}>
                {inventoryFull ? "Bag is full (6/6)" : `Bag: ${me?.inventory?.length ?? 0} / ${MAX_INVENTORY}`}
              </div>
            </div>

            {/* Bouquet — coming soon */}
            <div style={{
              background: "#F5F0E8", borderRadius: 12, padding: "14px 16px",
              marginBottom: 20, opacity: 0.55,
            }}>
              <div style={{ fontSize: 11, color: SAGE, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                Bouquet — Coming Soon
              </div>
              <img
                src={flowerImg(flower.key, "bouquet_unbloomed")}
                alt={`${flower.name} bouquet`}
                style={{ height: 100, width: "auto", objectFit: "contain" }}
              />
              <div style={{ color: SAGE, fontWeight: 600, fontSize: 14, marginTop: 6 }}>
                🪙 {flower.price * 5}
              </div>
            </div>

            <button
              style={{ ...btn(blocked ? "muted" : "primary"), width: "100%" }}
              disabled={blocked || buying}
              onClick={buy}
            >
              {buying ? "Buying…" : cantAfford ? "Not enough coins" : inventoryFull ? "Bag is full" : `Buy for 🪙 ${flower.price}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── FlowerShopScreen ─────────────────────────────────────────────────────────
// Hotspot (x,y) = bottom-center of each pre-drawn pot in flower_shop.jpeg (1380×752).
// Row 3 image order: GerberaDaisy, Lavender, Daffodil, Gladiolus, Marigold
// so Daffodil/Lavender and Gladiolus/Marigold are non-sequential vs FLOWERS array.
const SHELF_POSITIONS = [
  { x: "5.2%", y: "35.1%" },  // 0  Rose
  { x: "12.6%", y: "35.1%" },  // 1  Tulip
  { x: "19.3%", y: "34.6%" },  // 2  Sunflower
  { x: "25.4%", y: "34.6%" },  // 3  Lily
  { x: "30.8%", y: "34.3%" },  // 4  Orchid
  { x: "5.8%", y: "59.3%" },  // 5  Hydrangea
  { x: "12.9%", y: "55.3%" },  // 6  Daisy
  { x: "20.0%", y: "56.0%" },  // 7  Carnation
  { x: "25.9%", y: "55.3%" },  // 8  Peony
  { x: "31.2%", y: "52.5%" },  // 9  Chrysanthemum
  { x: "14.3%", y: "76.0%" },  // 10  Gerbera Daisy
  { x: "25.8%", y: "71.8%" },  // 11  Daffodil
  { x: "20.3%", y: "74.0%" },  // 12  Lavender
  { x: "96.5%", y: "80.2%" },  // 13  Marigold
  { x: "32.2%", y: "69.7%" },  // 14  Gladiolus
];

function FlowerShopScreen({ myHouse, global, api, refresh, onBack, debug }) {
  const me = global[myHouse];
  const partner = global[other(myHouse)];
  const [selected, setSelected] = useState(null);

  const partnerInShop = isOnline(partner) && partner?.currentView === "shop";
  const shopImg = partnerInShop ? IMG_SHOP_OCCUPIED : IMG_SHOP;

  return (
    <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", fontFamily: LF }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <button style={btn("ghost")} onClick={onBack}>← Back</button>
        <div style={{ color: WARM, fontWeight: 700 }}>🪙 {me?.coins ?? 0}</div>
      </div>

      <div style={{ position: "relative", width: "100%", borderRadius: 12, overflow: "hidden",
        boxShadow: "0 8px 32px rgba(0,0,0,.18)" }}>
        <img src={shopImg} alt="flower shop" style={{ width: "100%", height: "auto", display: "block" }} />

        {/* Invisible clickable hotspots over pre-drawn pots */}
        {FLOWERS.map((flower, i) => {
          const pos = SHELF_POSITIONS[i];
          return (
            <div
              key={flower.key}
              onClick={() => setSelected(flower)}
              title={flower.name}
              style={{
                position: "absolute",
                left: pos.x, top: pos.y,
                transform: "translate(-50%, -100%)",
                width: "5%", height: "20%",
                cursor: "pointer",
                background: debug ? "rgba(0,200,0,.2)" : "transparent",
                outline: debug ? "2px dashed lime" : "none",
              }}
            />
          );
        })}
      </div>

      {/* Inventory bag */}
      <div style={{ marginTop: 14, background: "white", borderRadius: 12, padding: "12px 16px",
        border: "1px solid #E8E0D0", display: "flex", alignItems: "center", gap: 12,
        flexWrap: "wrap" }}>
        <span style={{ color: WARM, fontWeight: 700, fontSize: 13 }}>
          🎒 Bag ({me?.inventory?.length ?? 0}/{MAX_INVENTORY})
        </span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Array.from({ length: MAX_INVENTORY }, (_, i) => {
            const item = me?.inventory?.[i];
            const f = item ? FLOWERS.find(f => f.name === item.flowerName) : null;
            return (
              <div key={i} style={{
                width: 40, height: 40, borderRadius: 8,
                border: "1.5px solid #E8E0D0",
                background: item ? "white" : "#F8F4EE",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
              }}>
                {f && <img src={flowerImg(f.key, "singular_unbloomed")} alt={f.name}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <FlowerDetailModal
          flower={selected}
          me={me}
          api={api}
          refresh={refresh}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// ─── VaseModal ────────────────────────────────────────────────────────────────
function VaseModal({ myHouse, visitingHouse, global, api, refresh, onClose }) {
  const me     = global[visitingHouse];
  const isOwner = visitingHouse === myHouse;
  const vase   = me?.vase ?? null;
  const flower = vase?.flower ?? null;
  const letter = vase?.letter ?? null;

  const phase    = flower?.phase ?? null;
  const dead     = phase === "withered";
  const bloomed  = phase === "bloomed";
  const streak   = flower?.streak ?? 0;

  // Cooldown only applies after the first watering; sentAt alone never blocks watering
  const canWater = flower && !dead && (
    !flower.lastWatered || Date.now() - flower.lastWatered > 20 * 3_600_000
  );

  const [watering,  setWatering]  = useState(false);
  const [trashing,  setTrashing]  = useState(false);
  const [justBloomed, setJustBloomed] = useState(false);

  async function water() {
    setWatering(true);
    try {
      const result = await api("water", {});
      if (result.justBloomed) setJustBloomed(true);
      await refresh();
    } finally { setWatering(false); }
  }

  async function trash() {
    setTrashing(true);
    try { await api("trash-flower", {}); await refresh(); onClose(); }
    finally { setTrashing(false); }
  }

  const fromName = (house) => house ? (global[house]?.name ?? house) : "?";

  const flowerKey = flower ? FLOWERS.find(f => f.name === flower.name)?.key : null;

  return (
    <div style={overlay} onClick={onClose}>
      <div
        style={{ ...card, maxWidth: 560, padding: "16px 20px" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: SAGE, lineHeight: 1 }}>✕</button>
        </div>

        {/* Bloom toast — full width above the columns */}
        {justBloomed && (
          <div style={{
            background: "#FFF8E1", border: "1px solid #F5C842", borderRadius: 10,
            padding: "10px 14px", marginBottom: 12, textAlign: "center",
          }}>
            <span style={{ fontSize: 18 }}>🌸</span>
            <span style={{ color: WARM, fontWeight: 700, fontSize: 13, marginLeft: 6 }}>
              It bloomed! {fromName(flower?.from)} earned +3 🪙
            </span>
          </div>
        )}

        {/* Side-by-side: pot+flower LEFT, info+letter RIGHT */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

          {/* LEFT — pot with flower growing above */}
          <div style={{ position: "relative", width: 180, flexShrink: 0, paddingTop: 150 }}>
            {flower && flowerKey && (
              <img
                src={flowerPhaseImg(flowerKey, phase)}
                alt={flower.name}
                style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "60%",
                  zIndex: 2,
                  pointerEvents: "none",
                  filter: dead
                    ? "grayscale(1) opacity(0.5)"
                    : bloomed
                    ? "drop-shadow(0 0 10px rgba(255,180,0,.8))"
                    : "none",
                  transition: "filter .4s",
                }}
              />
            )}
            <img
              src={IMG_POT_IN_HAND}
              alt="jar"
              style={{ width: "100%", display: "block" }}
            />
          </div>

          {/* RIGHT — info + letter + actions */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Flower name + meta */}
            {flower ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: FF, color: WARM, fontSize: "1.15rem", marginBottom: 3 }}>
                  {flower.name}{dead ? " 🥀" : bloomed ? " 🌸" : " 🌱"}
                </div>
                <div style={{ color: SAGE, fontSize: 12 }}>
                  from {fromName(flower.from)}
                  {dead && <span style={{ color: TERRA }}> · withered</span>}
                </div>
              </div>
            ) : !letter ? (
              <p style={{ color: SAGE, fontStyle: "italic", marginBottom: 14 }}>The jar is empty.</p>
            ) : null}

            {/* Streak progress (unbloomed only) */}
            {flower && !dead && !bloomed && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: SAGE, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Day {Math.min(streak, 3)} of 3 to bloom
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} style={{
                      width: 13, height: 13, borderRadius: "50%",
                      background: i < streak ? SAGE : "#E0D8CC",
                      transition: "background .3s",
                    }} />
                  ))}
                </div>
              </div>
            )}

            {/* Bloomed hint */}
            {flower && bloomed && !dead && (
              <p style={{ color: SAGE, fontSize: 12, fontStyle: "italic", marginBottom: 14 }}>
                Water daily to keep it bloomed 💧
              </p>
            )}

            {/* Letter */}
            {letter && (
              <div style={{
                background: "#FFFDF7", borderRadius: 12, padding: "14px 16px", marginBottom: 14,
                border: "1px solid #E8D8B0", boxShadow: "0 2px 8px rgba(0,0,0,.06)",
              }}>
                <div style={{ color: SAGE, fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  ✉️ from {fromName(letter.from)}
                </div>
                <p style={{
                  margin: 0, color: "#4A3B2A", lineHeight: 1.75, fontSize: 13,
                  whiteSpace: "pre-wrap", fontFamily: FF, fontStyle: "italic",
                }}>
                  {letter.text}
                </p>
              </div>
            )}

            {/* Water button — owner only */}
            {isOwner && canWater && (
              <button style={{ ...btn(), width: "100%", marginBottom: 8 }} disabled={watering} onClick={water}>
                {watering ? "Watering…" : "Water 💧 +1 🪙"}
              </button>
            )}
            {isOwner && flower && !dead && !canWater && (
              <p style={{ color: SAGE, fontSize: 12, marginBottom: 8 }}>
                Watered today — check back tomorrow 💧
              </p>
            )}

            {/* Trash button — owner only */}
            {isOwner && dead && (
              <button
                style={{ ...btn("ghost"), width: "100%", marginBottom: 8, borderColor: "#C44", color: "#C44" }}
                disabled={trashing}
                onClick={trash}
              >
                {trashing ? "Removing…" : "Throw away 🗑️"}
              </button>
            )}

            <button style={{ ...btn("muted"), width: "100%" }} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BookshelfModal (Scrapbook) ───────────────────────────────────────────────
function BookshelfModal({ myHouse, visitingHouse, global, onClose }) {
  const me       = global[visitingHouse];
  const entries  = me?.scrapbook ?? [];

  const fromName = (house) => house ? (global[house]?.name ?? house) : "?";

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <ModalHeader title="📖 Scrapbook" onClose={onClose} />
        {entries.length === 0 ? (
          <p style={{ color: SAGE, textAlign: "center", padding: "24px 0" }}>
            Your memories will appear here. 🌸
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {entries.map(entry => {
              const f = entry.flowerName ? FLOWERS.find(f => f.name === entry.flowerName) : null;
              return (
              <div key={entry.id} style={{ background: "white", borderRadius: 12, padding: "16px 18px", border: "1px solid #E8E0D0" }}>
                {entry.flowerName && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    {f
                      ? <img src={flowerPhaseImg(f.key, entry.flowerPhase ?? "unbloomed")} alt={f.name}
                          style={{ width: 36, height: 36, objectFit: "contain" }} />
                      : <span style={{ fontSize: 24 }}>{entry.flowerEmoji}</span>
                    }
                    <span style={{ color: WARM, fontWeight: 600, fontSize: 13 }}>{entry.flowerName}</span>
                  </div>
                )}
                {entry.letterText && (
                  <p style={{ margin: 0, color: "#333", lineHeight: 1.7, fontSize: 14, whiteSpace: "pre-wrap" }}>
                    {entry.letterText}
                  </p>
                )}
                <div style={{ color: SAGE, fontSize: 11, marginTop: 8 }}>
                  from {fromName(entry.letterFrom)} · {entry.archivedAt ? new Date(entry.archivedAt).toLocaleDateString() : ""}
                </div>
              </div>
            );})}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LoadingScreen ────────────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: LF, background: CREAM,
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏡</div>
        <p style={{ color: SAGE, fontStyle: "italic" }}>Coming home…</p>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [token,         setToken]        = useState(() => localStorage.getItem("cottage-token"));
  const [myHouse,       setMyHouse]      = useState(null);
  const [visitingHouse, setVisitingHouse] = useState(null);
  const [global,        setGlobal]       = useState(null);
  const [screen,        setScreen]       = useState("loading");
  const [modal,         setModal]        = useState(null);
  const [mailMode,      setMailMode]     = useState("collect"); // "collect" | "compose"
  const [debug,         setDebug]        = useState(false);

  // Tracks current view for presence — updated immediately on navigation without causing re-renders
  const viewRef = useRef("exterior");

  const api = useCallback(makeApi(token), [token]);

  // Keep stable refs so interval callbacks never go stale
  const refreshRef = useRef(null);
  const pingRef    = useRef(null);

  async function refresh() {
    const { myHouse: h, global: g } = await api(`state?view=${viewRef.current}`);
    setMyHouse(h);
    setGlobal(g);
  }

  // Lightweight presence-only poll — 3 DB ops vs ~6 for a full state fetch
  async function ping() {
    try {
      const presence = await api("ping", { view: viewRef.current });
      setGlobal(g => g ? {
        ...g,
        left:  g.left  ? { ...g.left,  ...presence.left  } : g.left,
        right: g.right ? { ...g.right, ...presence.right } : g.right,
      } : g);
    } catch {} // presence is best-effort; silent on network error
  }

  useEffect(() => { refreshRef.current = refresh; pingRef.current = ping; });

  // Poll presence every 15s using the lightweight /ping endpoint
  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => pingRef.current?.(), 15_000);
    return () => clearInterval(id);
  }, [token]);

  useEffect(() => {
    if (!token) { setScreen("setup"); return; }
    api("state?view=exterior")
      .then(({ myHouse: h, global: g }) => {
        setMyHouse(h);
        setGlobal(g);
        setScreen("exterior");
      })
      .catch(() => {
        localStorage.removeItem("cottage-token");
        setToken(null);
        setScreen("setup");
      });
  }, []);

  async function handleSetup(name, house, avatar) {
    const freshApi = makeApi(null);
    const { token: t, myHouse: h, global: g } = await freshApi("setup", { name, house, avatar });
    localStorage.setItem("cottage-token", t);
    setToken(t);
    setMyHouse(h);
    setGlobal(g);
    setScreen("exterior");
  }

  function openMailbox(mode) {
    setMailMode(mode);
    setModal("mailbox");
  }

  if (screen === "loading") return <LoadingScreen />;
  if (screen === "setup")   return <SetupScreen onSetup={handleSetup} />;

  const me = global?.[myHouse];

  return (
    <div style={{
      minHeight: "100vh", background: CREAM, fontFamily: LF,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "20px 16px",
    }}>
      <button onClick={() => setDebug(d => !d)} style={{
        position: "fixed", top: 8, left: 8, zIndex: 200,
        fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "none",
        cursor: "pointer", opacity: 0.4,
        background: debug ? "#FFD93D" : "#CCC", color: "#333",
      }}>
        {debug ? "debug ON" : "debug"}
      </button>

      <button onClick={() => {
        localStorage.removeItem("cottage-token");
        setToken(null);
        setMyHouse(null);
        setGlobal(null);
        setScreen("setup");
      }} style={{
        position: "fixed", top: 8, right: 8, zIndex: 200,
        fontSize: 10, padding: "3px 8px", borderRadius: 4, border: "none",
        cursor: "pointer", opacity: 0.4, background: "#CCC", color: "#333",
      }}>
        switch player
      </button>

      {screen === "exterior" && (
        <ExteriorScreen
          myHouse={myHouse} global={global}
          onDoor={(house) => {
            viewRef.current = `interior-${house}`;
            setVisitingHouse(house);
            setScreen("interior");
            refresh();
          }}
          onMailbox={openMailbox}
          onShowModal={setModal}
          onShop={() => { viewRef.current = "shop"; setScreen("shop"); refresh(); }}
          onWildReign={() => { viewRef.current = "wildreign"; setScreen("wildreign"); refresh(); }}
          debug={debug}
        />
      )}
      {screen === "interior" && (
        <InteriorScreen
          myHouse={myHouse} visitingHouse={visitingHouse} global={global}
          onBack={() => { viewRef.current = "exterior"; setScreen("exterior"); refresh(); }}
          onShowModal={setModal}
          debug={debug}
        />
      )}
      {screen === "shop" && (
        <FlowerShopScreen
          myHouse={myHouse} global={global}
          api={api} refresh={refresh}
          onBack={() => { viewRef.current = "exterior"; setScreen("exterior"); refresh(); }}
          debug={debug}
        />
      )}
      {screen === "wildreign" && (
        <WildReignScreen
          myHouse={myHouse} global={global}
          api={api}
          onBack={() => { viewRef.current = "exterior"; setScreen("exterior"); refresh(); }}
        />
      )}

      {modal === "mailbox" && (
        <MailboxModal mode={mailMode} myHouse={myHouse} global={global} api={api} refresh={refresh} onClose={() => setModal(null)} />
      )}
      {modal === "vase" && (
        <VaseModal myHouse={myHouse} visitingHouse={visitingHouse} global={global} api={api} refresh={refresh} onClose={() => setModal(null)} />
      )}
      {modal === "scrapbook" && (
        <BookshelfModal myHouse={myHouse} visitingHouse={visitingHouse} global={global} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
