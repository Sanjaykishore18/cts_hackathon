import os

model_path = os.path.join(os.getcwd(), 'ml_model', 'churn model')

with open(model_path, 'rb') as f:
    raw_bytes = f.read()

text = raw_bytes.decode('utf-8')

single_n_count = 0
for i in range(len(text)):
    if text[i] == '\n':
        if i == 0 or text[i-1] != '\r':
            single_n_count += 1

print("Single \\n (without preceding \\r) count:", single_n_count)
