import json
from typing import Callable, Any
from fastapi import Request, Response
from fastapi.routing import APIRoute
from security import encrypt_data

class PrivacyShieldRoute(APIRoute):
    def get_route_handler(self) -> Callable:
        original_route_handler = super().get_route_handler()

        async def custom_route_handler(request: Request) -> Response:
            response: Response = await original_route_handler(request)
            
            # Check if response is successful and is JSON
            if (response.status_code >= 200 and response.status_code < 300 
                and "application/json" in response.headers.get("content-type", "")):
                
                try:
                    # Deserialize original body
                    body = json.loads(response.body.decode('utf-8'))
                    
                    # Encrypt the body
                    encrypted_string = encrypt_data(body)
                    
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
