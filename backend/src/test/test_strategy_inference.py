import os
import sys
import joblib
import pandas as pd
import numpy as np

preprocessor_path = os.path.join('ml_model', 'strategy', 'preprocessor.joblib')
model_path = os.path.join('ml_model', 'strategy', 'gradientboostingregressor_model.joblib')

try:
    print("Loading preprocessor and model...")
    prep = joblib.load(preprocessor_path)
    model = joblib.load(model_path)
    print("Artifacts loaded successfully.\n")
    
    # Extract categories from OneHotEncoder for reference
    ohe = prep.named_transformers_['cat'].named_steps['onehot']
    cat_features = prep.transformers[1][2]
    print("Discovered Categorical Features & Categories:")
    for col, cats in zip(cat_features, ohe.categories_):
        print(f"  {col}: {list(cats)[:10]} (total: {len(cats)})")
        
    # Construct a single test sample with valid categories
    # using the first class found in OHE categories to prevent out-of-vocabulary defaults
    raw_sample = {
        # Numerical Features (29)
        'Age': 45.0,
        'Baseline_Risk': 0.35,
        'Enrolled_PG01': 1.0,
        'Enrolled_PG02': 0.0,
        'Enrolled_PG03': 0.0,
        'Enrolled_PG04': 0.0,
        'Enrolled_PG05': 0.0,
        'Enrolled_PG06': 0.0,
        'Variable_Cost_Per_Patient_30d': 150.0,
        'Copay_Max_Per_Patient_30d': 100.0,
        'Num_Claims_30d': 3.0,
        'Num_Refills_30d': 2.0,
        'Average_Days_Supply_30d': 30.0,
        'Total_Patient_Paid_30d': 60.0,
        'Average_Patient_Paid_30d': 30.0,
        'Average_Refill_Gap_30d': 1.5,
        'Maximum_Refill_Gap_30d': 4.0,
        'Copay_Claims_Count_30d': 2.0,
        'Total_Copay_Used_30d': 200.0,
        'Total_Copay_Savings_30d': 180.0,
        'Fund_Exhausted_Any_30d': 0.0,
        'Copay_Utilization_Rate_30d': 0.5,
        'Num_Interactions_30d': 4.0,
        'Num_Financial_Assistance_Interactions_30d': 2.0,
        'Num_Adherence_Counseling_Interactions_30d': 1.0,
        'Follow_Up_Rate_30d': 0.75,
        'Resolution_Rate_30d': 0.8,
        'No_Response_Rate_30d': 0.15,
        'Escalation_Rate_30d': 0.05,
        
        # Categorical Features (14) - selecting valid categories from encoder
        'Gender': ohe.categories_[0][0],
        'Age_Group': ohe.categories_[1][0],
        'Region': ohe.categories_[2][0],
        'State': ohe.categories_[3][0],
        'City_Market': ohe.categories_[4][0],
        'Insurance_Type': ohe.categories_[5][0],
        'Insurance_Plan': ohe.categories_[6][0],
        'Disease_Condition': ohe.categories_[7][0],
        'Income_Band': ohe.categories_[8][0],
        'Financial_Assistance_Eligible': ohe.categories_[9][0],
        'Employment_Status': ohe.categories_[10][0],
        'Segment_Name': ohe.categories_[11][0],
        'Primary_Enrollment_Channel': ohe.categories_[12][0],
        'Primary_Enrollment_Reason': ohe.categories_[13][0],
    }
    
    # Convert to DataFrame
    df = pd.DataFrame([raw_sample])
    raw_feature_count = df.shape[1]
    
    # Run through preprocessing
    X_transformed = prep.transform(df)
    transformed_feature_count = X_transformed.shape[1]
    
    # Predict
    prediction = model.predict(X_transformed)
    predicted_pdc = float(prediction[0])
    
    # Print results
    print("\n--- Inference Verification Results ---")
    print(f"Raw Input Feature Count: {raw_feature_count}")
    print(f"Transformed Feature Count: {transformed_feature_count}")
    print(f"Predicted PDC: {predicted_pdc}")
    print(f"Prediction Type: {type(predicted_pdc)}")
    
    is_finite = np.isfinite(predicted_pdc)
    print(f"Is Prediction Finite?: {is_finite}")
    
    falls_in_range = 0.0 <= predicted_pdc <= 1.0
    print(f"Does Prediction Fall in [0, 1]?: {falls_in_range}")

except Exception as e:
    import traceback
    traceback.print_exc()
    sys.exit(1)
