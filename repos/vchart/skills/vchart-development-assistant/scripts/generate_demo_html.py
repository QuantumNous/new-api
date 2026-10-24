#!/usr/bin/env python3
"""
VChart 示例 HTML 生成脚本

使用方式：
  python3 scripts/generate_demo_html.py \\
    --title "图表示例标题" \\
    --desc "图表示例描述" \\
    --feature "主要功能说明" \\
    --tips "编辑提示" \\
    --spec-file spec.js \\
    --output output/demo.html

更多信息请查看: workflows/scenario-2-generation.md
"""

from pathlib import Path
import argparse
import sys

def escape_js_string(s: str) -> str:
    """转义 JavaScript 字符串中的特殊字符"""
    s = s.replace("\\", "\\\\")
    s = s.replace("`", "\\`")
    s = s.replace("\n", "\\n")
    return s

def validate_spec_code(spec_code: str) -> bool:
    """验证 spec 代码基本格式"""
    # 检查是否包含基本的 spec 结构
    if "const spec" not in spec_code and "let spec" not in spec_code and "var spec" not in spec_code:
        return False
    if "type:" not in spec_code:
        return False
    return True

def main():
    try:
        parser = argparse.ArgumentParser(
            description="Generate demo HTML from template/demo.html",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
示例：
  # 使用自定义 spec 文件
  python3 scripts/generate_demo_html.py --spec-file my-spec.js --output demo.html

  # 完整参数
  python3 scripts/generate_demo_html.py \\
    --title "柱状图示例" \\
    --desc "基础柱状图配置" \\
    --spec-file spec.js \\
    --output output/demo.html
            """
        )
        parser.add_argument("--title", default="VChart 图表示例", help="页面标题")
        parser.add_argument("--desc", default="基于需求生成的可运行图表配置", help="页面描述")
        parser.add_argument("--feature", default="补充主要功能说明", help="主要功能说明")
        parser.add_argument("--tips", default="补充编辑提示", help="编辑提示")
        parser.add_argument("--spec-file", help="包含完整 spec 代码的文件路径")
        parser.add_argument("--output", default="output/demo.html", help="输出 HTML 文件路径")
        parser.add_argument("--validate", action="store_true", help="验证 spec 代码格式")
        args = parser.parse_args()

        # 检查模板文件
        template_path = Path("template/demo.html")
        if not template_path.exists():
            print(f"❌ 错误: 模板文件不存在: {template_path}", file=sys.stderr)
            print(f"💡 提示: 请确保在 skills/vchart-development-assistant 目录运行脚本", file=sys.stderr)
            sys.exit(1)

        html = template_path.read_text(encoding="utf-8")
        html = html.replace("{{REPORT_TITLE}}", args.title)
        html = html.replace("{{REPORT_DESC}}", args.desc)
        html = html.replace("{{FEATURE_DESC}}", args.feature)
        html = html.replace("{{EDIT_TIPS}}", args.tips)

        # 读取或使用默认 spec
        if args.spec_file:
            spec_path = Path(args.spec_file)
            if not spec_path.exists():
                print(f"❌ 错误: Spec 文件不存在: {spec_path}", file=sys.stderr)
                sys.exit(1)

            spec_code = spec_path.read_text(encoding="utf-8")

            # 验证 spec 代码格式
            if args.validate and not validate_spec_code(spec_code):
                print(f"⚠️  警告: Spec 代码格式可能不正确", file=sys.stderr)
                print(f"   请确保包含 'const spec = {{...}}' 和 'type: \"...\"'", file=sys.stderr)
        else:
            # 使用内置示例
            spec_code = """const spec = {
  type: "line",
  data: {
    values: [
      { time: "2:00", value: 8 },
      { time: "4:00", value: 9 },
      { time: "6:00", value: 11 },
      { time: "8:00", value: 14 },
      { time: "10:00", value: 16 }
    ]
  },
  xField: "time",
  yField: "value"
};"""
            print(f"ℹ️  使用内置示例 spec", file=sys.stderr)

        # 转义 spec 代码供 JavaScript 字符串使用
        initial_code_escaped = escape_js_string(spec_code.strip())

        # 填充 spec 和 initialCode 模板变量
        html = html.replace("{{SPEC_CODE}}", spec_code)
        html = html.replace("{{INITIAL_CODE}}", initial_code_escaped)

        # 检查模板占位符是否都被替换
        if "{{SPEC_CODE}}" in html or "{{INITIAL_CODE}}" in html:
            print(f"❌ 错误: 模板占位符替换失败", file=sys.stderr)
            print(f"💡 提示: 请检查模板文件: {template_path}", file=sys.stderr)
            sys.exit(1)

        # 创建输出目录并写入文件
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(html, encoding="utf-8")

        print(f"✅ 示例 HTML 已生成: {output_path.resolve()}")
        print(f"📖 请在浏览器中打开以查看交互式图表")

    except FileNotFoundError as e:
        print(f"❌ 文件错误: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"❌ 未知错误: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()