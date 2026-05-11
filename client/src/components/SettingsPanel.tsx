import { useEffect, useState } from "react";
import {
  getSettings,
  setSettings,
  subscribeSettings,
  type CommentaryStyle,
  type StorySpeed,
  type UserSettings,
} from "../lib/settings.ts";

interface Props {
  onClose: () => void;
}

/** Modal panel for user settings — persists to localStorage. Open via
 *  a cog button on the Home screen and during gameplay (top-right of
 *  the scorebug). */
export function SettingsPanel({ onClose }: Props) {
  const [s, setS] = useState<UserSettings>(getSettings);

  useEffect(() => subscribeSettings(setS), []);

  const update = <K extends keyof UserSettings>(key: K, value: UserSettings[K]): void => {
    setSettings({ [key]: value } as Partial<UserSettings>);
  };

  return (
    <div className="settings-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <header className="settings-header">
          <h2>Settings</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </header>

        <section className="settings-section">
          <h3>Sound effects</h3>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={s.sfxEnabled}
              onChange={(e) => update("sfxEnabled", e.target.checked)}
            />
            <span>{s.sfxEnabled ? "🔊 On" : "🔇 Off"}</span>
            <small className="dim-text">
              Bat-thwack, crowd reactions, umpire calls, and more.
            </small>
          </label>
        </section>

        <section className="settings-section">
          <h3>Commentary</h3>
          <RadioGroup<CommentaryStyle>
            name="commentary"
            value={s.commentaryStyle}
            options={[
              { value: "classic", label: "Classic", blurb: "Measured British broadcaster — \"Marvellous shot, that!\"" },
              { value: "modern", label: "Modern", blurb: "Punchy IPL energy — \"THAT IS HUGE!\"" },
              { value: "off", label: "Off", blurb: "No commentary text." },
            ]}
            onChange={(v) => update("commentaryStyle", v)}
          />
        </section>

        <section className="settings-section">
          <h3>Story sequence speed</h3>
          <RadioGroup<StorySpeed>
            name="story-speed"
            value={s.storySpeed}
            options={[
              { value: "fast", label: "Fast", blurb: "Snappy. Skip past the drama." },
              { value: "normal", label: "Normal", blurb: "Default — sound + visuals time to land." },
              { value: "slow", label: "Slow", blurb: "Savor each moment." },
            ]}
            onChange={(v) => update("storySpeed", v)}
          />
        </section>

        <footer className="settings-footer">
          <button className="btn primary" onClick={onClose}>Done</button>
        </footer>
      </div>
    </div>
  );
}

function RadioGroup<T extends string>(props: {
  name: string;
  value: T;
  options: { value: T; label: string; blurb: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="settings-radio-group">
      {props.options.map((opt) => (
        <label
          key={opt.value}
          className={`settings-radio ${props.value === opt.value ? "selected" : ""}`}
        >
          <input
            type="radio"
            name={props.name}
            value={opt.value}
            checked={props.value === opt.value}
            onChange={() => props.onChange(opt.value)}
          />
          <strong>{opt.label}</strong>
          <small className="dim-text">{opt.blurb}</small>
        </label>
      ))}
    </div>
  );
}
