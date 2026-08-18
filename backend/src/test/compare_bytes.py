import os

model_path = os.path.join(os.getcwd(), 'ml_model', 'churn model')

cp1252_map = {
    '\u20ac': 0x80,
    '\u201a': 0x82,
    '\u0192': 0x83,
    '\u201e': 0x84,
    '\u2026': 0x85,
    '\u2020': 0x86,
    '\u2021': 0x87,
    '\u02c6': 0x88,
    '\u2030': 0x89,
    '\u0160': 0x8a,
    '\u2039': 0x8b,
    '\u0152': 0x8c,
    '\u017d': 0x8e,
    '\u2018': 0x91,
    '\u2019': 0x92,
    '\u201c': 0x93,
    '\u201d': 0x94,
    '\u2022': 0x95,
    '\u2013': 0x96,
    '\u2014': 0x97,
    '\u02dc': 0x98,
    '\u2122': 0x99,
    '\u0161': 0x9a,
    '\u203a': 0x9b,
    '\u0153': 0x9c,
    '\u017e': 0x9e,
    '\u0178': 0x9f,
}

with open(model_path, 'rb') as f:
    raw_bytes = f.read()

text = raw_bytes.decode('utf-8')

reconstructed_bytes = bytearray()
for char in text:
    if char in cp1252_map:
        reconstructed_bytes.append(cp1252_map[char])
    else:
        val = ord(char)
        reconstructed_bytes.append(val & 0xFF)

reconstructed_bytes = bytes(reconstructed_bytes)

print("Raw bytes length:", len(raw_bytes))
print("Reconstructed bytes length:", len(reconstructed_bytes))

# Find the first mismatch
mismatch = -1
for i in range(min(len(raw_bytes), len(reconstructed_bytes))):
    if raw_bytes[i] != reconstructed_bytes[i]:
        mismatch = i
        break

if mismatch != -1:
    print(f"First mismatch at index {mismatch}:")
    print("Raw hex context:", raw_bytes[max(0, mismatch-10):mismatch+10].hex())
    print("Reconstructed hex context:", reconstructed_bytes[max(0, mismatch-10):mismatch+10].hex())
else:
    print("No mismatches found!")
