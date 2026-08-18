-- Drop tables if they exist to support clean reset / initialization
DROP TABLE IF EXISTS patient_recommendations CASCADE;
DROP TABLE IF EXISTS program_business CASCADE;
DROP TABLE IF EXISTS patient_program CASCADE;

-- Table 1: Patient-Program Relationship
CREATE TABLE patient_program (
    patient_id VARCHAR(50) NOT NULL,
    program_id VARCHAR(50) NOT NULL,
    program_type VARCHAR(100) NOT NULL,
    insurance_type VARCHAR(100) NOT NULL,
    enrollment_date DATE NOT NULL,
    enrollment_status VARCHAR(50) NOT NULL,
    enrollment_channel VARCHAR(50) NOT NULL,
    copay_coverage_amount NUMERIC(12, 2) DEFAULT 0.00,
    annual_benefit_cap NUMERIC(12, 2) DEFAULT 0.00,
    benefit_utilized_amount NUMERIC(12, 2) DEFAULT 0.00,
    number_of_fills_with_assistance INTEGER DEFAULT 0,
    adherence_rate NUMERIC(5, 2) DEFAULT 0.00, -- Expected as percentage e.g., 85.50
    persistency_days INTEGER DEFAULT 0,
    dropout_reason VARCHAR(255),
    PRIMARY KEY (patient_id, program_id)
);

-- Index for querying by Program ID or Patient ID independently
CREATE INDEX idx_patient_program_prog ON patient_program(program_id);
CREATE INDEX idx_patient_program_status ON patient_program(enrollment_status);

-- Table 2: Sales & Business Metrics (aggregated by program, region, and time period)
CREATE TABLE program_business (
    program_id VARCHAR(50) NOT NULL,
    region VARCHAR(100) NOT NULL,
    time_period VARCHAR(50) NOT NULL,
    enrolled_patient_count INTEGER DEFAULT 0,
    program_cost NUMERIC(15, 2) DEFAULT 0.00,
    revenue_generated NUMERIC(15, 2) DEFAULT 0.00,
    roi NUMERIC(10, 4) DEFAULT 0.0000, -- ROI ratio format, e.g. 1.2500 for 125% ROI
    retention_rate NUMERIC(5, 2) DEFAULT 0.00,
    churn_rate NUMERIC(5, 2) DEFAULT 0.00,
    net_new_patients INTEGER DEFAULT 0,
    payer_mix JSONB, -- JSON configuration representing payer percentages e.g., {"Commercial": 60, "Medicare": 30, "Medicaid": 10}
    PRIMARY KEY (program_id, region, time_period)
);

-- Table 3: Patient AI Recommendation Layer (stored predictions from ML models)
CREATE TABLE patient_recommendations (
    patient_id VARCHAR(50) NOT NULL,
    patient_demographics JSONB, -- e.g., {"age": 45, "gender": "F"}
    disease_therapy_area VARCHAR(150),
    current_program_type VARCHAR(100),
    predicted_adherence_risk VARCHAR(50), -- e.g., High, Medium, Low
    predicted_churn_risk VARCHAR(50), -- e.g., High, Medium, Low
    recommended_program_type VARCHAR(100),
    recommended_discount_tier VARCHAR(50), -- e.g., Tier 1, Tier 2
    predicted_roi_contribution NUMERIC(10, 4) DEFAULT 0.0000,
    model_confidence_score NUMERIC(5, 4) DEFAULT 0.0000, -- Confidence e.g., 0.9421
    PRIMARY KEY (patient_id)
);
