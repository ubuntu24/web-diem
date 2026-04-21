import pytest

@pytest.mark.asyncio
async def test_health_check(client):
    response = await client.get("/")
    # FastAPI usually returns a welcome message or its title on root if defined, or 404 if not.
    # We just want to check if the app is loadable and reachable.
    assert response.status_code in [200, 404] 
