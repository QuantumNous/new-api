# prompt-gallery-import

把 [ZeroLu/awesome-gpt-image](https://github.com/ZeroLu/awesome-gpt-image)（CC BY 4.0）
的 GPT Image 提示词案例导入 flatkey prompt-library。

数据流：上游 README → 解析 → 示例图下载并上传 GCS →
`POST /api/prompt-library/import`（slug upsert，可重跑）。
条目级署名保留在 `source.label` / `source.url` / `output.extra_sources`。

## 用法

    # 只解析，产出 items.json 供人工过目
    python import_awesome_gpt_image.py --dry-run

    # 完整执行（需本机 gcloud 已认证，bucket 公共读）
    python import_awesome_gpt_image.py \
        --api-base https://<host> \
        --token $PROMPT_LIBRARY_IMPORT_TOKEN \
        --bucket <bucket-name>

    # 图片已存在默认跳过；--force 强制重传
    # 重跑安全：导入按 slug upsert；后台手动停用的条目不会被复活

## 依赖

- Python 3.9+，`pip install requests pytest`
- gcloud CLI（已 `gcloud auth login`，对目标 bucket 有写权限）

## 测试

    python -m pytest test_parse.py -q
