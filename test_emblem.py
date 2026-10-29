import numpy as np
from PIL import Image
from rembg import remove, new_session

img_path = "frontend/assets/images/logo_raw.jpg"
img = Image.open(img_path).convert("RGB")
w, h = img.size
print(f"Original size: {w}x{h}")

# Let's crop the top part (emblem) and bottom part (plaque) separately, or use a model that detects both
# The emblem is located roughly from y=0.05*h to y=0.75*h, x=0.0*w to x=0.92*w (avoiding top right pen/notebook)
# The plaque is from y=0.72*h to y=0.95*h, x=0.10*w to x=0.88*w

# Let's run rembg on the emblem region specifically
emblem_box = (0, 0, int(w * 0.90), int(h * 0.75))
emblem_crop = img.crop(emblem_box)

# Try different rembg sessions or parameters
session = new_session("u2net")
emblem_nobg = remove(emblem_crop, session=session, alpha_matting=True, alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=10)
emblem_nobg.save("frontend/assets/images/emblem_test.png")

print("Emblem test saved!")
