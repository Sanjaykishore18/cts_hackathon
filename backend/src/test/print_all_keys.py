import os
import sys
import pickle

# Force pure-Python pickle
if '_pickle' in sys.modules:
    del sys.modules['_pickle']
if 'pickle' in sys.modules:
    del sys.modules['pickle']
sys.modules['_pickle'] = None

import pickle
import io

model_path = os.path.join(os.getcwd(), 'ml_model', 'strategy', 'strategy_effectiveness_model.pkl')

class DummyModel:
    def __init__(self, *args, **kwargs):
        pass
    def __setstate__(self, state):
        if isinstance(state, dict):
            self.__dict__.update(state)
        else:
            self._state = state

class_cache = {}

class SafeUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        mod_name = module
        if mod_name.startswith("numpy._core"):
            mod_name = mod_name.replace("numpy._core", "numpy.core")
        key = (mod_name, name)
        if key not in class_cache:
            if mod_name in ('builtins', 'collections'):
                try:
                    return super().find_class(mod_name, name)
                except Exception:
                    pass
            class MockClass(DummyModel):
                _original_module = mod_name
                _original_name = name
            MockClass.__name__ = name
            MockClass.__module__ = mod_name
            class_cache[key] = MockClass
        return class_cache[key]

with open(model_path, 'rb') as f:
    unpickler = SafeUnpickler(f)
    model = unpickler.load()

print("ALL ATTRIBUTES:")
for attr in dir(model):
    if attr.startswith('__'):
        continue
    val = getattr(model, attr)
    val_str = str(val)
    if len(val_str) > 200:
        val_str = val_str[:200] + "... [TRUNCATED]"
    print(f"  {attr}: type={type(val)}, val={val_str}")
