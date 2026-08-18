import os
import sys
import traceback
from pickle import _Unpickler
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

original_binary = bytes(reconstructed).replace(b'\r\n', b'\n')

class DebugUnpickler(_Unpickler):
    def load(self):
        self.memo = {}
        stream = self.read.__self__
        while True:
            pos = stream.tell()
            key = stream.read(1)
            if not key:
                raise EOFError
            opcode = key[0]
            opcode_char = chr(opcode) if 32 <= opcode < 127 else f"0x{opcode:02X}"
            
            try:
                self.dispatch[key](self)
            except Exception as e:
                print(f"\n--- Exception inside load at position {pos} (opcode '{opcode_char}' / 0x{opcode:02X}) ---")
                print(f"{type(e).__name__}: {e}")
                
                # Context print
                stream.seek(max(0, pos-40))
                print("Context before:", stream.read(40))
                print("Failed byte:", bytes([opcode]))
                print("Context after:", stream.read(40))
                raise e
            if key == b'.':
                break

try:
    f_in = io.BytesIO(original_binary)
    unpickler = DebugUnpickler(f_in)
    unpickler.load()
    print("SUCCESS")
except Exception as e:
    sys.exit(1)
