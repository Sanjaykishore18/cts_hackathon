import os
import sys
import pickle
import traceback

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

try:
    print(f"Reading new churn model file from: {model_path}")
    with open(model_path, 'rb') as f:
        unpickler = SafeUnpickler(f)
        model = unpickler.load()
        
    print("\n--- Successful Safe Load ---")
    print("Model Class:", f"{model._original_module}.{model._original_name}")
    print("\nInstance variables/attributes:")
    for k, v in model.__dict__.items():
        if isinstance(v, (list, tuple, dict)) and len(str(v)) > 200:
            print(f"  {k}: type={type(v)}, len={len(v)}")
        elif hasattr(v, '__dict__'):
            print(f"  {k}: type={type(v)} (class={getattr(v, '_original_module', 'unknown')}.{getattr(v, '_original_name', 'unknown')})")
        else:
            print(f"  {k}: {repr(v)}")

except Exception as e:
    traceback.print_exc()
    sys.exit(1)
