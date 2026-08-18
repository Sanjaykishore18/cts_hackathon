import os

model_path = os.path.join(os.getcwd(), 'ml_model', 'churn model')

with open(model_path, 'rb') as f:
    raw_bytes = f.read()

text = raw_bytes.decode('utf-8')

print("Raw bytes len:", len(raw_bytes))
print("Text len:", len(text))

# Let's see what characters are > 255 and their counts
high_chars = {}
for char in text:
    if ord(char) > 255:
        high_chars[char] = high_chars.get(char, 0) + 1

print("High chars:", len(high_chars))
for c, count in list(high_chars.items())[:20]:
    print(f"Char: {c} (U+{ord(c):04X}) count: {count}")
