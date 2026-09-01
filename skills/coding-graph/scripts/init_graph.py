#!/usr/bin/env python3
"""初始化需求图谱（coding-graph skill 的装配脚本，建图第一步）。

无参运行：`uv run python skills/coding-graph/scripts/init_graph.py`。一次执行完成装配
（执行通道为 gg-cli，接口只认局部引用 ref / 类型 code）：
  1. 身份初始化（env GG_USER/GG_BASE → 既有 base_info.json → 缺省），写 base_info.json；
  2. 清缓存（reset：清除 current_graph / instance_ids 局部引用表，仅保留身份）；
  3. 图谱不存在则创建（含 level / stage 维度字典，dims 创建后不可改）；
  4. 建 15 种对象类型 + 15 种关系类型 + 属性类型（幂等可重复）；
  5. `graph list` 取当前图谱的局部引用 gN → `use <gN>` 设为当前图谱并重建局部引用表；
  6. 输出**用户身份 + 当前图谱**的简洁报告。

Schema 定义见 skills/coding-graph/SKILL.md（§4 图谱模型）两层节点模型。

gg-cli 的临时信息会落在**当前运行目录**的 `.agents/growing-graph/`（gitignore），
因此请从 coding-graph 项目根目录运行本脚本。

用法（各参数均有缺省，通常直接无参运行）：
  uv run python skills/coding-graph/scripts/init_graph.py \
      [--graph 需求图谱] [--user <id>] [--base URL] [--gg-cli PATH]

gg-cli 定位（按优先级）：--gg-cli 参数 → 环境变量 GG_CLI → PATH 中的 `gg-cli` →
默认相对路径 `../../../../growing-graph/skills/growing-graph/scripts/gg-cli.py`
（假设 growing-graph 与 coding-graph 同在 D:/Develop 下）。
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys

# ---------------------------------------------------------------- Schema 定义（源自 SKILL.md / Schema 设计）
DIMS = [
    {"key": "level", "label": "层级", "values": [
        {"code": "textual", "label": "文本层"},
        {"code": "entity", "label": "实体层"},
    ]},
    {"key": "stage", "label": "阶段", "values": [
        {"code": "requirement", "label": "需求"},
        {"code": "design", "label": "设计"},
    ]},
]

# 对象类型：type（码）/ name（显示名）/ layer（所属层，写入 dim.level）
OBJECT_TYPES = [
    {"type": "goal",          "name": "目标",     "layer": "textual"},
    {"type": "feature",       "name": "功能",     "layer": "textual"},
    {"type": "behavior",      "name": "行为",     "layer": "textual"},
    {"type": "rule",          "name": "规则",     "layer": "textual"},
    {"type": "quality",       "name": "质量",     "layer": "textual"},
    {"type": "scenario",      "name": "场景",     "layer": "textual"},
    {"type": "reason",        "name": "原因",     "layer": "textual"},
    {"type": "strategy",      "name": "策略",     "layer": "textual"},
    {"type": "assumption",    "name": "假设",     "layer": "textual"},
    {"type": "actor",         "name": "角色",     "layer": "entity"},
    {"type": "action",        "name": "操作",     "layer": "entity"},
    {"type": "domain", "name": "领域", "layer": "entity"},
    {"type": "attribute",     "name": "属性",     "layer": "entity"},
    {"type": "condition",     "name": "条件",     "layer": "entity"},
    {"type": "event",         "name": "事件",     "layer": "entity"},
]

# 关系类型：type（码）/ name（显示名）
LINK_TYPES = [
    {"type": "motivated_by",    "name": "由…驱动"},
    {"type": "decomposes_into", "name": "拆分为"},
    {"type": "elaborates",      "name": "细化"},
    {"type": "specializes",     "name": "特化为"},
    {"type": "depends_on",      "name": "依赖"},
    {"type": "conflicts_with",  "name": "与…冲突"},
    {"type": "constrained_by",  "name": "受…约束"},
    {"type": "performs",        "name": "执行"},
    {"type": "targets",         "name": "作用于"},
    {"type": "has_attribute",   "name": "具有属性"},
    {"type": "applies_to",      "name": "应用于"},
    {"type": "involves",        "name": "涉及"},
    {"type": "operates_on",     "name": "操作对象"},
    {"type": "realizes",        "name": "实现为"},
    {"type": "triggered_by",    "name": "由…触发"},
]

# 属性类型：对象类型码 → [(属性键, 显示名)]（property 绑定对象类型）
PROPERTY_TYPES = {
    "goal":          [("priority", "优先级")],
    "feature":       [("priority", "优先级"), ("status", "状态")],
    "behavior":      [("trigger", "触发条件")],
    "rule":          [("severity", "严重度")],
    "quality":       [("metric", "指标"), ("target", "目标值")],
    "scenario":      [("priority", "优先级"), ("result", "结果")],
    "reason":        [("source", "来源")],
    "strategy":      [("scope", "适用范围")],
    "assumption":    [("confidence", "置信度")],
    "actor":         [("role", "角色")],
    "action":        [("input", "输入")],
    "domain": [("owner", "归属")],
    "attribute":     [("unit", "单位")],
    "condition":     [("severity", "严重度")],
    "event":         [("source", "来源")],
}

DEFAULT_GRAPH = "需求图谱"
DEFAULT_DESCRIPTION = "需求图谱：两层节点模型（文本层 9 类 / 实体层 6 类）+ 15 种关系类型。"

# 临时信息目录（与 gg-cli 共用，落在当前运行目录）
_GG_DIR = os.path.join(os.getcwd(), ".agents", "growing-graph")
BASE_INFO_FILE = os.path.join(_GG_DIR, "base_info.json")


def _default_ggcli() -> str | None:
    """定位 gg-cli：环境变量 → PATH → 两仓同目录默认相对路径。"""
    env = os.environ.get("GG_CLI")
    if env:
        return env
    which = shutil.which("gg-cli")
    if which:
        return which
    here = os.path.dirname(os.path.abspath(__file__))
    default = os.path.normpath(os.path.join(
        here, "..", "..", "..", "..",
        "growing-graph", "skills", "growing-graph", "scripts", "gg-cli.py"))
    if os.path.isfile(default):
        return default
    return None


def _require_ggcli(cli: str | None) -> str:
    if cli and os.path.isfile(cli):
        return cli
    if cli:
        raise SystemExit(f"gg-cli 不存在: {cli}")
    raise SystemExit(
        "未找到 gg-cli。请用 --gg-cli 指定路径，或设置 GG_CLI 环境变量，或把 growing-graph 放在本仓同级目录下。")


def _load_identity() -> dict:
    """读取既有身份（base_info.json）；无则空 dict。"""
    try:
        with open(BASE_INFO_FILE, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def run_gg(cli: str, argv: list[str], env: dict) -> dict:
    """调用 gg-cli（参数为 argv 数组，无 shell）；成功返回解析后的 JSON，失败抛错。"""
    proc = subprocess.run([sys.executable, cli, *argv],
                          capture_output=True, text=True, encoding="utf-8", env=env)
    if proc.returncode != 0:
        err = proc.stderr.strip() or proc.stdout.strip() or f"gg-cli 退出码 {proc.returncode}"
        raise SystemExit(err)
    try:
        return json.loads(proc.stdout)
    except ValueError:
        raise SystemExit(f"gg-cli 输出非 JSON: {proc.stdout[:200]}")


# ---------------------------------------------------------------- 类型字典装配
def _ensure_object_types(gg) -> None:
    existing = {it["type"] for it in gg(["schema", "object", "list", "{}"]).get("items", [])}
    items = [{"type": o["type"], "name": o["name"], "dim": {"level": o["layer"]}}
             for o in OBJECT_TYPES if o["type"] not in existing]
    if not items:
        print("      对象类型全部已存在，跳过。")
        return
    _create(gg, "object", items)
    print(f"      已建 {len(items)} 种对象类型（跳过已有 {len(OBJECT_TYPES) - len(items)} 种）。")


def _ensure_link_types(gg) -> None:
    existing = {it["type"] for it in gg(["schema", "link", "list", "{}"]).get("items", [])}
    items = [{"type": l["type"], "name": l["name"]}
             for l in LINK_TYPES if l["type"] not in existing]
    if not items:
        print("      关系类型全部已存在，跳过。")
        return
    _create(gg, "link", items)
    print(f"      已建 {len(items)} 种关系类型（跳过已有 {len(LINK_TYPES) - len(items)} 种）。")


def _ensure_property_types(gg) -> None:
    # 先取对象类型 id→码映射，才能用 (对象类型码, 属性键) 判重
    objs = gg(["schema", "object", "list", "{}"]).get("items", [])
    code_by_id = {it["id"]: it["type"] for it in objs}
    props = gg(["schema", "property", "list", "{}"]).get("items", [])
    existing = {(code_by_id.get(it.get("object_type_id")), it.get("type")) for it in props}
    items = [{"object_type_id": obj_code, "type": code, "name": name}
             for obj_code, list_ in PROPERTY_TYPES.items()
             for code, name in list_
             if (obj_code, code) not in existing]
    if not items:
        print("      属性类型全部已存在，跳过。")
        return
    _create(gg, "property", items)
    print(f"      已建 {len(items)} 个属性类型（跳过已有 "
          f"{sum(len(v) for v in PROPERTY_TYPES.values()) - len(items)} 个）。")


def _create(gg, kind: str, items: list[dict]) -> None:
    resp = gg(["schema", kind, "create", json.dumps(items, ensure_ascii=False)])
    failed = resp.get("failed") or []
    for f in failed:
        print(f"      ⚠ {f.get('type')} [{f.get('code')}] {f.get('detail')}")


def main() -> int:
    ap = argparse.ArgumentParser(
        prog="init_graph",
        description="初始化需求图谱（建图第一步：身份 + 清缓存 + 建图/类型字典 + use + 报告），执行通道为 gg-cli。",
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--graph", default=os.environ.get("GG_GRAPH") or DEFAULT_GRAPH,
                    help=f"图谱名（默认 {DEFAULT_GRAPH}）")
    ap.add_argument("--description", default=DEFAULT_DESCRIPTION, help="新建图谱的描述")
    ap.add_argument("--user", default=None, help="身份 user_id（缺省沿用既有 base_info / admin）")
    ap.add_argument("--base", default=None, help="growing-graph 后端地址（缺省沿用既有 / 127.0.0.1:3003）")
    ap.add_argument("--gg-cli", default=None, help="gg-cli.py 路径（缺省自动定位）")
    args = ap.parse_args()

    cli = _require_ggcli(args.gg_cli or _default_ggcli())
    env = dict(os.environ)
    env["PYTHONIOENCODING"] = "utf-8"
    gg = lambda argv: run_gg(cli, argv, env)

    # ---------------------------------------------------------- 1. 身份：env → 既有 base_info → 缺省
    info = _load_identity()
    user = os.environ.get("GG_USER") or args.user or info.get("user_id") or "admin"
    base = (os.environ.get("GG_BASE") or args.base or info.get("base") or "http://127.0.0.1:3003").rstrip("/")
    env["GG_USER"] = user
    env["GG_BASE"] = base
    print(f"[1/6] 身份 user={user} @ {base}")
    gg(["init", "--user", user, "--base", base])

    # ---------------------------------------------------------- 2. 清缓存（仅保留身份）
    gg(["reset"])
    print("[2/6] 已清缓存（current_graph / 局部引用表）")

    # ---------------------------------------------------------- 3. 图谱：查名 → 缺则创建（含 dims）
    print(f"[3/6] 图谱「{args.graph}」")
    items = gg(["graph", "list", "{}"]).get("items", [])
    found = next((g for g in items if g.get("name") == args.graph), None)
    if found:
        print("      已存在，复用（不重复创建 dims）。")
    else:
        payload = {"name": args.graph, "description": args.description, "dims": DIMS}
        gg(["graph", "create", json.dumps(payload, ensure_ascii=False)])
        items = gg(["graph", "list", "{}"]).get("items", [])
        found = next((g for g in items if g.get("name") == args.graph), None)
        print(f"      已创建（id={found['id']}，dims: level / stage）。")

    # ---------------------------------------------------------- 4. use（只认局部引用 ref）
    gref = found["id"]          # 局部引用 gN
    print(f"[4/6] use {gref}（{args.graph}）")
    gg(["use", gref])

    # ---------------------------------------------------------- 5. 类型字典：按码/键去重，缺则建
    print("[5/6] 类型字典")
    _ensure_object_types(gg)
    _ensure_link_types(gg)
    _ensure_property_types(gg)

    # ---------------------------------------------------------- 6. 报告：用户身份 + 当前图谱
    stat = gg(["schema", "stat", "{}"]).get("by_type", {})
    used = gg(["whoami"])
    print(f"\n[装配完成] 用户 {used.get('user_id')} @ {used.get('base')}")
    print(f"          当前图谱「{used.get('graph_name')}」({gref})："
          f"{stat.get('object', 0)} 对象类型 / {stat.get('link', 0)} 关系类型 / {stat.get('property', 0)} 属性类型")
    print(f"          局部引用 {used.get('refs')}")
    print("开始构建：听需求 → 每轮提取节点/关系 → `gg-cli instance object/link create`（数组）批量提交。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
