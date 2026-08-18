import os
import sys
import pickle
import traceback

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
        # Handle some renaming from numpy/numpy._core if necessary
        # (e.g. numpy._core was introduced in numpy 2.0, but some environments use numpy.core)
        mod_name = module
        if mod_name.startswith("numpy._core"):
            mod_name = mod_name.replace("numpy._core", "numpy.core")
            
        key = (mod_name, name)
        if key not in class_cache:
            # Let builtins and standard numpy/collections load naturally if possible
            if mod_name in ('builtins', 'collections'):
                try:
                    return super().find_class(mod_name, name)
                except Exception:
                    pass
            # Create a mock class
            class MockClass(DummyModel):
                _original_module = mod_name
                _original_name = name
            MockClass.__name__ = name
            MockClass.__module__ = mod_name
            class_cache[key] = MockClass
        return class_cache[key]

try:
    print(f"Reading model file from: {model_path}")
    with open(model_path, 'rb') as f:
        unpickler = SafeUnpickler(f)
        model = unpickler.load()
        
    print("\n--- Successful Safe Load ---")
    print("Model instance type:", type(model))
    print(f"Original Class: {model._original_module}.{model._original_name}")
    print("\nInstance variables/attributes:")
    for k, v in model.__dict__.items():
        if isinstance(v, (list, tuple, dict)) and len(str(v)) > 200:
            print(f"  {k}: type={type(v)}, len={len(v)}")
        elif hasattr(v, '__dict__'):
            print(f"  {k}: type={type(v)} (class={getattr(v, '_original_module', 'unknown')}.{getattr(v, '_original_name', 'unknown')})")
        else:
            print(f"  {k}: {repr(v)}")
            
    # Check if we have standard feature names attributes
    for attr in ('feature_names_in_', 'feature_names', 'feature_order', 'feature_importances_', 'estimators_'):
        if hasattr(model, attr):
            print(f"\nFound Attribute '{attr}':")
            val = getattr(model, attr)
            if isinstance(val, (list, tuple, dict, str)) or 'numpy' in str(type(val)):
                print(val)
            else:
                print(f"Type: {type(val)}, len={len(val) if hasattr(val, '__len__') else 'N/A'}")

except Exception as e:
    traceback.print_exc()
    sys.exit(1)
