import requests
import json
import base64
import webbrowser
import tempfile
import os

# --- Global Configuration ---
# You can switch this to "https://airouter.my" to test remote endpoints.
BASE_URL = "https://omnirouter.aiyuanxi.com"
API_KEY = "sk-nae222lfZUlmDELrRuMeE7eAjWA8xtpsREFRY9nh4bPhpMWh"  # aliyun iclaw
API_KEY = "sk-vf21rls6PsDJ7c5mudvMhnUKwU8hMz5I6pOTfHOOP8vSrSZF"  # user key: wangruntao
API_KEY = "sk-lrEzozeDfQZrPOncmooAG2OITJEq2FAvu7YC1DbpodTBDGPJ"  # user key: hanxingkai
# STEP3_KEY = "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"

def _execute_request(model, url, body, headers):
    """Helper function to execute a single API request and return the response object."""
    print(f"--- Testing model: {model} ---")
    try:
        response = requests.post(url, json=body, headers=headers, timeout=60)
        response.raise_for_status()
        return response
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Request failed for model {model}: {e}")
        return None
    finally:
        print("-" * 50)

# --- Generic Test Functions ---

def test_chat_model(model):
    """Tests any OpenAI-compatible chat model."""
    url = f"{BASE_URL}/v1/chat/completions"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}
    body = {"model": model, "messages": [{"role": "user", "content": "hello"}], "max_tokens": 100}
    response = _execute_request(model, url, body, headers)
    if response:
        print(response.text)
        return True
    return False

def test_image_generation_model(model):
    """Tests an image generation model and displays the output."""
    url = f"{BASE_URL}/v1/images/generations/"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}
    body = {"model": model, "prompt": "A beautiful sunset over the mountains", "n": 1}
    response = _execute_request(model, url, body, headers)
    if not response:
        return False

    try:
        data = response.json()
        if not data.get("data"):
            print("No 'data' field in response:", response.text)
            return False

        for i, item in enumerate(data["data"]):
            if item.get("url"):
                print(f"Opening image URL for model {model}: {item['url']}")
                webbrowser.open(item["url"])
            elif item.get("b64_json"):
                print(f"Displaying base64 image for model {model}...")
                img_data = base64.b64decode(item["b64_json"])
                with tempfile.NamedTemporaryFile(delete=False, mode='w', suffix='.html') as f:
                    f.write(f'''
                        <html>
                            <head><title>Image for {model}</title></head>
                            <body><img src="data:image/png;base64,{item["b64_json"]}"></body>
                        </html>
                    ''')
                    webbrowser.open(f"file://{os.path.realpath(f.name)}")
        return True
    except (json.JSONDecodeError, KeyError) as e:
        print(f"Error parsing response for {model}: {e}")
        print("Raw response:", response.text)
        return False

def test_anthropic_model(model):
    """Tests an Anthropic-compatible model."""
    url = f"{BASE_URL}/v1/messages"
    headers = {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "Authorization": f"Bearer {API_KEY}",
    }
    body = {"model": model, "messages": [{"role": "user", "content": "hello"}], "max_tokens": 100}
    response = _execute_request(model, url, body, headers)
    if response:
        print(response.text)
        return True
    return False

def test_gemini_text_model(model):
    """Tests a Gemini-compatible text model."""
    url = f"{BASE_URL}/v1beta/models/{model}:generateContent"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}
    body = {
        "model": model,
        "contents": [{"role": "user", "parts": [{"text": "你好"}]}]
    }
    response = _execute_request(model, url, body, headers)
    if response:
        print(response.text)
        return True
    return False

def test_gemini_image_model(model):
    """Tests a Gemini-compatible image model."""
    url = f"{BASE_URL}/v1beta/models/{model}:generateContent"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"}
    body = {"contents": [{"parts": [{"text": "hi"}]}]}
    response = _execute_request(model, url, body, headers)
    if response:
        # Image models for Gemini might not return a URL but other data.
        # For now, we just check for a successful response.
        print(model, response.text)
        return True
    return False


TEST_SUITE = {
    # Anthropic Models
    # "claude-opus-4-6": test_anthropic_model,
    # "claude-sonnet-4-6": test_anthropic_model,
    # "claude-haiku-4-5-20251001": test_anthropic_model,
    # "claude-opus-4-5-20251101": test_anthropic_model,
    # "claude-sonnet-4-5-20250929": test_anthropic_model,

    # Gemini Models
    # "gemini-3.1-flash-lite-preview": test_gemini_text_model,
    # "gemini-3.1-pro-preview": test_gemini_text_model,
    # "gemini-3-flash-preview": test_gemini_text_model,
    # "gemini-2.5-pro": test_gemini_text_model,
    # "gemini-2.5-flash": test_gemini_text_model,
    ### "gemini-2.5-flashlite": test_gemini_text_model,  # (Not Test)
    # Gemini multimodal models
    # "gemini-3.1-flash-image-preview": test_gemini_image_model,
    # "gemini-3-pro-image-preview": test_gemini_image_model,
    # "gemini-2.5-flash-image": test_gemini_image_model,
    
    # OpenAI Text Models
    # "gpt-5.4": test_chat_model,
    # "gpt-5.3-codex": test_chat_model,
    # "gpt-5.2": test_chat_model,
    # "gpt-5.1": test_chat_model,
    # "gpt-5": test_chat_model,
    # "gpt-5-mini": test_chat_model,
    ### "veo-3.1": test_chat_model, # ( Not Test )

    # OpenAI Image Models
    # "gpt-image-1.5": test_image_generation_model,
    # "gpt-image-1": test_image_generation_model,
    ### "sora-2": test_image_generation_model,  # ( Not Test )

    # Other Chat Models
    # "grok-4-1-fast-reasoning": test_chat_model,
    # "grok-4-1-fast-non-reasoning": test_chat_model,
    # "grok-code-fast-1": test_chat_model,
    # "grok-4-0709": test_chat_model,
    # "kimi-k2.5": test_chat_model,
    "MiniMax-M2.5": test_chat_model,
    # "glm-5": test_chat_model,
    # "deepseek-v3.2": test_chat_model,
}

if __name__ == "__main__":
    passed_tests = {}
    failed_tests = {}

    print(f"\n{'='*20} Starting All Tests against BASE_URL: {BASE_URL} {'='*20}\n")
    if not TEST_SUITE:
        print("No tests found in TEST_SUITE. Please add models to test.")
    else:
        for model_name, test_function in TEST_SUITE.items():
            if test_function(model_name):
                passed_tests[model_name] = "Success"
            else:
                failed_tests[model_name] = "Failed"
            print("\n")
    
    print(f"\n{'='*20} Finished All Tests {'='*20}\n")
    
    print("--- Passed Tests ---")
    print(json.dumps(passed_tests, indent=2))
    
    print("--- Failed Tests ---")
    print(json.dumps(failed_tests, indent=2))