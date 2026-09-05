#!/usr/bin/env python3
"""
VChart 诊断 HTML 生成脚本

使用方式：
  python3 scripts/generate_diagnosis_html.py \\
    --title "诊断报告标题" \\
    --desc "诊断报告描述" \\
    --config-file config.js \\
    --output output/diagnosis.html

更多信息请查看: workflows/scenario-1-diagnosis.md
"""

from pathlib import Path
import argparse

def main():
    parser = argparse.ArgumentParser(description="Generate diagnosis HTML from template/diagnosis.html")
    parser.add_argument("--title", default="VChart 问题诊断报告", help="报告标题")
    parser.add_argument("--desc", default="基于用户配置的诊断与修复结果", help="报告描述")
    parser.add_argument("--config-file", help="包含 problemReview/diagnosis/solutions 的 JS 代码块文件路径")
    parser.add_argument("--output", default="output/diagnosis.html", help="输出 HTML 文件路径")
    args = parser.parse_args()

    template_path = Path("template/diagnosis.html")
    if not template_path.exists():
        raise FileNotFoundError(f"❌ 模板不存在: {template_path}\n💡 请确保在项目根目录运行脚本")

    html = template_path.read_text(encoding="utf-8")

    html = html.replace("{{REPORT_TITLE}}", args.title)
    html = html.replace("{{REPORT_DESC}}", args.desc)

    if args.config_file:
        config_path = Path(args.config_file)
        if not config_path.exists():
            raise FileNotFoundError(f"❌ 配置文件不存在: {config_path}")
        config_block = config_path.read_text(encoding="utf-8")
    else:
        config_block = """const problemReview = {
  highlightLines: [11],
  specCode: `const spec = {
  type: "bar",
  data: {
    values: [
      { category: "A", value: 10 },
      { category: "B", value: 20 },
      { category: "C", value: 15 }
    ]
  },
  xField: "category",
  yField: "values",
  label: { visible: true, formatter: (d) => d.value + "%" }
};`
};

const diagnosis = {
  problem: "图表 Y 轴没有数据显示，柱状图高度为 0",
  cause: "yField 配置值为 \\"values\\"，但数据字段名为 \\"value\\"",
  suggestion: "确保 xField/yField 与数据字段名严格一致"
};

const solutions = [
  {
    title: "修正字段映射",
    description: "将 yField 的值从 \\"values\\" 修正为 \\"value\\"，与数据字段名保持一致。",
    highlightLines: [11],
    specCode: `const spec = {
  type: "bar",
  data: {
    values: [
      { category: "A", value: 10 },
      { category: "B", value: 20 },
      { category: "C", value: 15 }
    ]
  },
  xField: "category",
  yField: "value",
  label: { visible: true }
};`
  }
];"""

    if "{{CONFIG_BLOCK}}" not in html:
      raise ValueError("❌ 模板中未找到 {{CONFIG_BLOCK}} 占位符\n💡 请检查模板文件: template/diagnosis.html")

    filled = html.replace("{{CONFIG_BLOCK}}", config_block)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(filled, encoding="utf-8")

    print(f"✅ 诊断 HTML 已生成: {output_path.resolve()}")
    print(f"📖 请在浏览器中打开以查看交互式诊断报告")

if __name__ == "__main__":
    main()
