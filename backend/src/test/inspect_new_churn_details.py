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

print("CATEGORICAL COLS:")
print(obj['categorical_cols'])
print("\nNUMERIC COLS:")
print(obj['numeric_cols'])
print("\nFEATURE ORDER:")
print(obj['feature_order'])
print("\nNumber of features:", len(obj['feature_order']))

print("\nENCODERS:")
for k, v in obj['encoders'].items():
    print(f"  {k}: class={v._original_module}.{v._original_name}")
    # Print the attributes of the encoder
    for attr, val in v.__dict__.items():
        if 'classes_' in attr or 'categories_' in attr:
            print(f"    {attr}: {repr(val)}")
