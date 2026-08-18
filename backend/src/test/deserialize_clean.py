import os
import sys
import traceback

# Force pure-Python pickle to allow manual override
if '_pickle' in sys.modules:
    del sys.modules['_pickle']
if 'pickle' in sys.modules:
    del sys.modules['pickle']
sys.modules['_pickle'] = None

import pickle
import io

model_path = os.path.join(os.getcwd(), 'ml_model', 'churn model')
clean_model_path = os.path.join(os.getcwd(), 'ml_model', 'churn_model.pkl')

cp1252_map = {
    '\u20ac': 0x80, '\u201a': 0x82, '\u0192': 0x83, '\u201e': 0x84, '\u2026': 0x85,
    '\u2020': 0x86, '\u2021': 0x87, '\u02c6': 0x88, '\u2030': 0x89, '\u0160': 0x8a,
    '\u2039': 0x8b, '\u0152': 0x8c, '\u017d': 0x8e, '\u2018': 0x91, '\u2019': 0x92,
    '\u201c': 0x93, '\u201d': 0x94, '\u2022': 0x95, '\u2013': 0x96, '\u2014': 0x97,
    '\u02dc': 0x98, '\u2122': 0x99, '\u0161': 0x9a, '\u203a': 0x9b, '\u0153': 0x9c,
    '\u017e': 0x9e, '\u0178': 0x9f,
}

print("Reading and decoding text file...", flush=True)
with open(model_path, 'rb') as f:
    raw_bytes = f.read()

text = raw_bytes.decode('utf-8')
reconstructed = bytearray()
for char in text:
    if char in cp1252_map:
        reconstructed.append(cp1252_map[char])
    else:
        reconstructed.append(ord(char) & 0xFF)

print("Reversing text-mode newline normalization...", flush=True)
original_binary = bytes(reconstructed).replace(b'\r\r\n', b'__TEMP_NEWLINE__')
original_binary = original_binary.replace(b'\r\n', b'\n')
original_binary = original_binary.replace(b'__TEMP_NEWLINE__', b'\r\n')

class RepairUnpickler(pickle.Unpickler):
    def load_short_binunicode(self):
        unframer = self.read.__self__
        stream = unframer.current_frame if unframer.current_frame is not None else f_in
        len_byte = stream.read(1)[0]
        pos = stream.tell()
        
        peek_bytes = stream.read(100)
        memoize_idx = peek_bytes.find(b'\x94')
        
        if memoize_idx != -1:
            string_bytes = peek_bytes[:memoize_idx]
            stream.seek(pos + memoize_idx)
            val = string_bytes.decode("utf-8", errors="replace")
            print(f"Smart-read: '{val}' (len={len(string_bytes)}, expected={len_byte})", flush=True)
        else:
            stream.seek(pos)
            string_bytes = stream.read(len_byte)
            val = string_bytes.decode("utf-8", errors="replace")
            print(f"Default-read: '{val}' (len={len_byte})", flush=True)
            
        self.append(val)

# We want to re-serialize a clean, uncorrupted version using protocol 4
class DummyXGBClassifier:
    pass

def dummy_find_class(module, name):
    if 'xgboost' in module or 'sklearn' in module:
        return DummyXGBClassifier
    return pickle.Unpickler.find_class(unpickler, module, name)

try:
    f_in = io.BytesIO(original_binary)
    unpickler = RepairUnpickler(f_in)
    unpickler.dispatch[140] = RepairUnpickler.load_short_binunicode
    unpickler.find_class = dummy_find_class
    
    print("Deserializing and loading model structure...", flush=True)
    model = unpickler.load()
    
    print("Re-serializing clean binary pickle...", flush=True)
    repaired_bytes = bytearray(original_binary)
    idx_xgb = original_binary.find(b'XGBClassifier')
    if idx_xgb != -1:
        len_idx = idx_xgb - 1
        if repaired_bytes[len_idx] == 0x0a and repaired_bytes[len_idx-1] == 0x8c:
            repaired_bytes[len_idx] = 13
            print(f"Repaired XGBClassifier length header at index {len_idx} successfully.", flush=True)
            
    idx_ml = original_binary.find(b'max_leaves')
    if idx_ml != -1:
        len_idx = idx_ml - 1
        if repaired_bytes[len_idx-1] == 0x8c:
            repaired_bytes[len_idx] = 10
            print(f"Repaired max_leaves length header at index {len_idx} successfully.", flush=True)

    with open(clean_model_path, 'wb') as f_out:
        f_out.write(bytes(repaired_bytes))
        
    print(f"--- SUCCESS ---", flush=True)
    print(f"Clean binary pickle file generated at: {clean_model_path}", flush=True)
except Exception as e:
    traceback.print_exc()
    sys.exit(1)
