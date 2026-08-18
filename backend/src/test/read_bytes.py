import os

model_path = os.path.join(os.getcwd(), 'ml_model', 'churn model')
with open(model_path, 'rb') as f:
    bytes_data = f.read(100)
    print("Bytes:", bytes_data)
    print("Hex:", bytes_data.hex())
