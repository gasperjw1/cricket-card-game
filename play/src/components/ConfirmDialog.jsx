import { useEffect, useRef } from "react";
import GButton from "./GButton";
import { FELT_DARK, GOLD, FONT_BODY, FONT_DISPLAY, SP } from "../games/wildreign/theme";

// Reusable confirmation overlay. Renders absolutely over its nearest
// `position: relative` ancestor (the game shell), so it covers the table
// without needing a portal. Escape and a backdrop click both cancel.
export default function ConfirmDialog({
  title, body, confirmLabel = "Confirm", cancelLabel = "Cancel",
  onConfirm, onCancel, busy = false, destructive = true,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onCancel?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      onClick={onCancel}
      style={{
        position: "absolute", inset: 0, zIndex: 120, borderRadius: 16,
        background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wr-confirm-title"
        className="wr-pop-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "90%", maxWidth: 360, background: FELT_DARK, border: `1px solid ${GOLD}`,
          borderRadius: 12, padding: SP.xl, boxShadow: "0 16px 48px rgba(0,0,0,.6)",
        }}
      >
        <div id="wr-confirm-title" style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: GOLD, fontWeight: 700, marginBottom: SP.sm }}>
          {title}
        </div>
        {body && (
          <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: "rgba(248,243,232,0.75)", lineHeight: 1.5, marginBottom: SP.lg }}>
            {body}
          </div>
        )}
        <div style={{ display: "flex", gap: SP.sm, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            ref={cancelRef}
            onClick={onCancel}
            style={{
              padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer",
              fontFamily: FONT_BODY, fontWeight: 700, fontSize: 14, background: "rgba(255,255,255,0.08)", color: "#f8f3e8",
            }}
          >
            {cancelLabel}
          </button>
          <GButton variant={destructive ? "danger" : "gold"} disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </GButton>
        </div>
      </div>
    </div>
  );
}
