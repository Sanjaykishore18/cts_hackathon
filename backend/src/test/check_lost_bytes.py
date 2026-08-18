import os

model_path = os.path.join(os.getcwd(), 'ml_model', 'churn model')

with open(model_path, 'rb') as f:
    raw_bytes = f.read()

text = raw_bytes.decode('utf-8')

replacement_count = text.count('\ufffd')
print("Replacement characters (U+FFFD) count:", replacement_count)

# Let's also print the character codes of all high chars
high_chars = set()
for char in text:
    if ord(char) > 255:
        high_chars.add(char)

for char in sorted(high_chars):
    print(f"Char: {char} (U+{ord(char):04X})")
