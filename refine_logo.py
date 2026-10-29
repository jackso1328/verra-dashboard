import cv2
import numpy as np
from PIL import Image

# Load the grabcut result and original
gc = cv2.imread("frontend/assets/images/logo_grabcut.png", cv2.IMREAD_UNCHANGED)
bgr = cv2.imread("frontend/assets/images/logo_raw.jpg")
hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
h, w = bgr.shape[:2]

alpha = gc[:, :, 3].copy()

# 1. Clear any pixels to the far right (the stray green stone on the right edge)
alpha[:, int(w * 0.83):] = 0

# 2. Clear stray artifacts above y=40
alpha[:int(h * 0.07), :] = 0

# 3. Detect wood color in the image:
# Wood is characteristic warm brown/reddish:
# In HSV: Hue 6 to 22, Saturation 35 to 200, Value 30 to 170
wood_mask = (hsv[:, :, 0] >= 5) & (hsv[:, :, 0] <= 24) & (hsv[:, :, 1] >= 35) & (hsv[:, :, 2] >= 25) & (hsv[:, :, 2] <= 180)

# But protect the gold branches, gold plaque, and gold borders!
# Gold has Hue 22-42, Saturation > 50, Value > 130
is_gold = (hsv[:, :, 0] >= 20) & (hsv[:, :, 0] <= 45) & (hsv[:, :, 1] >= 40) & (hsv[:, :, 2] >= 110)

# Protect the black V strokes:
# Black V has low Saturation (< 35) and low-mid Value (< 65), inside the V region
is_black_v = (hsv[:, :, 1] < 45) & (hsv[:, :, 2] < 70) & (hsv[:, :, 2] > 10)

# Protect green roots & moss:
is_green = (hsv[:, :, 0] >= 45) & (hsv[:, :, 0] <= 95) & (hsv[:, :, 1] >= 40)

# Protect the gold plaque region completely:
is_plaque = np.zeros((h, w), dtype=bool)
is_plaque[int(h * 0.745):int(h * 0.93), int(w * 0.13):int(w * 0.86)] = True

# Wood pixels that are NOT protected should be transparent
remove_wood = wood_mask & (~is_gold) & (~is_green) & (~is_plaque)

# Specifically inside the V triangle (between left and right branches of V):
# Triangle from (0.33*w, 0.10*h) to (0.65*w, 0.10*h) to (0.50*w, 0.48*h)
v_inner_poly = np.array([
    [int(w * 0.35), int(h * 0.08)],
    [int(w * 0.65), int(h * 0.08)],
    [int(w * 0.50), int(h * 0.49)]
], np.int32)
inner_v_mask = np.zeros((h, w), dtype=np.uint8)
cv2.fillPoly(inner_v_mask, [v_inner_poly], 255)

# Any non-gold pixel inside the inner V is wood background
remove_wood = remove_wood | ((inner_v_mask == 255) & (~is_gold))

# Also behind the moss on the right (wood sticking out):
wood_behind_moss = np.zeros((h, w), dtype=bool)
wood_behind_moss[int(h * 0.18):int(h * 0.55), int(w * 0.68):int(w * 0.82)] = True
remove_wood = remove_wood | (wood_behind_moss & wood_mask & (~is_gold) & (~is_green))

# Apply removal to alpha
alpha[remove_wood] = 0

# Also clean up the bottom wood under the plaque
alpha[int(h * 0.93):, :] = 0
alpha[:, :int(w * 0.06)] = 0

# Smooth alpha slightly
alpha_smooth = cv2.medianBlur(alpha, 3)

# Construct final RGBA
b, g, r = cv2.split(bgr)
final_rgba = cv2.merge([r, g, b, alpha_smooth])

# Crop to bounding box with clean padding
pil_img = Image.fromarray(final_rgba)
bbox = pil_img.getbbox()
if bbox:
    cropped_final = pil_img.crop(bbox)
    pad = 16
    padded_final = Image.new("RGBA", (cropped_final.width + pad * 2, cropped_final.height + pad * 2), (0, 0, 0, 0))
    padded_final.paste(cropped_final, (pad, pad))
    padded_final.save("frontend/assets/images/verra_logo.png", "PNG")
    padded_final.save("frontend/assets/images/logo.png", "PNG")
    print(f"Saved refined verra_logo.png! Size: {padded_final.size}")

# Also create a horizontal version for top navbar (emblem on left, plaque/typography on right)
# Emblem is top ~75% of cropped_final, plaque is bottom ~25%
emblem_h = int(cropped_final.height * 0.76)
emblem_part = cropped_final.crop((0, 0, cropped_final.width, emblem_h))
emblem_bbox = emblem_part.getbbox()
if emblem_bbox:
    emblem_part = emblem_part.crop(emblem_bbox)
    emblem_part.save("frontend/assets/images/verra_emblem.png", "PNG")

plaque_part = cropped_final.crop((0, emblem_h, cropped_final.width, cropped_final.height))
plaque_bbox = plaque_part.getbbox()
if plaque_bbox:
    plaque_part = plaque_part.crop(plaque_bbox)
    plaque_part.save("frontend/assets/images/verra_plaque.png", "PNG")

# Assemble horizontal luxury nav logo:
# Target nav height ~60px
target_h = 100
scale_e = target_h / emblem_part.height
ew = int(emblem_part.width * scale_e)
emblem_resized = emblem_part.resize((ew, target_h), Image.Resampling.LANCZOS)

scale_p = (target_h * 0.45) / plaque_part.height
pw = int(plaque_part.width * scale_p)
plaque_resized = plaque_part.resize((pw, int(target_h * 0.45)), Image.Resampling.LANCZOS)

nav_w = ew + pw + 20
nav_logo = Image.new("RGBA", (nav_w, target_h), (0, 0, 0, 0))
nav_logo.paste(emblem_resized, (0, 0), emblem_resized)
# Paste plaque vertically centered
nav_logo.paste(plaque_resized, (ew + 20, int((target_h - plaque_resized.height) / 2)), plaque_resized)
nav_logo.save("frontend/assets/images/verra_nav_logo.png", "PNG")
print("Saved verra_nav_logo.png!")
