#!/bin/bash
API_URL="https://www.fcloud.net/v1/chat/completions"
API_KEY="sk-O2syV2QtPZGQHkMiXgrpi2JeXhWqzGBPmLksQTus4tsoXBGN"

# 同时发送3个请求（假设限制为2）
for i in {1..6}; do
  curl -s "$API_URL" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"model":"claude-opus-4-5","messages":[{"role":"user","content":"hi"}]}' &
done
wait
