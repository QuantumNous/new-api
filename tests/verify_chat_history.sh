#!/bin/bash

# Configuration
BASE_URL="http://localhost:3000/api"
USERNAME="root"
PASSWORD="123456"

# 1. Login to get token
echo "Logging in..."
# First request to get session
curl -s -c cookies.txt -X POST "${BASE_URL}/user/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME\", \"password\": \"$PASSWORD\"}" > login_output.txt

echo "Login response:"
cat login_output.txt

# Wait a bit for session to be established/written
sleep 1

# If login failed, try to register
if grep -q "用户名或密码错误" login_output.txt; then
    echo -e "\nLogin failed. Attempting to create root user manually via script might not work if it's disabled. Checking if we can register."
    # We can try to register a new user or assume root user was created by init
    # The logs say: "no user exists, create a root user for you: username is root, password is 123456"
    # But then: "record not found"
    # This means the user creation might have failed or not persisted?
    # Or maybe we need to restart the backend again?
    # Wait, the log says: 
    # [SYS] 2026/01/04 - 00:34:08 | database migration started
    # [SYS] 2026/01/04 - 00:34:10 | system is already initialized at: ...
    # If system is initialized, maybe root user was created long ago with different password?
    # But I see "record not found" when trying to login.
    # It seems the database might be fresh or the user table is empty?
    # But "system is already initialized" suggests otherwise.
    # Ah, "record not found" in `model/user.go:511` which is `ValidateAndFill`.
    
    # Let's try to register a new user
    echo "Registering new user..."
    curl -s -c cookies.txt -X POST "${BASE_URL}/user/register" \
      -H "Content-Type: application/json" \
      -d "{\"username\": \"testuser\", \"password\": \"12345678\", \"display_name\": \"Test User\"}"
      
    echo "Logging in with new user..."
    curl -s -c cookies.txt -X POST "${BASE_URL}/user/login" \
      -H "Content-Type: application/json" \
      -d "{\"username\": \"testuser\", \"password\": \"12345678\"}" > login_output.txt
      
    echo "Login response:"
    cat login_output.txt
fi

# Extract User ID from login response
USER_ID=$(grep -o '"id":[0-9]*' login_output.txt | head -1 | cut -d':' -f2)
echo -e "\nLogged in User ID: $USER_ID"

# 2. Create Chat History
echo -e "\nCreating Chat History..."
# Note: Playground API requires 'New-Api-User' header for userId if using session auth?
# Actually middleware.UserAuth() usually gets id from session.
# Let's check middleware/auth.go if needed.
# But for now, let's try adding New-Api-User header just in case, or check why it failed.
# The error was "无权进行此操作，未提供 New-Api-User".
# This suggests the middleware expects this header?
# Let's add it.

CREATE_RESP=$(curl -s -b cookies.txt -X POST "${BASE_URL}/playground/chats" \
  -H "Content-Type: application/json" \
  -H "New-Api-User: $USER_ID" \
  -d '{"title": "Test Chat", "messages": "[{\"role\":\"user\",\"content\":\"hello\"}]", "model": "gpt-3.5-turbo", "group": "default"}')

echo "Create response: $CREATE_RESP"

# Extract ID (simple parsing)
CHAT_ID=$(echo $CREATE_RESP | grep -o '"ID":[0-9]*' | head -1 | cut -d':' -f2)
echo "Created Chat ID: $CHAT_ID"

if [ -z "$CHAT_ID" ]; then
  echo "Failed to create chat"
  exit 1
fi

# 3. Get Chat List
echo -e "\nGetting Chat List..."
curl -s -b cookies.txt -H "New-Api-User: $USER_ID" -X GET "${BASE_URL}/playground/chats"

# 4. Get Chat Details
echo -e "\nGetting Chat Details..."
curl -s -b cookies.txt -H "New-Api-User: $USER_ID" -X GET "${BASE_URL}/playground/chats/${CHAT_ID}"

# 5. Update Chat
echo -e "\nUpdating Chat..."
curl -s -b cookies.txt -H "New-Api-User: $USER_ID" -X PUT "${BASE_URL}/playground/chats/${CHAT_ID}" \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Chat Title", "messages": "[{\"role\":\"user\",\"content\":\"hello\"},{\"role\":\"assistant\",\"content\":\"hi\"}]"}'

# 6. Delete Chat
echo -e "\nDeleting Chat..."
curl -s -b cookies.txt -H "New-Api-User: $USER_ID" -X DELETE "${BASE_URL}/playground/chats/${CHAT_ID}"

# 7. Verify Deletion
echo -e "\nVerifying Deletion..."
curl -s -b cookies.txt -H "New-Api-User: $USER_ID" -X GET "${BASE_URL}/playground/chats/${CHAT_ID}"

echo -e "\nDone."
