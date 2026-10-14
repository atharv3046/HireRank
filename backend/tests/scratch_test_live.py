import requests

login = requests.post(
    "http://127.0.0.1:8000/auth/login",
    json={"email": "demo@recruitai.com", "password": "demo1234"}
).json()
token = login.get("access_token")
headers = {"Authorization": f"Bearer {token}"}

all_cands = requests.get("http://127.0.0.1:8000/candidates", headers=headers).json()
print("Total candidates across all jobs:", len(all_cands))

if all_cands:
    c0 = all_cands[0]
    cid = c0["id"]
    name = c0.get("name")
    print(f"Testing candidate #{cid} ({name}):")
    iq = requests.get(f"http://127.0.0.1:8000/candidates/{cid}/interview-questions", headers=headers).json()
    print("Interview questions count:", len(iq.get("questions", [])))
    print("Source:", iq.get("source"))
    print("Adversarial blocked:", iq.get("is_adversarial_blocked"))
    for idx, q in enumerate(iq.get("questions", [])):
        print(f"\n  Q{idx+1}: [{q['based_on']}]")
        print(f"       Question: {q['question']}")
        print(f"       Listen for: {q['listen_for']}")
