import os

model_path = os.path.join(os.getcwd(), 'ml_model', 'churn model')

with open(model_path, 'rb') as f:
    raw_bytes = f.read()

text = raw_bytes.decode('utf-8')

print("Checking chars in range U+0080 to U+00FF:")
counts = {}
for char in text:
    val = ord(char)
    if 128 <= val <= 255:
        counts[val] = counts.get(val, 0) + 1

for val in sorted(counts.keys()):
    print(f"Byte 0x{val:02X} (U+{val:04X}): count = {counts[val]}")
