import os
import sys
import joblib

seg_dir = os.path.join('ml_model', 'segmentation')
kmeans_path = os.path.join(seg_dir, 'kmeans_model.joblib')
preprocessor_path = os.path.join(seg_dir, 'preprocessor.joblib')

try:
    print("Loading segmentation artifacts...")
    kmeans = joblib.load(kmeans_path)
    preprocessor = joblib.load(preprocessor_path)
    
    print("\n--- KMeans Model Info ---")
    print("Class Type:", type(kmeans))
    print("Attributes in dict:")
    for k in ('n_clusters', 'init', 'n_init', 'max_iter', 'random_state', 'n_features_in_'):
        print(f"  {k}: {getattr(kmeans, k, None)}")
        
    print("\n--- Preprocessor Info ---")
    print("Class Type:", type(preprocessor))
    if hasattr(preprocessor, 'transformers'):
        print("Transformers:")
        for t in preprocessor.transformers:
            print("  Transformer:", t)
    print("Feature Names In:")
    print(list(getattr(preprocessor, 'feature_names_in_', [])))
    print("Number of expected raw features:", len(getattr(preprocessor, 'feature_names_in_', [])))

except Exception as e:
    import traceback
    traceback.print_exc()
    sys.exit(1)
