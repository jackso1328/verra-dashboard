import cv2
import numpy as np
from PIL import Image

logo = cv2.imread("frontend/assets/images/verra_logo.png", cv2.IMREAD_UNCHANGED)
h, w = logo.shape[:2]

# Clean up any stray fringe pixels:
# 1. Top row artifacts
logo[:8, :, 3] = 0
# 2. Stray pixels above the plaque top border (which is around y=0.74*h to 0.77*h outside the emblem)
# Let's clean the strip right above the gold plaque:
# The plaque starts at y ~ 430 in this 575px tall image
plaque_y = 430
# Clear stray noise between x=0 to x=w in the tiny 6px gap above the plaque except where the central root tip touches
logo[plaque_y-14:plaque_y, :int(w*0.42), 3] = 0
logo[plaque_y-14:plaque_y, int(w*0.58):, 3] = 0

# Remove stray isolated pixels in alpha channel using morphological opening
alpha = logo[:, :, 3]
kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
cleaned_alpha = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, kernel)
logo[:, :, 3] = cleaned_alpha

cv2.imwrite("frontend/assets/images/verra_logo.png", logo)
cv2.imwrite("frontend/assets/images/logo.png", logo)

# Re-generate horizontal nav logo cleanly:
pil_full = Image.open("frontend/assets/images/verra_logo.png")
bbox = pil_full.getbbox()
pil_full = pil_full.crop(bbox)

emblem_h = int(pil_full.height * 0.75)
emblem = pil_full.crop((0, 0, pil_full.width, emblem_h))
emblem = emblem.crop(emblem.getbbox())

plaque = pil_full.crop((0, emblem_h, pil_full.width, pil_full.height))
plaque = plaque.crop(plaque.getbbox())

target_h = 70
scale_e = target_h / emblem.height
ew = int(emblem.width * scale_e)
emblem_res = emblem.resize((ew, target_h), Image.Resampling.LANCZOS)

scale_p = (target_h * 0.44) / plaque.height
pw = int(plaque.width * scale_p)
plaque_res = plaque.resize((pw, int(target_h * 0.44)), Image.Resampling.LANCZOS)

nav_w = ew + pw + 16
nav_canvas = Image.new("RGBA", (nav_w, target_h), (0, 0, 0, 0))
nav_canvas.paste(emblem_res, (0, 0), emblem_res)
nav_canvas.paste(plaque_res, (ew + 16, int((target_h - plaque_res.height) / 2)), plaque_res)
nav_canvas.save("frontend/assets/images/verra_nav_logo.png", "PNG")
nav_canvas.save("frontend/assets/images/logo_nav.png", "PNG")
print("Cleaned and updated logo assets successfully!")
