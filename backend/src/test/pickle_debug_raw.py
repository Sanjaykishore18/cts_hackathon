import os
import sys
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

f_in = io.BytesIO(original_binary)
unpickler = _Unpickler(f_in)
unpickler.load()
