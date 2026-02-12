import asyncio
import websockets
import json

async def test():
    uri = "ws://localhost:8000/ws/online-count"
    
    print("=" * 60)
    print("WebSocket Real-time Online Count - Test Suite")
    print("=" * 60)
    
    print("\n--- Test 1: Connecting 3 clients (same IP = localhost) ---")
    print("Expected: count should stay at 1 (same IP)")
    clients = []
    
    for i in range(3):
        try:
            ws = await websockets.connect(uri, additional_headers={"X-Forwarded-For": "1.1.1.1"})
            clients.append(ws)
            msg = await asyncio.wait_for(ws.recv(), timeout=5)
            data = json.loads(msg)
            print(f"  Tab {i+1} connected. Server count: {data.get('count')}")
        except Exception as e:
            print(f"  Failed to connect tab {i+1}: {e}")

    # Small delay to let broadcasts settle
    await asyncio.sleep(0.5)

    print(f"\n  Current total connections: {len(clients)}")
    print(f"  All from same IP (1.1.1.1) -> should show count = 1")

    print("\n--- Test 2: Connecting 3 clients with DIFFERENT IPs ---")
    print("Expected: count should increase to 4 unique IPs")
    
    for i in range(3):
        fake_ip = f"2.2.2.{i+1}"
        try:
            ws = await websockets.connect(uri, additional_headers={"X-Forwarded-For": fake_ip})
            clients.append(ws)
            msg = await asyncio.wait_for(ws.recv(), timeout=5)
            data = json.loads(msg)
            print(f"  User (IP: {fake_ip}) connected. Server count: {data.get('count')}")
        except Exception as e:
            print(f"  Failed to connect user {i+1}: {e}")

    await asyncio.sleep(0.5)

    print("\n--- Test 3: Disconnecting one unique IP user ---")
    print("Expected: count should decrease by 1")
    
    if len(clients) > 3:
        # Close the first "different IP" client (index 3)
        await clients[3].close()
        clients.pop(3)
        await asyncio.sleep(1)
        
        # Read the broadcast from remaining clients
        for ws in clients:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=3)
                data = json.loads(msg)
                print(f"  After disconnect, Server count: {data.get('count')}")
                break  # Only need one response
            except asyncio.TimeoutError:
                pass
            except Exception:
                pass

    print("\n--- Cleanup: Closing all connections ---")
    for ws in clients:
        try:
            await ws.close()
        except:
            pass
    
    await asyncio.sleep(1)
    print("\n" + "=" * 60)
    print("Test complete!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test())
