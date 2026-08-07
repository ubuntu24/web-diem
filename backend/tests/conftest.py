import os

# Set dummy test keys if running pytest in CI / test environment without explicit env vars
os.environ.setdefault("SECRET_KEY", "ci-test-secret-key-minimum-32-chars-long")
os.environ.setdefault("OBFUSCATION_ID_KEY", "ci-test-obfuscation-id-key")
os.environ.setdefault("PAYLOAD_OBFUSCATION_KEY", "ci-test-payload-obfuscation-key")

import pytest
import asyncio
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost") as ac:
        yield ac
