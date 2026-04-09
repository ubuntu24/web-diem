import json
from typing import Callable

from fastapi import Request, Response
from fastapi.routing import APIRoute
from security import obfuscate_payload


class PrivacyShieldRoute(APIRoute):
    def get_route_handler(self) -> Callable:
        original_route_handler = super().get_route_handler()

        async def custom_route_handler(request: Request) -> Response:
            response: Response = await original_route_handler(request)
            
            # Check if response is successful and is JSON
            if (response.status_code >= 200 and response.status_code < 300 
                and "application/json" in response.headers.get("content-type", "")):
                
                try:
                    # Deserialize original body safely
                    content = response.body
                    if isinstance(content, memoryview):
                        content = content.tobytes()
                        
                    body = json.loads(content.decode('utf-8'))
                    
                    # Encrypt the body using obfuscate_payload
                    encrypted_string = obfuscate_payload(body)
                    
                    if encrypted_string:
                        # Wrap in shield
                        shielded_data = {"shield": encrypted_string}
                        
                        # Prepare headers (remove old Content-Length)
                        new_headers = dict(response.headers)
                        new_headers.pop("content-length", None)
                        
                        # Return new response
                        return Response(
                            content=json.dumps(shielded_data),
                            media_type="application/json",
                            status_code=response.status_code,
                            headers=new_headers
                        )
                except Exception as e:
                    print(f"Privacy Shield Error: {e}")
            
            return response

        return custom_route_handler
