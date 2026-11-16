# Additional channel setting instructions

This configuration is used to set some additional channel parameters and can be configured through a JSON object. It mainly includes the following three setting items:

1. force_format
- Used to identify whether the data is forced to be formatted into OpenAI format
- Type is boolean, set to true to enable forced formatting

2. proxy
- Used to configure network proxy
- Type is string, supports `http`, `https`, `socks5` and `socks5h` protocols
- Protocol and host must be included when saving; only empty path or root path `/` is allowed, no query or fragment is allowed
- When the SOCKS proxy does not fill in the port, the default port `1080` is used when running.

3. thinking_to_content
- Used to identify whether to convert the thinking content `reasoning_content` into the `<think>` tag and splice it into the content and return it
- Type is boolean, when set to true enables thinking content conversion

--------------------------------------------------------------

## JSON format example

The following is an example configuration with force formatting enabled and the proxy address set:

```json
{
    "force_format": true,
    "thinking_to_content": true,
    "proxy": "socks5://proxy.example:1080"
}
```

--------------------------------------------------------------

By adjusting the values in the JSON configuration above, you can flexibly control additional behavior of the channel, such as whether to format and use specific web proxies.

## Upgrade compatibility

Older versions ignore path, query, and fragment in proxy addresses. To avoid disrupting existing channel traffic after the upgrade, the runtime will continue to strip these legacy suffixes and log a warning without credentials and suffixes for each process for the same proxy address. This compatibility logic will not rewrite the database; when saving the channel again, the proxy address must be corrected according to the strict rules mentioned above.

Proxy connections use a 30 second TCP dial timeout and a 30 second KeepAlive; the TLS handshake timeout is 10 seconds. These timeouts also apply to transit requests without a channel proxy configured.
