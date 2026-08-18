import os
import sys

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

f_in = io.BytesIO(original_binary)

class TraceUnpickler(pickle.Unpickler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.history = []
        
        # Wrap the dispatch table
        new_dispatch = {}
        for k, v in self.dispatch.items():
            def make_wrapper(opcode_func, opcode_key):
                return lambda self_ref: self.log_and_dispatch(self_ref, opcode_func, opcode_key)
            new_dispatch[k] = make_wrapper(v, k)
        self.dispatch = new_dispatch

    def log_and_dispatch(self, self_ref, opcode_func, opcode_key):
        pos = f_in.tell() - 1
        self.history.append((pos, opcode_key))
        if len(self.history) > 100:
            self.history.pop(0)
        try:
            opcode_func(self_ref)
        except Exception as e:
            print("\n--- OPCODES HISTORY BEFORE CRASH ---")
            for p, op in self.history:
                op_char = chr(op) if 32 <= op < 127 else f"0x{op:02X}"
                print(f"Offset {p:6d}: opcode '{op_char}' (0x{op:02x})")
            raise e

unpickler = TraceUnpickler(f_in)
unpickler.load()
