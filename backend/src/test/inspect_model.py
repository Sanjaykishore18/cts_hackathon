import pickle
import os
import sys

model_path = os.path.join(os.getcwd(), 'ml_model', 'churn model')

print(f"Decoding and loading model path: {model_path}")
if not os.path.exists(model_path):
    print("Model file does not exist!")
    sys.exit(1)

try:
    # Read the file as UTF-8 string
    with open(model_path, 'r', encoding='utf-8', errors='replace') as f:
        text = f.read()
    
    # Convert string back to cp1252 bytes
    # Some characters might fail or need replacement, but let's try direct encoding
    binary_data = text.encode('cp1252', errors='replace')
    
    # Try to load the binary data
    model = pickle.loads(binary_data)
    print("--- Pickle Loads CP1252 Successful ---")
    print(f"Model Class: {type(model)}")
    if hasattr(model, 'feature_names_in_'):
        print(f"Feature Names: {list(model.feature_names_in_)}")
    if hasattr(model, 'classes_'):
        print(f"Classes: {model.classes_}")
    
except Exception as e:
    print(f"Error restoring model: {e}")
    
    # Let's try another approach: read file as raw bytes, replace the UTF-8 sequences back to single bytes
    try:
        with open(model_path, 'rb') as f:
            raw_bytes = f.read()
        
        # We decode to string as utf-8, then encode as cp1252
        decoded_str = raw_bytes.decode('utf-8')
        encoded_bytes = decoded_str.encode('cp1252')
        model = pickle.loads(encoded_bytes)
        print("--- Direct decode/encode successful ---")
        print(f"Model Class: {type(model)}")
        if hasattr(model, 'feature_names_in_'):
            print(f"Feature Names: {list(model.feature_names_in_)}")
        if hasattr(model, 'classes_'):
            print(f"Classes: {model.classes_}")
    except Exception as e2:
        print(f"Secondary recovery attempt failed: {e2}")
        sys.exit(1)
