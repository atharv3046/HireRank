import pytest
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.team_member import TeamMember
from app.core.security import hash_password, create_access_token

client = TestClient(app)

@pytest.fixture
def test_user():
    db = SessionLocal()
    try:
        unique_email = f"settings_test_{uuid.uuid4().hex[:8]}@hirerank.test"
        user = User(
            email=unique_email,
            password_hash=hash_password("testpass123"),
            role="recruiter",
            company_name="Acme Innovations"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        token = create_access_token({"sub": str(user.id)})
        return {"user": user, "token": token, "auth_headers": {"Authorization": f"Bearer {token}"}}
    finally:
        db.close()

def test_get_company_profile(test_user):
    headers = test_user["auth_headers"]
    res = client.get("/settings/profile", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["workspace_name"] == "Acme Innovations"
    assert data["admin_email"] == test_user["user"].email
    assert "org_id" in data
    assert data["role"] == "recruiter"

def test_update_company_profile(test_user):
    headers = test_user["auth_headers"]
    payload = {
        "workspace_name": "Globex Corp",
        "domain": "globex.io"
    }
    res = client.put("/settings/profile", json=payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["workspace_name"] == "Globex Corp"
    assert data["domain"] == "globex.io"

def test_team_members_auto_seeds_admin(test_user):
    headers = test_user["auth_headers"]
    res = client.get("/settings/team", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["seat_usage"]["used"] >= 1
    assert data["seat_usage"]["total"] == 5
    assert len(data["members"]) >= 1
    primary = data["members"][0]
    assert primary["email"] == test_user["user"].email
    assert primary["is_primary"] is True

def test_invite_and_remove_team_member(test_user):
    headers = test_user["auth_headers"]
    invite_payload = {
        "name": "Jane Doe",
        "email": f"jane_{uuid.uuid4().hex[:6]}@globex.io",
        "role": "Recruiter"
    }
    res = client.post("/settings/team/invite", json=invite_payload, headers=headers)
    assert res.status_code == 200
    member = res.json()
    assert member["email"] == invite_payload["email"]
    assert member["status"] == "Invited"

    # Check seat count increased
    team_res = client.get("/settings/team", headers=headers)
    assert team_res.status_code == 200
    assert any(m["id"] == member["id"] for m in team_res.json()["members"])

    # Remove member
    del_res = client.delete(f"/settings/team/members/{member['id']}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

def test_seat_limit_enforced(test_user):
    headers = test_user["auth_headers"]
    # Invite until 5 members
    for i in range(4):
        client.post(
            "/settings/team/invite",
            json={"name": f"Member {i}", "email": f"member_{i}_{uuid.uuid4().hex[:6]}@globex.io", "role": "Recruiter"},
            headers=headers
        )

    # 6th member should fail with 400
    overflow_res = client.post(
        "/settings/team/invite",
        json={"name": "Overflow Member", "email": f"overflow_{uuid.uuid4().hex[:6]}@globex.io", "role": "Recruiter"},
        headers=headers
    )
    assert overflow_res.status_code == 400
    assert "Seat limit reached" in overflow_res.json()["detail"]

def test_billing_and_plan_metrics(test_user):
    headers = test_user["auth_headers"]
    res = client.get("/settings/billing", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["current_plan"] == "Free Trial"
    assert "usage" in data
    assert "screenings" in data["usage"]
    assert "evaluations" in data["usage"]
    assert "team_seats" in data["usage"]
    assert len(data["plans"]) == 3
    assert data["plans"][0]["is_current"] is True
