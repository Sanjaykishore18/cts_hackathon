import os
import sys
import json
import joblib
import pandas as pd
import numpy as np

# Load artifacts relative to this script's directory for absolute path safety
script_dir = os.path.dirname(os.path.abspath(__file__))
preprocessor_path = os.path.join(script_dir, 'preprocessor.joblib')
model_path = os.path.join(script_dir, 'gradientboostingregressor_model.joblib')

# Feature list in exact sequence expected by ColumnTransformer fit
FEATURE_ORDER = [
    'Age', 'Baseline_Risk', 'Enrolled_PG01', 'Enrolled_PG02', 'Enrolled_PG03', 'Enrolled_PG04', 'Enrolled_PG05', 'Enrolled_PG06',
    'Variable_Cost_Per_Patient_30d', 'Copay_Max_Per_Patient_30d', 'Num_Claims_30d', 'Num_Refills_30d', 'Average_Days_Supply_30d',
    'Total_Patient_Paid_30d', 'Average_Patient_Paid_30d', 'Average_Refill_Gap_30d', 'Maximum_Refill_Gap_30d', 'Copay_Claims_Count_30d',
    'Total_Copay_Used_30d', 'Total_Copay_Savings_30d', 'Fund_Exhausted_Any_30d', 'Copay_Utilization_Rate_30d', 'Num_Interactions_30d',
    'Num_Financial_Assistance_Interactions_30d', 'Num_Adherence_Counseling_Interactions_30d', 'Follow_Up_Rate_30d', 'Resolution_Rate_30d',
    'No_Response_Rate_30d', 'Escalation_Rate_30d', 'Gender', 'Age_Group', 'Region', 'State', 'City_Market',
    'Insurance_Type', 'Insurance_Plan', 'Disease_Condition', 'Income_Band', 'Financial_Assistance_Eligible',
    'Employment_Status', 'Segment_Name', 'Primary_Enrollment_Channel', 'Primary_Enrollment_Reason'
]

def main():
    try:
        # 1. Read input from stdin
        input_data = sys.stdin.read()
        if not input_data:
            raise ValueError("Empty input received on stdin")
            
        payload = json.loads(input_data)
        
        # 2. Check for missing model artifacts
        if not os.path.exists(preprocessor_path):
            raise FileNotFoundError(f"Preprocessor not found at: {preprocessor_path}")
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model not found at: {model_path}")
            
        # 3. Load ML artifacts
        preprocessor = joblib.load(preprocessor_path)
        model = joblib.load(model_path)
        
        # 4. Construct DataFrame matching the exact feature order
        ordered_data = {feat: [payload[feat]] for feat in FEATURE_ORDER}
        df = pd.DataFrame(ordered_data)
        
        # 5. Transform data
        X_transformed = preprocessor.transform(df)
        
        # 6. Verify feature count is exactly 241
        if X_transformed.shape[1] != 241:
            raise ValueError(f"Feature mismatch: Preprocessing returned {X_transformed.shape[1]} features, but model expects 241.")
            
        # 7. Predict
        predictions = model.predict(X_transformed)
        predicted_pdc = float(predictions[0])
        
        # 8. Output as JSON
        output = {"predicted_pdc": predicted_pdc}
        sys.stdout.write(json.dumps(output))
        sys.stdout.flush()
        
    except Exception as e:
        error_info = {
            "error": str(e),
            "type": e.__class__.__name__
        }
        sys.stderr.write(json.dumps(error_info))
        sys.stderr.flush()
        sys.exit(1)

if __name__ == '__main__':
    main()
