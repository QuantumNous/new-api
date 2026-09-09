# 图片参数不符合请求的核对记录

这是修改前的历史核对记录。后台 JSON 图生图和两种参考图结构适配现已发布，当前行为见 [API 图片后台任务](image-tasks.md)；用户后续要求保留原生图片与原样尺寸，裁剪/转码草稿未发布且已移除。

用户截图的 created=1788926141 对应北京时间 2026-09-09 11:55:41，匹配任务 `75c64a31-6db9-4725-a290-32a693fc09d9`，渠道 2“我的CPA”。保存结果为 PNG、1254x1254、quality=low。同批任务 `0ae84fab-15af-4a7e-8921-d529b7e9b038` 走渠道 1 GoEasy，结果 PNG、1086x1448、quality=null。

两个渠道的 param_override 均为空。中转 ImageRequest 定义并保留 size、quality、output_format、output_compression、images。回归用例已改为用户截图的 size=960x1280、output_format=jpeg、output_compression=100、quality=low，完整走任务保存、后台派发、OpenAI 适配器后，模拟上游收到四个字段均与请求一致，测试通过。成功任务的原始请求文件已按原逻辑清理，因此没有将这项模拟验证冒称为该历史请求的网络抓包。

CPA 主机代码 `/opt/cliproxyapi/internal/runtime/executor/codex_openai_images.go` 中，生成和编辑转换器均将这四个字段加入 image_generation tool；但生成转换器使用 nil 参考图构造 Responses 请求，编辑转换器才读取 `images[].image_url`。

客户端截图 `images: [Blob]` 存在独立问题：JavaScript `JSON.stringify({images:[new Blob(...)]})` 实际生成 `{"images":[{}]}`，不包含图片字节。要传递参考图，需要正确编码为数据 URL 或上传文件，并使用上游支持的编辑请求路径。当前任务接口只支持 JSON 生成，没有实现 JSON edits 任务；不能仅把 Blob 放进 images 就声称已支持图生图。

截图请求 quality=low，结果也为 low，这张图不能证明 quality 字段被丢弃。output_compression 控制输出压缩，与模型生成质量不是同一个参数，100 不会把 quality=low 自动变成 high。

下一步选择：先修参考图序列化和任务编辑路径；若要求最终文件严格为 JPEG/指定像素，需要真实转码和尺寸处理，比例不同应由用户选择保留原生结果、等比补边或等比裁剪。不能只改返回 JSON 的 format/size，也不能把后处理声称为模型原生遵循生成参数。

本次仅做代码、结果和配置核对及无收费上游的回归验证，没有修改线上图片内容或参数配置。
