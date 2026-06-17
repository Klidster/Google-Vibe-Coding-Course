# Copyright (c) 2026 MyCompany LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

def login():
    pass

def login_with_google(token: str) -> dict:
    """Verifies a Google ID token and performs user login.

    For this mock implementation:
    - If the token is empty or invalid, returns an error.
    - If the token starts with "mock_google_token_", parses it and returns mock user info.
    - If the token is "valid_token", returns a generic valid user.

    Args:
        token: The Google ID token string.

    Returns:
        A dictionary containing "success" (bool), "user" (dict, optional),
        and "error" (str, optional).
    """
    if not token:
        return {"success": False, "error": "Token is missing"}

    if token.startswith("mock_google_token_"):
        # Extract email/name from mock token
        parts = token.split("_")
        name = parts[-1].capitalize() if len(parts) > 3 else "User"
        email = f"{name.lower()}@example.com"
        return {
            "success": True,
            "user": {
                "id": "123456789",
                "email": email,
                "name": name,
                "picture": f"https://example.com/{name.lower()}.jpg"
            }
        }
    elif token == "valid_token":
        return {
            "success": True,
            "user": {
                "id": "987654321",
                "email": "user@example.com",
                "name": "Google User",
                "picture": "https://example.com/user.jpg"
            }
        }
    
    return {"success": False, "error": "Invalid token signature"}

