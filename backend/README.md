# Copay / Patient Support Program Analytics Backend

This repository represents the backend service for the **Copay / Patient Support Program Analytics** system. It aggregates and exposes patient engagement (CRM), business outcome metrics (sales), and predictive AI layers under clean, modular REST endpoints.

---

## Backend Architecture

The application is structured using a clean, scalable Layered Architecture:

```text
backend/
├── src/
│   ├── config/           # App configuration (e.g., db.js connection pool)
│   ├── controllers/      # Request & Response processing layer
│   ├── database/         # SQL DDL schemas and synthetic data seed scripts
│   ├── middleware/       # Express middlewares (errorHandler.js, validator.js)
│   ├── routes/           # Routing layer mapping HTTP methods to controllers
│   ├── services/         # Business logic & SQL query execution layer
│   ├── app.js            # Express app configuration
│   └── server.js         # Entry server listener
├── .env                  # Local environment parameters (git-ignored)
├── .env.example          # Environment variables template
└── package.json          # Node project dependencies & execution scripts
```

---

## Database Schema (PostgreSQL)

### 1. `patient_program`
Tracks individual patient enrollment, insurance, adherence rates, and persistency duration.
- Key: `(patient_id, program_id)`
- Fields: `patient_id`, `program_id`, `program_type`, `insurance_type`, `enrollment_date`, `enrollment_status`, `enrollment_channel`, `copay_coverage_amount`, `annual_benefit_cap`, `benefit_utilized_amount`, `number_of_fills_with_assistance`, `adherence_rate`, `persistency_days`, `dropout_reason`.

### 2. `program_business`
Aggregates sales metrics, program cost, and ROI by region and quarter.
- Key: `(program_id, region, time_period)`
- Fields: `program_id`, `region`, `time_period`, `enrolled_patient_count`, `program_cost`, `revenue_generated`, `roi` (ROI ratio), `retention_rate`, `churn_rate`, `net_new_patients`, `payer_mix` (JSONB).

### 3. `patient_recommendations`
Stores predictive model classifications like adherence risks and program matching suggestions.
- Key: `(patient_id)`
- Fields: `patient_id`, `patient_demographics` (JSONB), `disease_therapy_area`, `current_program_type`, `predicted_adherence_risk`, `predicted_churn_risk`, `recommended_program_type`, `recommended_discount_tier`, `predicted_roi_contribution`, `model_confidence_score`.

---

## Setup & Running Instructions

### 1. Configure Prerequisites
Make sure **Node.js** (v16+) and **PostgreSQL** are installed and running on your system.

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the root of the `backend` folder:
```bash
cp .env.example .env
```
Edit the `.env` file to supply your PostgreSQL database credentials:
```ini
PORT=5000
NODE_ENV=development

DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=copay_psp_analytics
```

### 3. Install Dependencies
Run the package installation command:
```bash
npm install
```

### 4. Database Setup & Seeding (Synthetic Data)
To run the database setup (creating tables) and insert synthetic demo data, execute:
```bash
node src/database/seed.js
```
*Note: This deletes any existing `patient_program`, `program_business`, or `patient_recommendations` tables in the configured database and rebuilds them.*

### 5. Running the Server
Start the development server with hot-reloading (via nodemon):
```bash
npm run dev
```
Or start the server normally:
```bash
npm start
```

---

## API Endpoints List

### 1. Health Endpoint
- **GET** `/api/health` -> Confirms server status.

### 2. Patient / CRM APIs
- **GET** `/api/patients` -> List all patients (supports query filters: `programId`, `programType`, `insuranceType`, `enrollmentStatus`).
- **GET** `/api/patients/:patientId` -> Get patient profile, including demographic data and AI recommendation details.
- **GET** `/api/patients/:patientId/programs` -> List program history for a patient.
- **GET** `/api/programs/:programId/patients` -> List all patients enrolled in a specific program.

### 3. Business / Sales APIs
- **GET** `/api/business/overview` -> General overview of total cost, total revenue, ROI, retention rate, and churn rate.
- **GET** `/api/business/programs` -> Aggregated business metrics for all programs.
- **GET** `/api/business/programs/:programId` -> Financial breakdown for a specific program.
- **GET** `/api/business/regions` -> Business statistics grouped by regions.
- **GET** `/api/business/trends` -> Performance trends tracked across quarters.

### 4. Analytics APIs
- **GET** `/api/analytics/adherence` -> Grouped average, minimum, and maximum adherence rates.
- **GET** `/api/analytics/persistence` -> Duration metrics (average days on therapy).
- **GET** `/api/analytics/cohort-comparison` -> Metrics comparison between Enrolled, Dropped, and Non-Enrolled cohorts.
- **GET** `/api/analytics/utilization` -> Copay caps and benefit utilization rates.
- **GET** `/api/analytics/roi` -> Detailed ROI calculations for each program.
- **GET** `/api/analytics/program-effectiveness` -> Comparative metrics on program churn and adherence.

---

## Metric Formulas Used

### ROI Calculation
- **ROI ratio** = `(Revenue - Program Cost) / Program Cost`
- **ROI percentage** = `ROI ratio * 100`
- *Note: Division by zero is caught and resolved to `0.00`.*

### Utilization Rate Calculation
- **Utilization Rate (%)** = `(Total Benefit Utilized / Total Benefit Cap) * 100`

---

## Example REST Requests & Responses

### 1. Get Cohort Comparison
`GET http://localhost:5000/api/analytics/cohort-comparison`

**Response:**
```json
{
  "success": true,
  "data": {
    "metricDescription": "Compares adherence, persistence, and utilization metrics between Enrolled, Non-Enrolled, and Dropped cohorts.",
    "cohorts": [
      {
        "cohort": "Enrolled",
        "patientCount": 7,
        "averageAdherenceRate": 88.58,
        "averagePersistencyDays": 161.4,
        "averageFills": 4.6,
        "averageBenefitUtilized": 4214.29
      },
      {
        "cohort": "Dropped",
        "patientCount": 3,
        "averageAdherenceRate": 45,
        "averagePersistencyDays": 51.7,
        "averageFills": 2,
        "averageBenefitUtilized": 1833.33
      },
      {
        "cohort": "Non-Enrolled",
        "patientCount": 2,
        "averageAdherenceRate": 0,
        "averagePersistencyDays": 0,
        "averageFills": 0,
        "averageBenefitUtilized": 0
      }
    ]
  }
}
```

### 2. Error Response (404 Not Found)
`GET http://localhost:5000/api/patients/PAT-999`

**Response:**
```json
{
  "success": false,
  "error": {
    "message": "Patient with ID PAT-999 not found",
    "code": "PATIENT_NOT_FOUND"
  }
}
```

---

## Phase 3: ML Churn Prediction API Integration

### 1. Overview & Purpose
The Churn Prediction model is an XGBoost binary classification model developed to predict whether a patient is likely to drop out or churn from treatment. 

> [!IMPORTANT]
> **Churn Prediction vs. Program Recommendation:**
> - The Churn Prediction model predicts patient status (`Active` or `Churned`) along with a churn probability based on historical engagement and enrollment features.
> - The model itself does **not** make recommendations. Program recommendations are handled separately by a different rule/predictive layer in the database `patient_recommendations` table.

### 2. Integration Architecture
The API uses a layered structure to decouple Express controllers and routes from the ML execution platform:

```text
Route (POST /api/ml/churn-prediction)
  ↓
Validation (src/middleware/mlValidator.js)
  ↓
Controller (src/controllers/ml.controller.js)
  ↓
ML Service (src/services/ml.service.js)
  ↓
ML Provider/Adapter (mock/http providers)
  ↓
XGBoost Model Service
```

### 3. Model Input Features (Exactly 20)
All 20 features must be supplied in every prediction request:
1. `age` (numeric positive value)
2. `gender` (non-empty string)
3. `region` (non-empty string)
4. `insuranceType` (non-empty string)
5. `diseaseCondition` (non-empty string)
6. `baselineRisk` (number between 0 and 1)
7. `numProgramsEnrolled` (non-negative integer)
8. `numEnrollments` (non-negative integer)
9. `numWithdrawn` (non-negative integer)
10. `enrollmentChannel` (non-empty string)
11. `enrollmentReason` (non-empty string)
12. `totalInteractions` (non-negative integer)
13. `pctFollowUpRequired` (number between 0 and 1)
14. `pctResolved` (number between 0 and 1)
15. `pctNoResponse` (number between 0 and 1)
16. `pctEscalated` (number between 0 and 1)
17. `numFinancialAssistInteractions` (non-negative integer)
18. `numAdherenceCounseling` (non-negative integer)
19. `numProgramsEligible` (non-negative integer)
20. `pctEnrollmentEligible` (number between 0 and 1)

### 4. API Endpoints

#### POST `/api/ml/churn-prediction`
Predicts churn status based on the patient's feature data.

**Request Header:**
- `Content-Type: application/json`

**Example Request Payload:**
```json
{
  "age": 54,
  "gender": "Female",
  "region": "South",
  "insuranceType": "Commercial",
  "diseaseCondition": "Condition_A",
  "baselineRisk": 0.72,
  "numProgramsEnrolled": 2,
  "numEnrollments": 3,
  "numWithdrawn": 1,
  "enrollmentChannel": "Call Center",
  "enrollmentReason": "Affordability Barrier",
  "totalInteractions": 12,
  "pctFollowUpRequired": 0.58,
  "pctResolved": 0.75,
  "pctNoResponse": 0.08,
  "pctEscalated": 0.05,
  "numFinancialAssistInteractions": 4,
  "numAdherenceCounseling": 2,
  "numProgramsEligible": 3,
  "pctEnrollmentEligible": 0.67
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "churnProbability": 0.72,
    "churnPrediction": "Churned"
  }
}
```

**Validation Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "message": "Invalid churn prediction input",
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "field": "age",
        "message": "Age must be a positive number representing a reasonable age (1-120)"
      }
    ]
  }
}
```

**ML Service Error Response (503 Service Unavailable):**
```json
{
  "success": false,
  "error": {
    "message": "ML prediction service unavailable",
    "code": "ML_SERVICE_UNAVAILABLE"
  }
}
```

### 5. Environment & Provider Configuration

Configure the ML provider layer in the `.env` file using these parameters:
```ini
# ML Provider mode: 'mock' (default) or 'http'
ML_PROVIDER=mock

# Endpoint URL of the actual XGBoost model deployment (required when ML_PROVIDER=http)
ML_SERVICE_URL=http://your-xgboost-model-service.internal/predict
```

#### Development Mock Provider
- In development, setting `ML_PROVIDER=mock` activates the local mock provider class (`src/services/mlProviders/mock.provider.js`).
- The mock provider uses the input `baselineRisk` as the output `churnProbability` to return deterministic predictions for API testing without calling external networks.
- A prediction of `churnProbability >= 0.5` yields `"Churned"`, and `< 0.5` yields `"Active"`.

#### Replacing the Mock Provider with the Actual Service
To connect to the real XGBoost model service once deployed:
1. Update `.env` with:
   ```ini
   ML_PROVIDER=http
   ML_SERVICE_URL=https://your-deployed-xgboost-service/predict
   ```
2. The system will automatically routing future churn requests to the `HttpProvider` module using modern native `fetch` client requests.

---

## Phase 4: Patient Segmentation ML API Integration

### 1. Overview & Purpose
The Patient Segmentation API integrates the K-Means clustering model to group patients based on demography, program enrollment history, support interactions, therapy refill gaps, and treatment adherence behaviors.

> [!IMPORTANT]
> **Segmentation vs. Churn Prediction:**
> - **Segmentation (Unsupervised K-Means)**: Groups patients into descriptive cohorts. It answers: *"What type of patient profile does this patient belong to?"*
> - **Churn Prediction (Supervised XGBoost)**: Binary classification. It answers: *"Is this patient likely to drop out of treatment?"*
> - Cluster assignments are descriptive and represent demographic/clinical trends. They do **not** serve as causal evidence that a patient will respond to specific intervention strategies.

### 2. The Four Clusters/Segments
The model groups patients into exactly one of four clusters ($K=4$), interpreted as follows:
- **Cluster 0**: *Sub-adherent / High Follow-Up Needs*
- **Cluster 1**: *Commercially Insured / Copay Dependent*
- **Cluster 2**: *Government Insured / Stable Adherent*
- **Cluster 3**: *Unengaged / High Clinical Risk*

### 3. Integration Architecture
Express integrates with the Python ML model through a decoupled subprocess bridge:

```text
React Frontend
       ↓
POST /api/ml/patient-segmentation
       ↓
Route (src/routes/ml.routes.js)
       ↓
Validation (src/middleware/segmentationValidator.js)
       ↓
Controller (src/controllers/segmentation.controller.js)
       ↓
Service (src/services/segmentation.service.js)
       ↓
Provider (src/services/providers/python-segmentation.provider.js)
       ↓
predict.py (using preprocessor.joblib & kmeans_model.joblib)
       ↓
JSON (stdout)
       ↓
Express Response
```

### 4. Model Input Features (Exactly 28 + Patient_ID)
Every request requires the `Patient_ID` (string) and exactly 28 features:
1. `Age` (numeric positive value)
2. `Gender` (string)
3. `Region` (string)
4. `Insurance_Type` (string)
5. `Disease_Condition` (string)
6. `Income_Band` (string)
7. `Employment_Status` (string)
8. `Baseline_Risk` (number between 0 and 1)
9. `Num_Programs_Enrolled` (number)
10. `Total_Enrollment_Duration` (number)
11. `Num_Claims` (number)
12. `Num_Refills` (number)
13. `Average_Days_Supply` (number)
14. `Total_Patient_Paid` (number)
15. `Average_Patient_Paid` (number)
16. `Average_Refill_Gap` (number)
17. `Maximum_Refill_Gap` (number)
18. `Copay_Claims_Count` (number)
19. `Total_Copay_Used` (number)
20. `Total_Copay_Savings` (number)
21. `Copay_Utilization_Rate` (number between 0 and 1)
22. `Num_Interactions` (number)
23. `Num_Financial_Assistance_Interactions` (number)
24. `Num_Adherence_Counseling_Interactions` (number)
25. `Follow_Up_Rate` (number between 0 and 1)
26. `Resolution_Rate` (number between 0 and 1)
27. `PDC` (number between 0 and 1)
28. `Persistence_Days` (number)

### 5. API Endpoints

#### POST `/api/ml/patient-segmentation`
Predicts patient segment cluster and business classification.

**Request Header:**
- `Content-Type: application/json`

**Example Request Payload:**
```json
{
  "Patient_ID": "PAT-00001",
  "Age": 54,
  "Gender": "Female",
  "Region": "South",
  "Insurance_Type": "Commercial",
  "Disease_Condition": "Condition_A",
  "Income_Band": "Middle Class",
  "Employment_Status": "Employed",
  "Baseline_Risk": 0.72,
  "Num_Programs_Enrolled": 2,
  "Total_Enrollment_Duration": 360,
  "Num_Claims": 15,
  "Num_Refills": 12,
  "Average_Days_Supply": 30,
  "Total_Patient_Paid": 350.00,
  "Average_Patient_Paid": 29.16,
  "Average_Refill_Gap": 2.5,
  "Maximum_Refill_Gap": 7,
  "Copay_Claims_Count": 10,
  "Total_Copay_Used": 1000.00,
  "Total_Copay_Savings": 800.00,
  "Copay_Utilization_Rate": 0.67,
  "Num_Interactions": 12,
  "Num_Financial_Assistance_Interactions": 4,
  "Num_Adherence_Counseling_Interactions": 2,
  "Follow_Up_Rate": 0.58,
  "Resolution_Rate": 0.75,
  "PDC": 0.85,
  "Persistence_Days": 240
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "patient_id": "PAT-00001",
    "cluster_id": 2,
    "segment_name": "Government Insured / Stable Adherent"
  }
}
```

### 6. Environment Configuration
The Python bridge uses these environment variables:
```ini
# Command or path to the Python environment
PYTHON_EXECUTABLE=python

# Directory where predict.py, preprocessor.joblib, and kmeans_model.joblib are stored
SEGMENTATION_MODEL_DIR=
```

### 7. Error Handling
- **Missing ML Artifacts (503 Service Unavailable)**: Returned if `predict.py`, `kmeans_model.joblib`, or `preprocessor.joblib` cannot be found.
  - Code: `SEGMENTATION_MODEL_UNAVAILABLE`
- **Python Execution Failures (500 Internal Server Error)**: Returned if the python process crashes or exits with a non-zero exit code.
  - Code: `SEGMENTATION_INFERENCE_FAILED`
- **Invalid Model Output (502 Bad Gateway)**: Returned if the python script's output cannot be parsed as valid JSON or lacks the `cluster_id` property.
  - Code: `INVALID_MODEL_RESPONSE`

### 8. Testing patient-segmentation
You can verify the integration using the dedicated test suite:
```bash
node src/test/segmentation.test.js
```
*Note: If the required ML model artifacts are missing in the model directory, the test suite will log a notice and gracefully skip model execution while validating the API routes and validation schemas.*

## Phase 5: Patient Support Strategy Effectiveness Prediction API Integration

### 1. Overview & Purpose
The Strategy Effectiveness Prediction API predicts the Proportion of Days Covered (PDC) for a patient given their clinical/demographic characteristics, current support segment, and a proposed support strategy.

### 2. Integration Architecture
Express integrates with the Python 3.11 virtual environment through a subprocess bridge:
- **Python Executable**: `backend/venv_strategy/Scripts/python.exe`
- **Subprocess script**: `backend/ml_model/strategy/predict_strategy.py`
- **Model Artifacts**: `preprocessor.joblib`, `gradientboostingregressor_model.joblib`

### 3. Model Input Features (Exactly 43)
The API accepts exactly 43 features:
- **Numerical Features (29)**: `Age`, `Baseline_Risk`, `Enrolled_PG01`, `Enrolled_PG02`, `Enrolled_PG03`, `Enrolled_PG04`, `Enrolled_PG05`, `Enrolled_PG06`, `Variable_Cost_Per_Patient_30d`, `Copay_Max_Per_Patient_30d`, `Num_Claims_30d`, `Num_Refills_30d`, `Average_Days_Supply_30d`, `Total_Patient_Paid_30d`, `Average_Patient_Paid_30d`, `Average_Refill_Gap_30d`, `Maximum_Refill_Gap_30d`, `Copay_Claims_Count_30d`, `Total_Copay_Used_30d`, `Total_Copay_Savings_30d`, `Fund_Exhausted_Any_30d`, `Copay_Utilization_Rate_30d`, `Num_Interactions_30d`, `Num_Financial_Assistance_Interactions_30d`, `Num_Adherence_Counseling_Interactions_30d`, `Follow_Up_Rate_30d`, `Resolution_Rate_30d`, `No_Response_Rate_30d`, `Escalation_Rate_30d`
- **Categorical Features (14)**: `Gender`, `Age_Group`, `Region`, `State`, `City_Market`, `Insurance_Type`, `Insurance_Plan`, `Disease_Condition`, `Income_Band`, `Financial_Assistance_Eligible`, `Employment_Status`, `Segment_Name`, `Primary_Enrollment_Channel`, `Primary_Enrollment_Reason`

### 4. API Endpoints

#### POST `/api/ml/strategy-effectiveness`
Predicts patient PDC (regression target) based on 43 features.

**Example Request Payload:**
```json
{
  "Age": 45,
  "Baseline_Risk": 0.35,
  "Enrolled_PG01": 1,
  "Enrolled_PG02": 0,
  "Enrolled_PG03": 0,
  "Enrolled_PG04": 0,
  "Enrolled_PG05": 0,
  "Enrolled_PG06": 0,
  "Variable_Cost_Per_Patient_30d": 150,
  "Copay_Max_Per_Patient_30d": 100,
  "Num_Claims_30d": 3,
  "Num_Refills_30d": 2,
  "Average_Days_Supply_30d": 30,
  "Total_Patient_Paid_30d": 60,
  "Average_Patient_Paid_30d": 30,
  "Average_Refill_Gap_30d": 1.5,
  "Maximum_Refill_Gap_30d": 4,
  "Copay_Claims_Count_30d": 2,
  "Total_Copay_Used_30d": 200,
  "Total_Copay_Savings_30d": 180,
  "Fund_Exhausted_Any_30d": 0,
  "Copay_Utilization_Rate_30d": 0.5,
  "Num_Interactions_30d": 4,
  "Num_Financial_Assistance_Interactions_30d": 2,
  "Num_Adherence_Counseling_Interactions_30d": 1,
  "Follow_Up_Rate_30d": 0.75,
  "Resolution_Rate_30d": 0.8,
  "No_Response_Rate_30d": 0.15,
  "Escalation_Rate_30d": 0.05,
  "Gender": "Female",
  "Age_Group": "18-29",
  "Region": "Midwest",
  "State": "California",
  "City_Market": "California Metro 1",
  "Insurance_Type": "Commercial",
  "Insurance_Plan": "Aetna Signature",
  "Disease_Condition": "Acne Vulgaris",
  "Income_Band": "$100K-$150K",
  "Financial_Assistance_Eligible": true,
  "Employment_Status": "Employed Full-Time",
  "Segment_Name": "Commercially Insured / Copay Dependent",
  "Primary_Enrollment_Channel": "Call Center",
  "Primary_Enrollment_Reason": "Affordability Barrier"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "predicted_pdc": 0.9184062222266859
  }
}
```

### 5. Environment Configuration
The Python bridge uses these environment variables:
```ini
PYTHON_STRATEGY_EXECUTABLE=venv_strategy/Scripts/python.exe
STRATEGY_MODEL_DIR=ml_model/strategy
```

### 6. Error Handling
- **Missing ML Artifacts (503 Service Unavailable)**:
  * Code: `STRATEGY_MODEL_UNAVAILABLE`
- **Python Execution Failures (500 Internal Server Error)**:
  * Code: `STRATEGY_INFERENCE_FAILED`
- **Invalid Model Output (502 Bad Gateway)**:
  * Code: `INVALID_MODEL_RESPONSE`

### 7. Verification / Testing
Run the integration test suite:
```bash
node src/test/strategy.test.js
```



