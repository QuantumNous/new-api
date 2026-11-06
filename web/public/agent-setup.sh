#!/bin/sh
set -eu

PYTHON=python3
if ! command -v "$PYTHON" >/dev/null 2>&1; then
  if command -v python >/dev/null 2>&1 && python -c 'import sys; raise SystemExit(0 if sys.version_info[0] == 3 else 1)' >/dev/null 2>&1; then
    PYTHON=python
  else
    printf '%s\n' '需要 Python 3 才能安全更新配置文件。请先安装 Python 3 后重试。' >&2
    exit 1
  fi
fi

SETUP_SCRIPT=$(mktemp "${TMPDIR:-/tmp}/new-api-agent-setup.XXXXXX")
trap 'rm -f "$SETUP_SCRIPT"; exit 130' 1 2 15
trap 'rm -f "$SETUP_SCRIPT"' 0

cat >"$SETUP_SCRIPT" <<'PY'
import getpass
import json
import os
import platform
import re
import shutil
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

DEFAULT_CODEX_MODEL = 'gpt-5.6-sol'
DEFAULT_DSH_MODEL = 'gpt-5.6-sol'
DEFAULT_GEMINI_MODEL = 'gemini-2.5-pro'
GATEWAY_URL = 'https://ai.nekocore.cn'
PROVIDER_NAME = 'NekoAI'
DSH_CREDENTIAL_REF = 'NEWAPI_API_KEY'
DSH_PROVIDER_ID = 'new-api'
PROVIDER_HEADER = re.compile(
    r'^\s*\[\[?\s*model_providers\.newapi(?:\.[^\]]*)?\s*\]\]?\s*(?:#.*)?$'
)
ENV_LINE = re.compile(r'^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=')


def heading(text):
    print(f'\n{text}')


def detail(text):
    print(f'  {text}')


def normalize_gateway_url(value):
    normalized = value.strip().rstrip('/')
    if normalized.lower().endswith('/v1'):
        normalized = normalized[:-3].rstrip('/')
    parsed = urlsplit(normalized)
    if parsed.scheme not in ('http', 'https') or not parsed.netloc:
        raise ValueError('请输入完整的 http:// 或 https:// 网关地址。')
    return normalized


def normalize_api_key(value):
    key = ''.join(value.split())
    if key.lower().startswith('bearer '):
        key = key[7:].strip()
    if not key:
        raise ValueError('API Key 不能为空。')
    if key[:3].lower() == 'sk-':
        return 'sk-' + key[3:]
    return 'sk-' + key


def backup_file(path, stamp):
    if not path.exists():
        return
    backup = path.with_name(f'{path.name}.bak-{stamp}')
    counter = 1
    while backup.exists():
        backup = path.with_name(f'{path.name}.bak-{stamp}-{counter}')
        counter += 1
    shutil.copy2(path, backup)
    os.chmod(backup, 0o600)
    detail(f'备份：{backup}')


def write_text(path, content):
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f'.{path.name}.', dir=path.parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as file:
            file.write(content)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def read_json_object(path):
    if not path.exists():
        return {}
    raw = path.read_text(encoding='utf-8').strip()
    if not raw:
        return {}
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError(f'配置文件不是有效的 JSON 对象：{path}')
    return value


def write_json(path, value):
    write_text(path, json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def toml_string(value):
    return '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'


def update_codex_config(path, base_url, api_key, stamp):
    backup_file(path, stamp)
    text = path.read_text(encoding='utf-8') if path.exists() else ''
    lines = text.replace('\r\n', '\n').replace('\r', '\n').split('\n')

    without_provider = []
    skipping_provider = False
    for line in lines:
        if PROVIDER_HEADER.match(line):
            skipping_provider = True
            continue
        if re.match(r'^\s*\[', line):
            skipping_provider = False
        if not skipping_provider:
            without_provider.append(line)

    top_level_end = len(without_provider)
    for index, line in enumerate(without_provider):
        if re.match(r'^\s*\[', line):
            top_level_end = index
            break

    output = []
    has_provider = False
    has_model = False
    for line in without_provider[:top_level_end]:
        if re.match(r'^\s*model_provider\s*=', line):
            if not has_provider:
                output.append('model_provider = "newapi"')
                has_provider = True
            continue
        if re.match(r'^\s*model\s*=', line):
            if not has_model:
                output.append(line)
                has_model = True
            continue
        output.append(line)

    prefix = []
    if not has_provider:
        prefix.append('model_provider = "newapi"')
    if not has_model:
        prefix.append(f'model = {toml_string(DEFAULT_CODEX_MODEL)}')

    output = prefix + output + without_provider[top_level_end:]
    while output and not output[-1].strip():
        output.pop()
    output.extend(
        [
            '',
            '[model_providers.newapi]',
            f'name = {toml_string(PROVIDER_NAME)}',
            f'base_url = {toml_string(base_url + "/v1")}',
            'wire_api = "responses"',
            f'experimental_bearer_token = {toml_string(api_key)}',
        ]
    )
    write_text(path, '\n'.join(output) + '\n')


def update_claude_settings(path, base_url, api_key, stamp):
    backup_file(path, stamp)
    settings = read_json_object(path)
    environment = settings.get('env')
    if environment is None:
        environment = {}
        settings['env'] = environment
    if not isinstance(environment, dict):
        raise ValueError('Claude Code 的 env 配置必须是 JSON 对象。')
    environment['ANTHROPIC_BASE_URL'] = base_url
    environment['ANTHROPIC_AUTH_TOKEN'] = api_key
    for name in (
        'ANTHROPIC_API_KEY',
        'CLAUDE_CODE_USE_BEDROCK',
        'CLAUDE_CODE_USE_VERTEX',
    ):
        environment.pop(name, None)
    write_json(path, settings)


def update_env_file(path, values, stamp):
    backup_file(path, stamp)
    lines = path.read_text(encoding='utf-8').splitlines() if path.exists() else []
    output = []
    seen = set()
    for line in lines:
        match = ENV_LINE.match(line)
        if match and match.group(1) in values:
            name = match.group(1)
            if name not in seen:
                output.append(f'{name}={values[name]}')
                seen.add(name)
            continue
        output.append(line)
    for name, value in values.items():
        if name not in seen:
            output.append(f'{name}={value}')
    write_text(path, '\n'.join(output) + '\n')


def update_gemini_config(directory, base_url, api_key, stamp):
    settings_path = directory / 'settings.json'
    backup_file(settings_path, stamp)
    settings = read_json_object(settings_path)
    security = settings.get('security')
    if security is None:
        security = {}
        settings['security'] = security
    if not isinstance(security, dict):
        raise ValueError('Gemini CLI 的 security 配置必须是 JSON 对象。')
    auth = security.get('auth')
    if auth is None:
        auth = {}
        security['auth'] = auth
    if not isinstance(auth, dict):
        raise ValueError('Gemini CLI 的 security.auth 配置必须是 JSON 对象。')
    auth['selectedType'] = 'gemini-api-key'
    model = settings.get('model')
    if model is None:
        model = {}
        settings['model'] = model
    if not isinstance(model, dict):
        raise ValueError('Gemini CLI 的 model 配置必须是 JSON 对象。')
    model['name'] = DEFAULT_GEMINI_MODEL
    write_json(settings_path, settings)
    update_env_file(
        directory / '.env',
        {
            'GEMINI_API_KEY': api_key,
            'GOOGLE_GEMINI_BASE_URL': base_url,
            'GEMINI_MODEL': DEFAULT_GEMINI_MODEL,
        },
        stamp,
    )


def yaml_key_line(line, indent, key):
    if indent_of(line) != indent:
        return None
    stripped = line.strip()
    if ':' not in stripped:
        return None
    actual = stripped.split(':', 1)[0].strip().strip("'\"")
    return actual if actual == key else None


def indent_of(line):
    if not line.strip():
        return None
    return len(line) - len(line.lstrip(' '))


def is_effective_line(line):
    return bool(line.strip()) and not line.lstrip().startswith('#')


def block_end(lines, start, limit, parent_indent):
    for index in range(start + 1, limit):
        if not is_effective_line(lines[index]):
            continue
        if indent_of(lines[index]) <= parent_indent:
            return index
    return limit


def top_level_entries(lines):
    starts = [
        index for index, line in enumerate(lines) if line.startswith('-')
    ]
    return [
        (start, starts[index + 1] if index + 1 < len(starts) else len(lines))
        for index, start in enumerate(starts)
    ]


def find_entry(lines, entry_id):
    for start, end in top_level_entries(lines):
        if entry_id_at(lines, start, end) == entry_id:
            return start, end
    return None


def entry_id_at(lines, start, end):
    first = re.match(r'^-\s+id\s*:\s*([^\s#]+)', lines[start])
    if first:
        return first.group(1).strip("'\"")
    for index in range(start + 1, end):
        if yaml_key_line(lines[index], 2, 'id') is not None:
            match = re.match(r'^\s{2}id\s*:\s*([^\s#]+)', lines[index])
            return match.group(1).strip("'\"") if match else None
    return None


def entry_has_config(lines, start, end):
    for index in range(start + 1, end):
        if yaml_key_line(lines[index], 2, 'config') is None:
            continue
        value = lines[index].split(':', 1)[1].split('#', 1)[0].strip()
        if value and value not in ('null', '~'):
            return True
        return any(
            is_effective_line(line) and indent_of(line) > 2
            for line in lines[index + 1:end]
        )
    return False


def ensure_dsh_providers_not_shadowed(path):
    if not path.exists():
        return
    text = path.read_text(encoding='utf-8')
    if not text.strip():
        return
    lines = text.replace('\r\n', '\n').replace('\r', '\n').splitlines()
    if any(
        entry_id_at(lines, start, end) == 'llm-pi-ai'
        and entry_has_config(lines, start, end)
        for start, end in top_level_entries(lines)
    ):
        raise ValueError(
            '供应商被 home 级补丁覆盖，请先在该文件里移除 llm-pi-ai 的 config：'
            f'{path}'
        )


def yaml_scalar(value):
    return "'" + value.replace("'", "''") + "'"


def dsh_provider_lines(base_url):
    return [
        f'      {DSH_PROVIDER_ID}:',
        f'        displayName: {PROVIDER_NAME}',
        f'        apiKeyEnv: {DSH_CREDENTIAL_REF}',
        '        api: openai-completions',
        f'        baseURL: {yaml_scalar(base_url + "/v1")}',
        '        compat:',
        '          supportsDeveloperRole: false',
        '          maxTokensField: max_tokens',
        '        models:',
        f'          - id: {DEFAULT_DSH_MODEL}',
    ]


def dsh_llm_entry_lines(base_url):
    return [
        '- id: llm-pi-ai',
        "  name: '@deepseek-ai/dsh-llm-pi-ai'",
        '  config:',
        '    providers:',
        *dsh_provider_lines(base_url),
    ]


def dsh_default_entry_lines():
    return [
        '- id: agent-default-model',
        "  name: '@deepseek-ai/dsh-agent-default-model'",
        '  config:',
        f'    provider: {DSH_PROVIDER_ID}',
        f'    model: {DEFAULT_DSH_MODEL}',
    ]


def update_dsh_llm_entry(lines, base_url):
    found = find_entry(lines, 'llm-pi-ai')
    if found is None:
        return lines + dsh_llm_entry_lines(base_url)
    start, end = found
    config = next(
        (index for index in range(start + 1, end) if yaml_key_line(lines[index], 2, 'config')),
        None,
    )
    if config is None or lines[config].strip() != 'config:':
        return lines[:start] + dsh_llm_entry_lines(base_url) + lines[end:]
    config_end = block_end(lines, config, end, 2)
    providers = next(
        (
            index
            for index in range(config + 1, config_end)
            if yaml_key_line(lines[index], 4, 'providers')
        ),
        None,
    )
    if providers is None:
        insert_at = config_end
        while insert_at > config + 1 and not lines[insert_at - 1].strip():
            insert_at -= 1
        return (
            lines[:insert_at]
            + ['    providers:', *dsh_provider_lines(base_url)]
            + lines[insert_at:]
        )
    if lines[providers].strip() != 'providers:':
        return lines[:providers] + ['    providers:'] + lines[providers + 1:]
    providers_end = block_end(lines, providers, config_end, 4)
    provider = next(
        (
            index
            for index in range(providers + 1, providers_end)
            if yaml_key_line(lines[index], 6, DSH_PROVIDER_ID)
        ),
        None,
    )
    if provider is not None:
        provider_end = block_end(lines, provider, providers_end, 6)
        return (
            lines[:provider]
            + dsh_provider_lines(base_url)
            + lines[provider_end:]
        )
    insert_at = providers_end
    while insert_at > providers + 1 and not lines[insert_at - 1].strip():
        insert_at -= 1
    return lines[:insert_at] + dsh_provider_lines(base_url) + lines[insert_at:]


def update_dsh_default_entry(lines):
    found = find_entry(lines, 'agent-default-model')
    if found is None:
        return lines + dsh_default_entry_lines()
    start, end = found
    config = next(
        (index for index in range(start + 1, end) if yaml_key_line(lines[index], 2, 'config')),
        None,
    )
    if config is None or lines[config].strip() != 'config:':
        return lines[:start] + dsh_default_entry_lines() + lines[end:]
    config_end = block_end(lines, config, end, 2)
    output = lines[:]
    for key, value in (('provider', DSH_PROVIDER_ID), ('model', DEFAULT_DSH_MODEL)):
        existing = next(
            (
                index
                for index in range(config + 1, config_end)
                if yaml_key_line(output[index], 4, key)
            ),
            None,
        )
        replacement = f'    {key}: {value}'
        if existing is None:
            output.insert(config_end, replacement)
            config_end += 1
        else:
            output[existing] = replacement
    return output


def update_dsh_patch(path, base_url, stamp, restore_headless_credentials=False):
    backup_file(path, stamp)
    text = path.read_text(encoding='utf-8') if path.exists() else '[]\n'
    lines = text.replace('\r\n', '\n').replace('\r', '\n').splitlines()
    lines = [
        line for line in lines if indent_of(line) != 0 or line.strip() != '[]'
    ]
    lines = update_dsh_llm_entry(lines, base_url)
    lines = update_dsh_default_entry(lines)
    if restore_headless_credentials and find_entry(lines, 'credentials') is None:
        lines.extend(['- id: credentials', '  disabled: false'])
    write_text(path, '\n'.join(lines).rstrip() + '\n')


def update_dsh_credentials(path, api_key, stamp):
    backup_file(path, stamp)
    text = path.read_text(encoding='utf-8') if path.exists() else ''
    lines = text.replace('\r\n', '\n').replace('\r', '\n').splitlines()
    value = yaml_scalar(api_key)
    if not any(line.strip() for line in lines):
        write_text(path, f'version: 1\n\nrefs:\n  {DSH_CREDENTIAL_REF}: {value}\n')
        return

    refs = next(
        (index for index, line in enumerate(lines) if yaml_key_line(line, 0, 'refs')),
        None,
    )
    if refs is not None:
        refs_end = block_end(lines, refs, len(lines), 0)
        existing = next(
            (
                index
                for index in range(refs + 1, refs_end)
                if yaml_key_line(lines[index], 2, DSH_CREDENTIAL_REF)
            ),
            None,
        )
        replacement = f'  {DSH_CREDENTIAL_REF}: {value}'
        if existing is None:
            insert_at = refs_end
            while insert_at > refs + 1 and not lines[insert_at - 1].strip():
                insert_at -= 1
            lines = lines[:insert_at] + [replacement] + lines[insert_at:]
        else:
            lines[existing] = replacement
    elif any(
        yaml_key_line(line, 0, key) is not None
        for line in lines
        for key in ('version', 'records')
    ):
        records = next(
            (index for index, line in enumerate(lines) if yaml_key_line(line, 0, 'records')),
            None,
        )
        insert_at = len(lines) if records is None else records
        while insert_at > 0 and not lines[insert_at - 1].strip():
            insert_at -= 1
        lines = (
            lines[:insert_at]
            + ['refs:', f'  {DSH_CREDENTIAL_REF}: {value}', '']
            + lines[insert_at:]
        )
    else:
        existing = next(
            (
                index
                for index, line in enumerate(lines)
                if yaml_key_line(line, 0, DSH_CREDENTIAL_REF)
            ),
            None,
        )
        if existing is None:
            lines.append(f'{DSH_CREDENTIAL_REF}: {value}')
        else:
            lines[existing] = f'{DSH_CREDENTIAL_REF}: {value}'
    write_text(path, '\n'.join(lines).rstrip() + '\n')


def update_dsh_config(dsh_home, base_url, api_key, stamp):
    ensure_dsh_providers_not_shadowed(dsh_home / 'cordis.patch.yml')
    profiles_root = dsh_home / 'profiles'
    profiles = [profiles_root / 'web', profiles_root / 'desktop']
    profiles.extend(
        profiles_root / name
        for name in ('headless', 'acp')
        if (profiles_root / name).exists()
    )

    credentials_path = dsh_home / '.credentials.yaml'
    update_dsh_credentials(credentials_path, api_key, stamp)
    patch_paths = []
    for profile in profiles:
        patch_path = profile / 'cordis.patch.yml'
        update_dsh_patch(
            patch_path,
            base_url,
            stamp,
            restore_headless_credentials=profile.name == 'headless',
        )
        patch_paths.append(patch_path)
    return credentials_path, patch_paths


def main():
    os.umask(0o077)
    home = Path.home()
    print(f'\n{PROVIDER_NAME} - {platform.system()} 客户端配置')
    print('为 NekoAI 配置 Claude Code、Codex CLI、Gemini CLI 或 DeepSeek Harness。')

    heading('第 1 步 - 选择客户端')
    print('  1. Claude Code')
    print('  2. Codex CLI')
    print('  3. Gemini CLI')
    print('  4. DeepSeek Harness')
    choice = ''
    while choice not in ('1', '2', '3', '4'):
        choice = input('  请选择 1-4：').strip()

    heading('第 2 步 - 粘贴 API Key')
    api_key = normalize_api_key(getpass.getpass('  API Key（输入已隐藏）：'))

    base_url = normalize_gateway_url(GATEWAY_URL)
    detail(f'网关地址：{base_url}')

    print('\n正在写入配置...')
    print('API Key 将以明文形式保存在所选客户端的配置文件中。')
    stamp = datetime.now().strftime('%Y%m%d-%H%M%S')

    if choice == '1':
        directory = home / '.claude'
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        settings_path = directory / 'settings.json'
        update_claude_settings(settings_path, base_url, api_key, stamp)
        print('\nClaude Code 配置完成。')
        detail(f'配置文件：{settings_path}')
        detail('请重启 Claude Code 以应用配置。')
    elif choice == '2':
        codex_home = Path(os.environ.get('CODEX_HOME') or home / '.codex')
        codex_home.mkdir(mode=0o700, parents=True, exist_ok=True)
        config_path = codex_home / 'config.toml'
        update_codex_config(config_path, base_url, api_key, stamp)
        print('\nCodex CLI 配置完成。')
        detail(f'配置文件：{config_path}')
        detail('请打开新终端并运行 codex 以应用配置。')
    elif choice == '3':
        directory = home / '.gemini'
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        update_gemini_config(directory, base_url, api_key, stamp)
        print('\nGemini CLI 配置完成。')
        detail(f'配置文件：{directory / "settings.json"}')
        detail(f'环境文件：{directory / ".env"}')
        detail('请重启 Gemini CLI 以应用配置。')
    else:
        dsh_home = Path(os.environ.get('DSH_HOME') or home / '.dsh')
        dsh_home.mkdir(mode=0o700, parents=True, exist_ok=True)
        credentials_path, patch_paths = update_dsh_config(
            dsh_home, base_url, api_key, stamp
        )
        print('\nDeepSeek Harness 配置完成。')
        detail(f'凭据文件：{credentials_path}')
        for patch_path in patch_paths:
            detail(f'配置文件：{patch_path}')
        detail('请重启 DSH 以应用配置。')

    print('\n全部完成。备份文件已保存在原配置旁边。')


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\n已取消。')
        sys.exit(130)
    except Exception as error:
        print(f'\n配置失败：{error}')
        sys.exit(1)
PY

"$PYTHON" "$SETUP_SCRIPT" "$@"
