import os
import sys
import pickle
import traceback

dir_path = os.path.join(os.getcwd(), 'ml_model', 'strategy')
preprocessor_path = os.path.join(dir_path, 'preprocessor.joblib')
model_path = os.path.join(dir_path, 'gradientboostingregressor_model.joblib')

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
        print(f"  [find_class] Loading: {module}.{name}", flush=True)
        mod_name = module
        if mod_name.startswith("numpy._core"):
            mod_name = mod_name.replace("numpy._core", "numpy.core")
        key = (mod_name, name)
        if key not in class_cache:
            if mod_name.startswith('numpy') or mod_name in ('builtins', 'collections'):
                try:
                    return super().find_class(mod_name, name)
                except Exception as e:
                    print(f"    Failed loading real: {e}", flush=True)
            class MockClass(DummyModel):
                _original_module = mod_name
                _original_name = name
            MockClass.__name__ = name
            MockClass.__module__ = mod_name
            class_cache[key] = MockClass
        return class_cache[key]

def inspect_file(filepath, name):
    print(f"\n==========================================")
    print(f"Inspecting {name}: {filepath}")
    print(f"==========================================")
    try:
        with open(filepath, 'rb') as f:
            unpickler = SafeUnpickler(f)
            obj = unpickler.load()
        print("Class Type:", f"{obj._original_module}.{obj._original_name}")
        return obj
    except Exception as e:
        traceback.print_exc()
        sys.exit(1)

preprocessor = inspect_file(preprocessor_path, "Preprocessor")
