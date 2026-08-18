import os
import sys
import pickle

model_path = os.path.join(os.getcwd(), 'ml_model', 'churn', 'churn_prediction_model (1).pkl')

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
            if mod_name.startswith('numpy') or mod_name in ('builtins', 'collections'):
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
    obj = unpickler.load()

booster = obj['model']._Booster
print("Booster Type:", type(booster))
print("Booster class info:", booster._original_module, booster._original_name)
if hasattr(booster, '__dict__'):
    print("\nBooster __dict__ Keys:")
    for k, v in booster.__dict__.items():
        v_str = str(v)
        if len(v_str) > 100:
            v_str = v_str[:100] + "... [TRUNCATED]"
        print(f"  {k}: type={type(v)}, val={v_str}")
if hasattr(booster, 'handle'):
    print("\nLength of booster handle:", len(booster.handle))
    try:
        # Search for JSON config start
        start_idx = booster.handle.find(b'{')
        if start_idx != -1:
            end_idx = booster.handle.find(b'}', start_idx) + 1
            config_bytes = booster.handle[start_idx:start_idx+1000]
            print("First 1000 bytes starting with {:")
            print(config_bytes.decode('utf-8', errors='ignore'))
    except Exception as err:
        print("Error printing booster config:", err)
