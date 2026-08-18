import os
import sys
import pandas as pd
import numpy as np
import joblib

# Segment mapping definitions
SEGMENT_MAP = {
    0: "Sub-adherent / High Follow-Up Needs",
    1: "Commercially Insured / Copay Dependent",
    2: "Government Insured / Stable Adherent",
    3: "Unengaged / High Clinical Risk"
}

class PatientSegmentPredictor:
    """
    Predictor class to handle loading pipeline models and running real-time or batch inference.
    """
    def __init__(self, models_dir=None):
        if models_dir is None:
            # Default to the directory of this script itself
            models_dir = os.path.dirname(os.path.abspath(__file__))
            
        self.preprocessor_path = os.path.join(models_dir, "preprocessor.joblib")
        self.kmeans_path = os.path.join(models_dir, "kmeans_model.joblib")
        
        # Load fitted preprocessor and trained K-Means model
        if not os.path.exists(self.preprocessor_path):
            raise FileNotFoundError(f"Fitted preprocessor not found at {self.preprocessor_path}.")
        if not os.path.exists(self.kmeans_path):
            raise FileNotFoundError(f"Trained K-Means model not found at {self.kmeans_path}.")
            
        self.preprocessor = joblib.load(self.preprocessor_path)
        self.kmeans = joblib.load(self.kmeans_path)

    def predict(self, patient_data):
        """
        Predicts the segment for patient input.
        """
        # Convert input format to DataFrame
        if isinstance(patient_data, dict):
            df_input = pd.DataFrame([patient_data])
            is_single = True
        elif isinstance(patient_data, list):
            df_input = pd.DataFrame(patient_data)
            is_single = False
        elif isinstance(patient_data, pd.DataFrame):
            df_input = patient_data.copy()
            is_single = False
        else:
            raise TypeError("Input must be a dictionary, list of dictionaries, or a pandas DataFrame.")
            
        # Ensure all columns required by the preprocessor are present
        required_cols = list(self.preprocessor.feature_names_in_)
        for col in required_cols:
            if col not in df_input.columns:
                df_input[col] = np.nan
                
        # Select and order columns as expected by the preprocessor
        df_input_ordered = df_input[required_cols]
        
        # Run preprocessing
        X_processed = self.preprocessor.transform(df_input_ordered)
        
        # Predict clusters
        cluster_ids = self.kmeans.predict(X_processed)
        
        # Build predictions list
        results = []
        for idx, cid in enumerate(cluster_ids):
            patient_id = df_input.iloc[idx].get('Patient_ID', 'Unknown')
            results.append({
                "patient_id": str(patient_id),
                "cluster_id": int(cid),
                "segment_name": SEGMENT_MAP[int(cid)]
            })
            
        return results[0] if is_single else results

def predict_patient_segment(patient_data):
    """
    Clean, reusable function for backend integration.
    """
    # Instantiate predictor targeting the script's local directory by default
    predictor = PatientSegmentPredictor()
    return predictor.predict(patient_data)

if __name__ == "__main__":
    import argparse
    import json
    
    parser = argparse.ArgumentParser(description="Run Patient Segmentation Inference.")
    parser.add_argument("--input", type=str, required=True, help="Path to input JSON file.")
    args = parser.parse_args()
    
    if args.input:
        if not os.path.exists(args.input):
            print(f"Error: Input file '{args.input}' not found.")
            sys.exit(1)
            
        with open(args.input, "r") as f:
            input_data = json.load(f)
            
        predictor = PatientSegmentPredictor()
        result = predictor.predict(input_data)
        print(json.dumps(result, indent=4))
