import os

dir_path = os.path.join(os.getcwd(), 'ml_model', 'strategy')
preprocessor_path = os.path.join(dir_path, 'preprocessor.joblib')
model_joblib_path = os.path.join(dir_path, 'strategy_effectiveness_model.joblib')

for path in (preprocessor_path, model_joblib_path):
    if os.path.exists(path):
        print(f"\nFile: {path}")
        print("Size:", os.path.getsize(path))
        with open(path, 'rb') as f:
            header = f.read(100)
        print("Header Hex:", header.hex())
        print("Header Repr:", header)
    else:
        print(f"File not found: {path}")
