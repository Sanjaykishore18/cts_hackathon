import os

dir_path = os.path.join(os.getcwd(), 'ml_model', 'strategy')
preprocessor_path = os.path.join(dir_path, 'preprocessor.joblib')
model_joblib_path = os.path.join(dir_path, 'gradientboostingregressor_model.joblib')

for path in (preprocessor_path, model_joblib_path):
    if os.path.exists(path):
        with open(path, 'rb') as f:
            raw_bytes = f.read()
        print(f"\nFile: {path}")
        print("Size:", len(raw_bytes))
        
        # Count \r\n occurrences
        crlf_count = raw_bytes.count(b'\r\n')
        print("CRLF count:", crlf_count)
        
        # Try decoding as UTF-8
        try:
            raw_bytes.decode('utf-8')
            print("UTF-8 Decode: SUCCESS (This is a text file!)")
        except UnicodeDecodeError:
            print("UTF-8 Decode: FAILED (This is likely a proper binary file!)")
            
        # Check first 20 bytes
        print("First 20 bytes:", raw_bytes[:20])
