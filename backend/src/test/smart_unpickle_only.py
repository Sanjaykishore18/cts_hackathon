import os
import sys
import traceback

# Force pure-Python pickle
if '_pickle' in sys.modules:
    del sys.modules['_pickle']
if 'pickle' in sys.modules:
    del sys.modules['pickle']
sys.modules['_pickle'] = None

import pickle
import io

model_path = os.path.join(os.getcwd(), 'ml_model', 'churn model')

cp1252_map = {
    '\u20ac': 0x80, '\u201a': 0x82, '\u0192': 0x83, '\u201e': 0x84, '\u2026': 0x85,
    '\u2020': 0x86, '\u2021': 0x87, '\u02c6': 0x88, '\u2030': 0x89, '\u0160': 0x8a,
    '\u2039': 0x8b, '\u0152': 0x8c, '\u017d': 0x8e, '\u2018': 0x91, '\u2019': 0x92,
    '\u201c': 0x93, '\u201d': 0x94, '\u2022': 0x95, '\u2013': 0x96, '\u2014': 0x97,
    '\u02dc': 0x98, '\u2122': 0x99, '\u0161': 0x9a, '\u203a': 0x9b, '\u0153': 0x9c,
    '\u017e': 0x9e, '\u0178': 0x9f,
}

with open(model_path, 'rb') as f:
    raw_bytes = f.read()

text = raw_bytes.decode('utf-8')
reconstructed = bytearray()
for char in text:
    if char in cp1252_map:
        reconstructed.append(cp1252_map[char])
    else:
        reconstructed.append(ord(char) & 0xFF)

original_binary = bytes(reconstructed).replace(b'\r\r\n', b'__TEMP_NEWLINE__')
original_binary = original_binary.replace(b'\r\n', b'\n')
original_binary = original_binary.replace(b'__TEMP_NEWLINE__', b'\r\n')

class SmartUnpickler(pickle.Unpickler):
    def load_short_binunicode(self):
        stream = self._file_read.__self__
        len_byte = stream.read(1)[0]
        pos = stream.tell()
        
        # Peek ahead 100 bytes to look for \x94
        peek_bytes = stream.read(100)
        memoize_idx = peek_bytes.find(b'\x94')
        
        if memoize_idx != -1:
            string_bytes = peek_bytes[:memoize_idx]
            stream.seek(pos + memoize_idx)
            val = string_bytes.decode("utf-8", errors="replace")
            print(f"Smart-read string: '{val}' (len={len(string_bytes)}, expected={len_byte})")
        else:
            stream.seek(pos)
            string_bytes = stream.read(len_byte)
            val = string_bytes.decode("utf-8", errors="replace")
            print(f"Default-read string: '{val}' (len={len_byte})")
            
        self.append(val)

try:
    f_in = io.BytesIO(original_binary)
    unpickler = SmartUnpickler(f_in)
    model = unpickler.load()
    print("--- SUCCESS ---")
    print(f"Model Class: {type(model)}")
    if hasattr(model, 'feature_names_in_'):
        print(f"Feature Names ({len(model.feature_names_in_)}): {list(model.feature_names_in_)}")
    if hasattr(model, 'classes_'):
        print(f"Classes: {list(model.classes_)}")
except Exception as e:
    traceback.print_exc()
    sys.exit(1)
