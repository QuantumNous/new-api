# GPT-Image-2 channel capabilities

Channels that expose `gpt-image-2` can declare their Images API contract in
the channel editor. The value is stored under
`channels.settings.gpt_image2_capabilities`.

When this object is present it is authoritative. When it is absent, the legacy
channel-ID rules remain active for backward compatibility.

```json
{
  "version": 1,
  "enabled": true,
  "official_alias": false,
  "generations": {
    "enabled": true,
    "multipart": false,
    "uploaded_image": false,
    "uploaded_mask": false,
    "max_n": 1,
    "max_image_urls": 0,
    "mask_url": false,
    "stream": false,
    "partial_images": false,
    "optional_fields": ["size", "resolution", "quality"],
    "allowed_values": {
      "resolution": ["1k", "2k", "4k"],
      "quality": ["low", "medium", "high"]
    }
  }
}
```

Endpoint keys are `generations`, `async_generations`, and `edits`. Omit an
endpoint or set `enabled: false` to disable it. `optional_fields` controls which
optional request fields the channel accepts; `"*"` accepts all currently known
fields. `allowed_values` and `denied_values` are case-insensitive.

After compatibility filtering, normal auto-cheapest routing selects the lowest
effective user price among the remaining channels.
