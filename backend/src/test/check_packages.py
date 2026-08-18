import sys

print("Python Version:", sys.version)
print("Executable:", sys.executable)

try:
    import xgboost
    print("XGBoost Version:", xgboost.__version__)
except ImportError:
    print("XGBoost: NOT INSTALLED")

try:
    import sklearn
    print("Scikit-Learn Version:", sklearn.__version__)
except ImportError:
    print("Scikit-Learn: NOT INSTALLED")

try:
    import joblib
    print("Joblib Version:", joblib.__version__)
except ImportError:
    print("Joblib: NOT INSTALLED")
