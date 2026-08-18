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

class DebugSmartUnpickler(pickle.Unpickler):
    def load(self):
        self.memo = {}
        # Set up bound read/readline methods
        self.read = self._file_read
        self.readline = self._file_readline
        stream = self._file_read.__self__
        while True:
            pos = stream.tell()
            key = stream.read(1)
            if not key:
                raise EOFError
            opcode = key[0]
            opcode_char = chr(opcode) if 32 <= opcode < 127 else f"0x{opcode:02X}"
            
            # Use opcode integer as key
            self.dispatch[opcode](self)
            
            if key == b'.':
                break

    def load_short_binunicode(self):
        stream = self._file_read.__self__
        len_byte = stream.read(1)[0]
        pos = stream.tell()
        peek_bytes = stream.read(100)
        
        # Search for 0x94 (MEMOIZE)
        memoize_idx = peek_bytes.find(b'\x94')
        if memoize_idx != -1:
            string_bytes = peek_bytes[:memoize_idx]
            stream.seek(pos + memoize_idx)
        else:
            stream.seek(pos)
            string_bytes = stream.read(len_byte)
            
        val = string_bytes.decode("utf-8", errors="replace")
        self.append(val)

f_in = io.BytesIO(original_binary)
unpickler = DebugSmartUnpickler(f_in)
unpickler.load()
