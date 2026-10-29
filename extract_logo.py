import os
from PIL import Image
from rembg import remove

raw_path = "frontend/assets/images/logo_raw.jpg"
out_full_png = "frontend/assets/images/logo_nobg.png"
out_header_png = "frontend/assets/images/logo.png"

print("Reading input image...")
input_img = Image.open(raw_path).convert("RGBA")

print("Removing background with AI segmentation...")
nobg_img = remove(input_img)

# Save full cut out
nobg_img.save(out_full_png, "PNG")
print(f"Saved: {out_full_png}")

# Also let's crop to the bounding box of non-transparent pixels
bbox = nobg_img.getbbox()
if bbox:
    cropped = nobg_img.crop(bbox)
    # Add a comfortable padding around it
    pad = 12
    padded = Image.new("RGBA", (cropped.width + pad * 2, cropped.height + pad * 2), (0, 0, 0, 0))
    padded.paste(cropped, (pad, pad))
    padded.save(out_header_png, "PNG")
    print(f"Saved padded & cropped logo: {out_header_png}")

print("Background removal completed successfully!")
