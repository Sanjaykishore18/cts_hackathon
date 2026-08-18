import os
import sys

# Force pure-Python pickle
if '_pickle' in sys.modules:
    del sys.modules['_pickle']
if 'pickle' in sys.modules:
    del sys.modules['pickle']
sys.modules['_pickle'] = None

import pickle
import traceback
from types import ModuleType
import numpy as np

# Map numpy._core to numpy.core for numpy 1.x compatibility
import numpy.core
sys.modules['numpy._core'] = numpy.core
import numpy.core.multiarray
sys.modules['numpy._core.multiarray'] = numpy.core.multiarray
import numpy.core.numeric
sys.modules['numpy._core.numeric'] = numpy.core.numeric

# We mock the modules that the unpickler will look for
class MockModule(ModuleType):
    def __init__(self, name):
        super().__init__(name)
    def __getattr__(self, name):
        fullname = f"{self.__name__}.{name}"
        class MockClass:
            def __init__(self, *args, **kwargs):
                pass
            def __setstate__(self, state):
                if isinstance(state, dict):
                    self.__dict__.update(state)
                else:
                    self._state = state
        MockClass.__name__ = name
        MockClass.__module__ = self.__name__
        return MockClass

# Setup mock modules in sys.modules
mock_names = [
    'joblib', 'joblib.numpy_pickle',
    'sklearn', 'sklearn.compose', 'sklearn.compose._column_transformer',
    'sklearn.pipeline', 'sklearn.impute', 'sklearn.impute._base',
    'sklearn.preprocessing', 'sklearn.preprocessing._data', 'sklearn.preprocessing._encoders',
    'sklearn.ensemble', 'sklearn.ensemble._gb', 'sklearn._loss', 'sklearn._loss.loss',
    'sklearn._loss.link', 'sklearn.tree', 'sklearn.tree._classes', 'sklearn.dummy'
]

for name in mock_names:
    sys.modules[name] = MockModule(name)

# Specifically mock joblib's NumpyArrayWrapper
class NumpyArrayWrapper:
    def __init__(self, *args, **kwargs):
        pass
    def __setstate__(self, state):
        self.__dict__.update(state)
    def read(self, unpickler):
        return np.array([])

sys.modules['joblib.numpy_pickle'].NumpyArrayWrapper = NumpyArrayWrapper

class SafeUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        print(f"  [find_class] Loading: {module}.{name}", flush=True)
        mod_name = module
        if mod_name.startswith("numpy._core"):
            mod_name = mod_name.replace("numpy._core", "numpy.core")
        try:
            return super().find_class(mod_name, name)
        except Exception as e:
            print(f"    Fallback to mock for: {mod_name}.{name}", flush=True)
            class MockClass:
                def __init__(self, *args, **kwargs):
                    pass
                def __setstate__(self, state):
                    if isinstance(state, dict):
                        self.__dict__.update(state)
                    else:
                        self._state = state
            MockClass.__name__ = name
            MockClass.__module__ = mod_name
            return MockClass

    def load_stack_global(self, self_ref=None):
        print("  [STACK_GLOBAL] Stack top:", [type(x) for x in self.stack[-5:]], "Values:", self.stack[-5:], flush=True)
        name = self.stack.pop()
        module = self.stack.pop()
        if type(name) is not str or type(module) is not str:
            raise pickle.UnpicklingError("STACK_GLOBAL requires str")
        self.append(self.find_class(module, name))

dir_path = os.path.join(os.getcwd(), 'ml_model', 'strategy')
preprocessor_path = os.path.join(dir_path, 'preprocessor.joblib')
model_path = os.path.join(dir_path, 'gradientboostingregressor_model.joblib')

try:
    print("Loading preprocessor...")
    with open(preprocessor_path, 'rb') as f:
        unpickler = SafeUnpickler(f)
        unpickler.dispatch[93] = unpickler.load_stack_global
        preprocessor = unpickler.load()
    print("Preprocessor loaded successfully!")
    print("Type:", type(preprocessor))
except Exception as e:
    traceback.print_exc()
    sys.exit(1)
