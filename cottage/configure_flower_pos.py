"""
Flower Position Configurator for Room Views
--------------------------------------------
Run:  python3 cottage/configure_flower_pos.py

For each room:
  • Click the EXACT CENTER of the vase opening (where the stem should emerge).
  • Scroll up/down (or +/- keys) to grow/shrink the flower overlay.
  • Press 'n' to move to the next room.
  • Press 'q' (or Escape) when done to print the final config.

The preview flower shown is a single_bloomed rose.
"""

import tkinter as tk
from PIL import Image, ImageTk
import os

BASE = os.path.normpath(os.path.join(os.path.dirname(__file__), "public"))

ROOMS = [
    {
        "key":   "left",
        "label": "Cottage (left house)",
        "img":   os.path.join(BASE, "cottage_room.png"),
    },
    {
        "key":   "right",
        "label": "Brownstone (right house)",
        "img":   os.path.join(BASE, "brownstone_room.jpeg"),
    },
]

PREVIEW_FLOWER = os.path.join(BASE, "flowers", "single_bloomed_rose.png")

MAX_W = 900
MAX_H = 700

results = {}   # key -> { anchorXPct, anchorYPct, widthPct }

room_idx = 0

# ── Load / scale helpers ───────────────────────────────────────────────────────

def load_room(path):
    img = Image.open(path).convert("RGBA")
    W, H = img.size
    scale = min(MAX_W / W, MAX_H / H, 1.0)
    dw, dh = int(W * scale), int(H * scale)
    return img.resize((dw, dh), Image.LANCZOS), dw, dh, scale

flower_orig = Image.open(PREVIEW_FLOWER).convert("RGBA")

# ── State ──────────────────────────────────────────────────────────────────────
anchor_x = None   # pixel coords in display image
anchor_y = None
flower_w_pct = 0.06   # default 6% of image width — adjustable
STEP = 0.005

root = tk.Tk()
root.title("Flower Position Configurator")

canvas = tk.Canvas(root, cursor="crosshair")
canvas.pack()

info_lbl = tk.Label(root, font=("Arial", 12, "bold"), bg="#eef", pady=6)
info_lbl.pack(fill=tk.X)

hint_lbl = tk.Label(root,
    text="Click vase opening  |  Scroll / +- to resize  |  n = next room  |  q = done",
    font=("Courier", 10), bg="#fff", fg="#555")
hint_lbl.pack(fill=tk.X)

room_img_photo = None
flower_photo   = None
room_dw = room_dh = 1

def load_current_room():
    global room_img_photo, room_dw, room_dh, anchor_x, anchor_y
    anchor_x = anchor_y = None
    cfg = ROOMS[room_idx]
    img, dw, dh, _ = load_room(cfg["img"])
    room_dw, room_dh = dw, dh
    room_img_photo = ImageTk.PhotoImage(img)
    canvas.config(width=dw, height=dh)
    redraw()
    info_lbl.config(text=f"Room {room_idx+1}/{len(ROOMS)}: {cfg['label']}")

def make_flower_photo(px_width):
    """Scale the preview flower to px_width pixels wide."""
    W, H = flower_orig.size
    px_h = int(px_width * H / W)
    scaled = flower_orig.resize((px_width, px_h), Image.LANCZOS)
    return ImageTk.PhotoImage(scaled), px_width, px_h

def redraw():
    global flower_photo
    canvas.delete("all")
    canvas.create_image(0, 0, anchor=tk.NW, image=room_img_photo)

    if anchor_x is None:
        return

    # Draw crosshair at anchor
    r = 6
    canvas.create_oval(anchor_x-r, anchor_y-r, anchor_x+r, anchor_y+r,
                       outline="red", width=2)
    canvas.create_line(anchor_x-14, anchor_y, anchor_x+14, anchor_y, fill="red", width=1)
    canvas.create_line(anchor_x, anchor_y-14, anchor_x, anchor_y+14, fill="red", width=1)

    # Draw flower preview: center-x at anchor, bottom at anchor
    px_width = max(4, int(flower_w_pct * room_dw))
    flower_photo, fw, fh = make_flower_photo(px_width)
    fx = anchor_x - fw // 2
    fy = anchor_y - fh        # bottom of flower at anchor y
    canvas.create_image(fx, fy, anchor=tk.NW, image=flower_photo)

    # Size readout
    canvas.create_text(anchor_x, anchor_y + 14,
                       text=f"{flower_w_pct*100:.1f}%",
                       fill="red", font=("Arial", 9, "bold"), anchor=tk.N)

def on_click(e):
    global anchor_x, anchor_y
    anchor_x, anchor_y = e.x, e.y
    save_result()
    redraw()

def change_size(delta):
    global flower_w_pct
    flower_w_pct = max(0.01, flower_w_pct + delta)
    save_result()
    redraw()

def on_scroll(e):
    if e.delta > 0 or e.num == 4:
        change_size(+STEP)
    else:
        change_size(-STEP)

def on_key(e):
    global room_idx
    ch = e.char.lower()
    if ch in ("+", "="):
        change_size(+STEP)
    elif ch == "-":
        change_size(-STEP)
    elif ch == "n":
        if room_idx < len(ROOMS) - 1:
            room_idx += 1
            load_current_room()
    elif ch in ("q", "\x1b"):
        print_output()

def save_result():
    if anchor_x is None:
        return
    results[ROOMS[room_idx]["key"]] = {
        "anchorXPct": round(anchor_x / room_dw * 100, 2),
        "anchorYPct": round(anchor_y / room_dh * 100, 2),
        "widthPct":   round(flower_w_pct * 100, 2),
    }

def print_output():
    print("\n" + "="*60)
    print("// Paste into ROOM_CONFIG in App.jsx")
    print("="*60)
    for key, v in results.items():
        ax = f'{v["anchorXPct"]}%'
        ay = f'{v["anchorYPct"]}%'
        w  = f'{v["widthPct"]}%'
        print(f"""
  {key}: {{
    // ... existing bookshelf/vase entries ...
    flowerAnchorX: "{ax}",
    flowerAnchorY: "{ay}",
    flowerWidth:   "{w}",
  }},""")
    print("="*60)

    # Show in popup
    win = tk.Toplevel(root)
    win.title("Copy this into App.jsx")
    txt = tk.Text(win, font=("Courier", 11), width=55, height=18)
    lines = ["// ROOM_CONFIG flower position values\n"]
    for key, v in results.items():
        lines.append(f'"{key}": {{\n')
        lines.append(f'  flowerAnchorX: "{v["anchorXPct"]}%",\n')
        lines.append(f'  flowerAnchorY: "{v["anchorYPct"]}%",\n')
        lines.append(f'  flowerWidth:   "{v["widthPct"]}%",\n')
        lines.append("},\n\n")
    code = "".join(lines)
    txt.insert(tk.END, code)
    txt.pack(padx=8, pady=8)
    try:
        root.clipboard_clear()
        root.clipboard_append(code)
        tk.Label(win, text="✓ Copied to clipboard!", fg="green", font=("Arial", 11)).pack()
    except Exception:
        pass

canvas.bind("<Button-1>",   on_click)
canvas.bind("<MouseWheel>", on_scroll)   # Windows / macOS
canvas.bind("<Button-4>",   on_scroll)   # Linux scroll up
canvas.bind("<Button-5>",   on_scroll)   # Linux scroll down
root.bind("<Key>",          on_key)

load_current_room()
root.mainloop()
