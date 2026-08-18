import os
import sys
import pickle
import pandas as pd
import numpy as np
import traceback

model_path = os.path.join(os.getcwd(), 'ml_model', 'churn', 'churn_prediction_model (1).pkl')

# Construct realistic features using classes found in model's LabelEncoder objects
test_patient = {
    'Gender': 'Female',
    'Region': 'Midwest',
    'Insurance_Type': 'Commercial',
    'Disease_Condition': 'Acne Vulgaris',
    'Enrollment_Channel': 'Call Center',
    'Enrollment_Reason': 'Affordability Barrier',
    'Age': 54,
    'Baseline_Risk': 0.72,
    'num_programs_enrolled': 2,
    'num_enrollments': 3,
    'num_withdrawn': 1,
    'total_interactions': 12,
    'pct_follow_up_required': 0.58,
    'pct_resolved': 0.75,
    'pct_no_response': 0.08,
    'pct_escalated': 0.05,
    'num_financial_assist_interactions': 4,
    'num_adherence_counseling': 2,
    'num_programs_eligible': 3,
    'pct_enrollment_eligible': 0.67
}

try:
    print(f"Loading churn model dictionary from: {model_path}")
    with open(model_path, 'rb') as f:
        obj = pickle.load(f)
        
    model = obj['model']
    encoders = obj['encoders']
    feature_order = obj['feature_order']
    categorical_cols = obj['categorical_cols']
    
    # 1. Transform categorical variables using their respective LabelEncoders
    processed_patient = test_patient.copy()
    for col in categorical_cols:
        val = test_patient[col]
        encoder = encoders[col]
        
        # LabelEncoder.transform expects a sequence
        encoded_val = encoder.transform([val])[0]
        processed_patient[col] = encoded_val
        print(f"Encoded '{col}': {val} -> {encoded_val}")
        
    # 2. Build input DataFrame ordered exactly by feature_order
    df_input = pd.DataFrame([processed_patient])
    df_input = df_input[feature_order]
    
    print("\nPreprocessed Ordered Row:")
    print(df_input)
    
    # 3. Perform inference
    proba = model.predict_proba(df_input)[0]
    pred = model.predict(df_input)[0]
    
    print("\n--- Inference Results ---")
    print(f"Probability Class 0 (Active): {proba[0]}")
    print(f"Probability Class 1 (Churned): {proba[1]}")
    print(f"Predicted Class ID: {pred}")
    
    # Map predictions to business fields
    churn_probability = float(proba[1])
    churn_prediction = "Churned" if churn_probability >= 0.5 else "Active"
    
    print(f"churnProbability: {churn_probability}")
    print(f"churnPrediction: {churn_prediction}")
    
    # Verify bounds
    assert np.isfinite(churn_probability), "Probability is not finite"
    assert 0.0 <= churn_probability <= 1.0, "Probability out of [0, 1] bounds"
    assert pred in (0, 1), "Prediction is not 0 or 1"
    print("\nVerification checks passed successfully.")
    
except Exception as e:
    traceback.print_exc()
    sys.exit(1)
