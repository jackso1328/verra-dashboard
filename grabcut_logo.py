import cv2
import numpy as np
from PIL import Image

# Read image
bgr = cv2.imread("frontend/assets/images/logo_raw.jpg")
hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
h, w = bgr.shape[:2]

# Let's crop out the irrelevant pen/notebook at the top right:
# Pen is in x > 0.8 * w and y < 0.4 * h
roi_mask = np.ones((h, w), dtype=np.uint8) * 255
cv2.rectangle(roi_mask, (int(w * 0.78), 0), (w, int(h * 0.35)), 0, -1)

# Plaque detection:
# The plaque is a prominent rectangular gold bar at the bottom: y ~ 490 to 620, x ~ 100 to 730
plaque_crop = bgr[int(h*0.74):int(h*0.96), int(w*0.1):int(w*0.9)]

# For the emblem:
# The emblem has:
# 1. Emerald green roots (H: 60-95 in 0-180 scale, Sat > 60)
# 2. Golden lines and branches (H: 15-40, Sat > 60, Val > 120)
# 3. Black V letter inside gold border
# 4. Moss texture (greenish/dark green)

# Let's detect the wood background:
# Wood is reddish/brown: H in [5, 25], S in [40, 180], V in [50, 160]
# Notice the wood has distinctive grain texture

# Let's use GrabCut with an initialization rect around the emblem and plaque!
# GrabCut is exceptionally good for exact boundary extraction on photographic textures
mask = np.zeros((h, w), np.uint8)
bgdModel = np.zeros((1, 65), np.float64)
fgdModel = np.zeros((1, 65), np.float64)

# Rect around the emblem and branches
# Emblem bounds: x from ~20 to ~700, y from ~50 to ~500
rect_emblem = (int(w * 0.02), int(h * 0.08), int(w * 0.82), int(h * 0.88))
cv2.grabCut(bgr, mask, rect_emblem, bgdModel, fgdModel, 5, cv2.GC_INIT_WITH_RECT)

# Also explicitly set background area outside rect
mask[roi_mask == 0] = cv2.GC_BGD

# Refine with definite foreground seeds:
# 1. Green roots are definitely foreground
green_mask = (hsv[:, :, 0] > 60) & (hsv[:, :, 0] < 95) & (hsv[:, :, 1] > 70) & (hsv[:, :, 2] > 50)
mask[green_mask] = cv2.GC_FGD

# 2. Gold border lines are definitely foreground
gold_mask = (hsv[:, :, 0] > 18) & (hsv[:, :, 0] < 42) & (hsv[:, :, 1] > 80) & (hsv[:, :, 2] > 140)
mask[gold_mask] = cv2.GC_FGD

# 3. Gold plaque at bottom:
plaque_area = np.zeros((h, w), dtype=bool)
plaque_area[int(h*0.75):int(h*0.93), int(w*0.13):int(w*0.86)] = True
mask[plaque_area] = cv2.GC_FGD

# 4. Center of the V:
# V center is black wood? No, V center is black matte finish with gold bevel
# Left stroke of V: line from (w*0.25, h*0.10) to (w*0.5, h*0.55)
# Right stroke of V: line from (w*0.73, h*0.10) to (w*0.5, h*0.55)
v_poly = np.array([
    [int(w * 0.26), int(h * 0.10)],
    [int(w * 0.38), int(h * 0.10)],
    [int(w * 0.50), int(h * 0.48)],
    [int(w * 0.62), int(h * 0.10)],
    [int(w * 0.74), int(h * 0.10)],
    [int(w * 0.53), int(h * 0.58)],
    [int(w * 0.47), int(h * 0.58)]
], np.int32)
cv2.fillPoly(mask, [v_poly], cv2.GC_FGD)

# Now run GrabCut with mask!
cv2.grabCut(bgr, mask, None, bgdModel, fgdModel, 6, cv2.GC_INIT_WITH_MASK)

# Create binary mask where pixels are probably or definitely foreground
fg_mask = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype('uint8')

# Remove top right notebook artifact
fg_mask[roi_mask == 0] = 0

# Smooth edges slightly with bilateral filter or Gaussian blur for clean transparency
alpha = cv2.GaussianBlur(fg_mask, (5, 5), 0)

# Merge BGR with Alpha to form RGBA
b, g, r = cv2.split(bgr)
rgba = cv2.merge([r, g, b, alpha])

out_pil = Image.fromarray(rgba)
out_pil.save("frontend/assets/images/logo_grabcut.png")
print("Saved logo_grabcut.png!")
