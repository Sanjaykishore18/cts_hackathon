import os
import sys
import pickle
import traceback

model_path = os.path.join(os.getcwd(), 'ml_model', 'churn', 'churn_prediction_model (1).pkl')

try:
    # 1. Print environment versions
    import xgboost as xgb
    import sklearn
    import numpy as np
    import pandas as pd
    
    print("--- Environment Verification ---")
    print("Python version:", sys.version)
    print("xgboost version:", xgb.__version__)
    print("scikit-learn version:", sklearn.__version__)
    print("numpy version:", np.__version__)
    print("pandas version:", pd.__version__)
    
    # 2. Load the model
    print(f"\nLoading churn model from: {model_path} ...")
    with open(model_path, 'rb') as f:
        obj = pickle.load(f)
        
    print("\n--- Successful Load ---")
    print("Loaded object type:", type(obj))
    
    # 3. Verify key elements
    model = obj.get('model')
    print("Model type under 'model' key:", type(model))
    assert model.__class__.__name__ == 'XGBClassifier', f"Expected XGBClassifier, got {type(model)}"
    
    feature_order = obj.get('feature_order')
    print("Stored feature order (20 features):")
    print(feature_order)
    assert len(feature_order) == 20, f"Expected 20 features, got {len(feature_order)}"
    
    encoders = obj.get('encoders')
    print("\nLabelEncoder objects:")
    for k, v in encoders.items():
        print(f"  {k}: {type(v)} (classes: {list(v.classes_) if hasattr(v, 'classes_') else 'No classes_'})")
        
    print("\nVerification Complete: All assertions passed successfully.")
    
except Exception as e:
    traceback.print_exc()
    sys.exit(1)
