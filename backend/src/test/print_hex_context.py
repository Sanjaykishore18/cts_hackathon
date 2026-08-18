import os

model_path = os.path.join(os.getcwd(), 'ml_model', 'churn model')

with open(model_path, 'rb') as f:
    raw_bytes = f.read()

# Let's search for "xgboost.sklearn" bytes
target = b"xgboost.sklearn"
idx = raw_bytes.find(target)

if idx != -1:
    print("Found 'xgboost.sklearn' at index:", idx)
    context = raw_bytes[max(0, idx-20):idx+40]
    print("UTF-8 hex context:", context.hex())
    # Decode to see the characters
    print("UTF-8 decoded context:", context.decode('utf-8', errors='replace'))
else:
    print("'xgboost.sklearn' not found in raw bytes.")
