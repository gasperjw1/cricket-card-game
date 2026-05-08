import { Fragment, type ReactNode } from "react";

/**
 * Tiny markdown renderer for situation card descriptions. Supports the
 * subset that actually appears in `docs/situation-cards.md`:
 *   - Paragraphs (separated by blank lines)
 *   - Bullet lists (lines starting with `- `)
 *   - **bold** spans inside paragraphs and list items
 *
 * Everything else is rendered as plain text. This avoids pulling in a full
 * markdown library for ~6KB of card copy.
 */
export function CardEffectText({ text }: { text: string }) {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        const isList = lines.length > 0 && lines.every((l) => l.startsWith("- "));
        if (isList) {
          return (
            <ul key={i} className="card-effect-list">
              {lines.map((line, j) => (
                <li key={j}>{renderInline(line.replace(/^- /, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="card-effect-paragraph">
            {renderInline(block.replace(/\n/g, " "))}
          </p>
        );
      })}
    </>
  );
}

/** Renders **bold** spans as <strong>; everything else as plain text. */
function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}
