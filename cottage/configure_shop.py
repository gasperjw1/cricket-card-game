"""
Flower Shop Position Configurator
----------------------------------
Run:  python3 cottage/configure_shop.py
Then click the BOTTOM-CENTER of each pot in order.
Right-click (or press 'z') to undo the last placement.
Press 'q' when done to print the final SHELF_POSITIONS code.
"""

import tkinter as tk
from PIL import Image, ImageTk
import sys, os

IMG = os.path.join(os.path.dirname(__file__), "../cottage/public/flower_shop.jpeg")
IMG = os.path.normpath(os.path.join(os.path.dirname(__file__), "public/flower_shop.jpeg"))

# FLOWERS order must match the FLOWERS array in App.jsx exactly.
# Row 3 image order is: GerberaDaisy, Lavender, Daffodil, Gladiolus, Marigold
# so Lavender(12) and Daffodil(11) are swapped vs array index — click them in
# IMAGE order but the tool maps them correctly for you.
FLOWER_ORDER = [
    # (array_index, display_name, image_col)
    ( 0, "Rose",          "row1-col1"),
    ( 1, "Tulip",         "row1-col2"),
    ( 2, "Sunflower",     "row1-col3"),
    ( 3, "Lily",          "row1-col4"),
    ( 4, "Orchid",        "row1-col5"),
    ( 5, "Hydrangea",     "row2-col1"),
    ( 6, "Daisy",         "row2-col2"),
    ( 7, "Carnation",     "row2-col3"),
    ( 8, "Peony",         "row2-col4"),
    ( 9, "Chrysanthemum", "row2-col5"),
    (10, "Gerbera Daisy", "row3-col1"),
    (12, "Lavender",      "row3-col2"),  # array idx 12 — image col2
    (11, "Daffodil",      "row3-col3"),  # array idx 11 — image col3
    (14, "Gladiolus",     "row3-col4"),  # array idx 14 — image col4
    (13, "Marigold",      "row3-col5"),  # array idx 13 — image col5
]

positions = {}   # array_index -> (x_pct, y_pct)
step = 0

root = tk.Tk()
root.title("Flower Shop Configurator — click each pot bottom-center")

# Load and scale image to fit screen (max 1200 wide)
img_orig = Image.open(IMG)
W, H = img_orig.size
MAX_W = 1200
scale = min(MAX_W / W, 1.0)
DW = int(W * scale)
DH = int(H * scale)
img_display = img_orig.resize((DW, DH), Image.LANCZOS)
photo = ImageTk.PhotoImage(img_display)

canvas = tk.Canvas(root, width=DW, height=DH, cursor="crosshair")
canvas.pack()
canvas.create_image(0, 0, anchor=tk.NW, image=photo)

# Overlays stored so we can undraw them
markers = []   # list of (canvas_ids...)

def status_text():
    if step >= len(FLOWER_ORDER):
        return "All done! Press 'q' to print the code."
    idx, name, loc = FLOWER_ORDER[step]
    return f"[{step+1}/{len(FLOWER_ORDER)}]  Click BOTTOM-CENTER of:  {name}  ({loc})"

info = tk.Label(root, text=status_text(), font=("Arial", 13, "bold"),
                bg="#eef", pady=6)
info.pack(fill=tk.X)

coord_lbl = tk.Label(root, text="hover: x=— y=—", font=("Courier", 11), bg="#fff")
coord_lbl.pack(fill=tk.X)

def on_motion(e):
    xp = e.x / DW * 100
    yp = e.y / DH * 100
    coord_lbl.config(text=f"hover: x={xp:.1f}%  y={yp:.1f}%")

def place_marker(e):
    global step
    if step >= len(FLOWER_ORDER):
        return
    xp = e.x / DW * 100
    yp = e.y / DH * 100
    idx, name, _ = FLOWER_ORDER[step]
    positions[idx] = (round(xp, 1), round(yp, 1))

    r = 7
    dot   = canvas.create_oval(e.x-r, e.y-r, e.x+r, e.y+r,
                                fill="lime", outline="white", width=2)
    label = canvas.create_text(e.x, e.y - r - 8, text=name[:8],
                                fill="lime", font=("Arial", 8, "bold"),
                                anchor=tk.S)
    markers.append((dot, label, e.x, e.y))
    step += 1
    info.config(text=status_text())

def undo(e=None):
    global step
    if step == 0 or not markers:
        return
    step -= 1
    idx, _, _ = FLOWER_ORDER[step]
    positions.pop(idx, None)
    dot, label, *_ = markers.pop()
    canvas.delete(dot)
    canvas.delete(label)
    info.config(text=status_text())

def print_output(e=None):
    lines = ["const SHELF_POSITIONS = ["]
    result = [None] * len(FLOWER_ORDER)
    for i, (idx, name, loc) in enumerate(FLOWER_ORDER):
        result.append((idx, name, loc))

    # Sort by array index to output in FLOWERS array order
    ordered = sorted(positions.items())  # (idx, (x, y))
    # Build the 15-slot array
    slots = {}
    for idx, (x, y) in ordered:
        slots[idx] = (x, y)

    for arr_i in range(15):
        if arr_i in slots:
            x, y = slots[arr_i]
            name = next(n for (i, n, _) in FLOWER_ORDER if i == arr_i)
            lines.append(f'  {{ x: "{x}%", y: "{y}%" }},  // {arr_i}  {name}')
        else:
            lines.append(f'  {{ x: "?", y: "?" }},  // {arr_i}  (not set)')
    lines.append("];")
    code = "\n".join(lines)
    print("\n" + "="*60)
    print(code)
    print("="*60 + "\n")

    # Show in popup
    win = tk.Toplevel(root)
    win.title("Copy this into App.jsx")
    txt = tk.Text(win, font=("Courier", 11), width=60, height=22)
    txt.insert(tk.END, code)
    txt.pack(padx=8, pady=8)
    try:
        root.clipboard_clear()
        root.clipboard_append(code)
        tk.Label(win, text="✓ Also copied to clipboard!", fg="green",
                 font=("Arial", 11)).pack()
    except Exception:
        pass

canvas.bind("<Motion>",  on_motion)
canvas.bind("<Button-1>", place_marker)
canvas.bind("<Button-2>", undo)   # right-click on Mac
canvas.bind("<Button-3>", undo)   # right-click on Windows/Linux
root.bind("z", undo)
root.bind("q", print_output)
root.bind("<Escape>", print_output)

root.mainloop()
