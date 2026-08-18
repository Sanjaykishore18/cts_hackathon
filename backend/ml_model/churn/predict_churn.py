import os
import sys
import json
import pickle
import pandas as pd
import numpy as np

# Map Express camelCase fields to model features
KEY_MAP = {
    'age': 'Age',
    'gender': 'Gender',
    'region': 'Region',
    'insuranceType': 'Insurance_Type',
    'diseaseCondition': 'Disease_Condition',
    'baselineRisk': 'Baseline_Risk',
    'numProgramsEnrolled': 'num_programs_enrolled',
    'numEnrollments': 'num_enrollments',
    'numWithdrawn': 'num_withdrawn',
    'enrollmentChannel': 'Enrollment_Channel',
    'enrollmentReason': 'Enrollment_Reason',
    'totalInteractions': 'total_interactions',
    'pctFollowUpRequired': 'pct_follow_up_required',
    'pctResolved': 'pct_resolved',
    'pctNoResponse': 'pct_no_response',
    'pctEscalated': 'pct_escalated',
    'numFinancialAssistInteractions': 'num_financial_assist_interactions',
    'numAdherenceCounseling': 'num_adherence_counseling',
    'numProgramsEligible': 'num_programs_eligible',
    'pctEnrollmentEligible': 'pct_enrollment_eligible'
}

def main():
    try:
        # 1. Read input from stdin
        input_data = sys.stdin.read().strip()
        if not input_data:
            print(json.dumps({"error": "Empty input"}), file=sys.stderr)
            sys.exit(1)
            
        patient_record = json.loads(input_data)
        
        # 2. Resolve model directory and paths
        model_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(model_dir, 'churn_prediction_model (1).pkl')
        
        if not os.path.exists(model_path):
            print(json.dumps({"error": f"Model artifact not found at {model_path}"}), file=sys.stderr)
            sys.exit(1)
            
        # 3. Load model dictionary
        with open(model_path, 'rb') as f:
            obj = pickle.load(f)
            
        model = obj['model']
        encoders = obj['encoders']
        feature_order = obj['feature_order']
        categorical_cols = obj['categorical_cols']
        
        # 4. Map keys from API schema to model schema
        mapped_patient = {}
        for api_key, model_key in KEY_MAP.items():
            if api_key in patient_record:
                mapped_patient[model_key] = patient_record[api_key]
                
        # 5. Preprocess categorical values
        for col in categorical_cols:
            val = mapped_patient.get(col)
            encoder = encoders[col]
            
            # Safe transformation check: if value is null or not in classes, use fallback/nan
            if val is None or val != val:  # check for None or NaN
                # Fallback to the first class or NaN representation if classes have it
                classes_list = list(encoder.classes_)
                if np.nan in classes_list or 'nan' in classes_list or None in classes_list:
                    # find the label for nan
                    for label, cl in enumerate(classes_list):
                        if cl != cl or cl in ('nan', None):
                            mapped_patient[col] = label
                            break
                else:
                    mapped_patient[col] = 0
            else:
                try:
                    mapped_patient[col] = encoder.transform([val])[0]
                except ValueError:
                    # In case of unknown class value, default to 0 to prevent crashes
                    mapped_patient[col] = 0
                    
        # 6. Create Pandas DataFrame ordered by feature_order
        df_input = pd.DataFrame([mapped_patient])
        df_input = df_input[feature_order]
        
        # 7. Model predict
        proba = model.predict_proba(df_input)[0]
        
        churn_probability = float(proba[1])
        churn_prediction = "Churned" if churn_probability >= 0.5 else "Active"
        
        # 8. Print response to stdout
        response = {
            "churnProbability": churn_probability,
            "churnPrediction": churn_prediction
        }
        print(json.dumps(response))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
