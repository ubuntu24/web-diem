import pytest
from main import app
from security import get_current_user

class MockUser:
    username = "testuser"
    role = 0

def override_get_current_user():
    return MockUser()

@pytest.fixture(autouse=True)
def override_auth():
    app.dependency_overrides[get_current_user] = override_get_current_user
    yield
    app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.asyncio
async def test_search_rejects_sql_injection_payload(client):
    response = await client.get('/api/search', params={'query': "' OR 1=1 --"})
    assert response.status_code == 400

@pytest.mark.asyncio
async def test_search_rejects_too_long_payload(client):
    response = await client.get('/api/search', params={'query': 'x' * 200})
    assert response.status_code == 422 or response.status_code == 400

@pytest.mark.asyncio
async def test_search_rejects_sql_keyword_payload(client):
    response = await client.get('/api/search', params={'query': 'test union select'})
    assert response.status_code == 400
