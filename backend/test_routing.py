import requests

BASE_URL = "http://localhost:8000"

def test_public_api():
    print("Testing Public API...")
    resp = requests.get(f"{BASE_URL}/api/v1/auth/token/", headers={"Host": "localhost"})
    print(f"Public Token Get (Method Not Allowed expected): {resp.status_code}")
    
    resp = requests.get(f"{BASE_URL}/api/v1/tenants/", headers={"Host": "localhost"})
    print(f"Public Tenants List (Unauthorized expected): {resp.status_code}")

def test_tenant_api():
    print("\nTesting Tenant API (acme.localhost)...")
    resp = requests.get(f"{BASE_URL}/api/v1/auth/login/", headers={"Host": "acme.localhost"})
    print(f"Tenant Login Get (Method Not Allowed expected): {resp.status_code}")
    
    resp = requests.get(f"{BASE_URL}/api/v1/users/", headers={"Host": "acme.localhost"})
    print(f"Tenant Users List (Unauthorized expected): {resp.status_code}")

if __name__ == "__main__":
    try:
        test_public_api()
        test_tenant_api()
    except Exception as e:
        print(f"Error: {e}")
