import { GOLD, IVORY, FONT_BODY } from "../games/wildreign/theme";

export default function GButton({ children, onClick, disabled, variant = "default", style }) {
  const base = {
    padding: "10px 20px", borderRadius: 8, border: "none", cursor: disabled ? "default" : "pointer",
    fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, letterSpacing: 0.3,
    opacity: disabled ? 0.4 : 1, transition: "opacity .15s",
  };
  const variants = {
    default: { background: "rgba(255,255,255,0.08)", color: IVORY },
    gold:    { background: `linear-gradient(180deg, ${GOLD}, #a07830)`, color: "#1a1207" },
    danger:  { background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.4)" },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}
