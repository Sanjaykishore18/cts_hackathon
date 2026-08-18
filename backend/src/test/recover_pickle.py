import os
import pickle
import sys

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

try:
    # Read using text mode to automatically translate \r\n to \n
    with open(model_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    print("Text length after universal newlines:", len(text))
    
    # Reconstruct original bytes
    reconstructed_bytes = bytearray()
    for char in text:
        if char in cp1252_map:
            reconstructed_bytes.append(cp1252_map[char])
        else:
            val = ord(char)
            reconstructed_bytes.append(val & 0xFF)
                
    # Try to load the reconstructed binary data
    model = pickle.loads(bytes(reconstructed_bytes))
    print("--- Model Loaded Successfully ---")
    print(f"Model Class: {type(model)}")
    if hasattr(model, 'feature_names_in_'):
        print(f"Feature Names ({len(model.feature_names_in_)}): {list(model.feature_names_in_)}")
    if hasattr(model, 'classes_'):
        print(f"Classes: {list(model.classes_)}")
        
    # Save the clean binary model
    clean_model_path = os.path.join(os.getcwd(), 'ml_model', 'churn_model.pkl')
    with open(clean_model_path, 'wb') as f_out:
        f_out.write(reconstructed_bytes)
    print(f"Clean binary model written to: {clean_model_path}")
    
except Exception as e:
    print(f"Failed to recover model: {e}")
    sys.exit(1)
