"""
脚本智能体 - 负责生成解题视频的脚本
直接使用视觉工具分析图片，无需中间层
"""
import json
import re
from typing import Dict, Any, Optional, List
from langchain_core.messages import HumanMessage, SystemMessage

from .base_agent import BaseAgent
from .state import ScriptStep, VideoProject
from .vision_tool import VisionTool


class ScriptAgent(BaseAgent):
    """脚本智能体"""

    SYSTEM_PROMPT = """你是一个专业的教育视频脚本作家，专门制作数学解题视频。

你的任务是根据数学题目（文字 + 图片分析），生成详细的视频脚本。

输出格式必须是严格的 JSON：
{
    "steps": [
        {
            "id": 1,
            "title": "步骤标题",
            "duration": 5.0,
            "narration": "旁白文案",
            "visual_cues": ["视觉元素 1", "视觉元素 2"],
            "on_screen_texts": [
                {
                    "text": "屏幕上展示的文字（可为描述性文字或公式）",
                    "kind": "description",
                    "target_area": "formula_area"
                }
            ]
        }
    ],
    "total_duration": 30.0
}"""

    def __init__(self, config: Dict[str, Any], llm: Optional[Any] = None,
                 vision_tool: Optional[VisionTool] = None):
        super().__init__(config, llm)
        self.system_prompt = config.get("system_prompt", self.SYSTEM_PROMPT)
        self.vision_tool = vision_tool

    def process(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        处理状态，生成脚本
        直接使用视觉工具分析图片
        """
        print("\n[ScriptAgent] 开始生成脚本...")

        project = state["project"]
        if getattr(project, "status", "") == "failed":
            return state
        problem_text = project.problem_text
        image_path = project.problem_image

        print(f"[ScriptAgent] 题目文字：{problem_text[:50] if problem_text else '无'}...")
        print(f"[ScriptAgent] 图片路径：{image_path}")

        # 构建提示词：优先使用 VisionAgent 产出的结构化图信息
        metadata = state.get("metadata", {})
        semantic_graph = metadata.get("semantic_graph") or metadata.get("scene_graph")
        drawable_scene = metadata.get("drawable_scene")
        geometry_graph = metadata.get("geometry_graph")
        adaptive_plan = metadata.get("adaptive_plan") if isinstance(metadata.get("adaptive_plan"), dict) else {}
        learner_profile = metadata.get("learner_profile") if isinstance(metadata.get("learner_profile"), dict) else {}

        semantic_graph_text = self._format_structured_geometry_for_prompt(semantic_graph)
        drawable_scene_text = self._format_structured_geometry_for_prompt(drawable_scene)
        geometry_graph_text = self._format_structured_geometry_for_prompt(geometry_graph)
        known_entities_text = ", ".join(self._collect_known_entities(semantic_graph, drawable_scene))
        adaptive_prompt = self._build_adaptive_prompt(adaptive_plan, learner_profile)

        # 回退路径：若结构化信息缺失，再调用视觉描述
        geometry_info = ""
        if not semantic_graph_text and image_path and self.vision_tool:
            geometry_info = self.vision_tool.describe_geometry(image_path)

        if semantic_graph_text or drawable_scene_text or geometry_graph_text or geometry_info:
            user_prompt = f"""请为以下数学题目生成视频脚本：

题目文字：{problem_text}

Semantic Graph（语义层，只表示实体和关系，不表示坐标真值）：
{semantic_graph_text}

Drawable Scene（绘图层；如果 layout_mode=schematic_fallback，则它只是示意布局）：
{drawable_scene_text}

Geometry Graph（节点/边关系图，辅助约束）：
{geometry_graph_text}

图形文字描述（仅兜底参考）：
{geometry_info}

请生成详细的视频脚本，包括解题步骤、旁白文案、视觉描述和屏幕展示文字。
要求：步骤中的视觉变化应围绕同一题图对象逐步推进，不要每一步都把整图重画。
当前已知可引用实体：{known_entities_text}"""
        else:
            user_prompt = f"""请为以下数学题目生成视频脚本：

题目：{problem_text}

请生成详细的视频脚本。"""

        if adaptive_prompt:
            user_prompt += f"""

    学情自适应策略（必须执行）：
    {adaptive_prompt}"""

        user_prompt += """

额外强约束：
1) 输出必须是严格 JSON，不要附加解释。
2) 每个步骤都要同时提供 narration（音频讲解）和 on_screen_texts（动画展示文字）。
3) on_screen_texts 中允许描述性文字，不仅是公式。
4) target_area 可用值：formula_area、geometry_area；默认使用 formula_area。
5) on_screen_texts 每步建议 1-3 条，单条尽量简洁。
6) 不要发明题图中不存在的新点、新线、新圆或新辅助对象；若确实需要构造新对象，必须在 narration 和 visual_cues 中明确写出“作.../构造...”。"""

        # 调用 LLM
        messages = self._format_messages(
            system_prompt=self.system_prompt,
            user_prompt=user_prompt
        )

        response_content = self._invoke_llm(messages)

        # 解析 JSON 响应
        script_data = self._parse_json_response(response_content)

        # 转换为 ScriptStep 对象
        script_steps = []
        for step_data in script_data.get("steps", []):
            on_screen_texts = self._normalize_on_screen_texts(step_data.get("on_screen_texts", []))
            step = ScriptStep(
                id=step_data["id"],
                title=step_data["title"],
                duration=step_data["duration"],
                narration=step_data["narration"],
                visual_cues=step_data.get("visual_cues", []),
                on_screen_texts=on_screen_texts,
            )
            script_steps.append(step)

        # 更新项目状态
        project.script_steps = script_steps
        project.total_duration = script_data.get("total_duration", 0.0)

        state["project"] = project
        state["current_step"] = "script_completed"
        state["messages"].append({
            "role": "assistant",
            "content": f"脚本生成完成，共 {len(script_steps)} 个步骤"
        })

        return state

    def _build_adaptive_prompt(self, adaptive_plan: Dict[str, Any], learner_profile: Dict[str, Any]) -> str:
        if not adaptive_plan:
            return ""

        mode = str(adaptive_plan.get("mode", "standard") or "standard")
        review_seconds = int(adaptive_plan.get("review_duration_seconds", 0) or 0)
        skip_basic = bool(adaptive_plan.get("skip_basic_definition", False))
        inject_challenge = bool(adaptive_plan.get("inject_challenge_variant", False))
        analogy_mode = bool(adaptive_plan.get("analogy_mode", False))
        analogy_domain = str(adaptive_plan.get("analogy_domain", "") or "").strip()

        weak_points: List[str] = []
        for item in adaptive_plan.get("review_points", []) or []:
            if not isinstance(item, dict):
                continue
            kp = str(item.get("knowledge", "")).strip()
            if kp:
                weak_points.append(kp)

        learner_grade = learner_profile.get("grade", "unknown")
        required_mastery_avg = self._safe_float(adaptive_plan.get("required_mastery_avg", 0.5), 0.5)
        prerequisite_mastery_avg = self._safe_float(adaptive_plan.get("prerequisite_mastery_avg", 0.5), 0.5)

        lines = [
            f"- 当前模式: {mode}",
            f"- 学生年级: {learner_grade}",
            f"- 目标知识平均掌握度: {required_mastery_avg:.2f}",
            f"- 前置知识平均掌握度: {prerequisite_mastery_avg:.2f}",
        ]

        if weak_points:
            lines.append(f"- 优先补齐薄弱点: {', '.join(weak_points)}")

        if mode == "remedial":
            lines.append(f"- 开头必须插入约 {max(20, review_seconds)}~40 秒前置复习，先讲薄弱前置再解题")
            lines.append("- 每步旁白更慢、更短句，关键结论重复一次")
            lines.append("- visual_cues 中加入明确视觉支架提示，例如：高亮辅助线/关键点闪烁/步骤编号")
        elif mode == "advanced":
            lines.append("- 跳过基础定义，直接进入解题结构、变式与迁移")
            lines.append("- 至少追加一个思维拔高点或反例提醒")
        else:
            lines.append("- 保持标准讲解节奏，关键步骤保留必要解释")

        if skip_basic:
            lines.append("- 避免重复基础概念定义")
        if inject_challenge:
            lines.append("- 在结尾加入一个简短变式挑战")

        if analogy_mode and analogy_domain:
            lines.append(f"- 优先采用 {analogy_domain} 类比来解释数学关系（不改变数学严谨性）")

        return "\n".join(lines)

    def _safe_float(self, value: Any, default: float) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    def _parse_json_response(self, response: str) -> Dict[str, Any]:
        """解析 LLM 返回的 JSON 响应"""
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            pass

        json_pattern = r'\{[\s\S]*\}'
        match = re.search(json_pattern, response)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass

        return {"steps": [], "total_duration": 0.0}

    def _format_structured_geometry_for_prompt(self, data: Optional[Dict[str, Any]]) -> str:
        """将结构化几何数据转为可读文本。"""
        if not data:
            return ""
        try:
            return json.dumps(data, ensure_ascii=False, indent=2)
        except Exception:
            return str(data)

    def _normalize_on_screen_texts(self, items: Any) -> List[Dict[str, str]]:
        """标准化 on_screen_texts，兼容字符串列表与对象列表。"""
        normalized: List[Dict[str, str]] = []
        if not isinstance(items, list):
            return normalized

        for item in items:
            if isinstance(item, str):
                text = item.strip()
                if not text:
                    continue
                normalized.append({
                    "text": text,
                    "kind": "description",
                    "target_area": "formula_area",
                })
                continue

            if not isinstance(item, dict):
                continue

            text = str(item.get("text", "")).strip()
            if not text:
                continue

            kind = str(item.get("kind", "description")).strip() or "description"
            target_area = str(item.get("target_area", "formula_area")).strip() or "formula_area"
            if target_area not in {"formula_area", "geometry_area"}:
                target_area = "formula_area"

            normalized.append({
                "text": text,
                "kind": kind,
                "target_area": target_area,
            })

        return normalized

    def _collect_known_entities(
        self,
        semantic_graph: Optional[Dict[str, Any]],
        drawable_scene: Optional[Dict[str, Any]],
    ) -> List[str]:
        entity_ids = set()
        for source in (semantic_graph or {}, drawable_scene or {}):
            points = source.get("points") or {}
            if isinstance(points, dict):
                entity_ids.update(str(item) for item in points.keys())
            elif isinstance(points, list):
                entity_ids.update(
                    str(item.get("id"))
                    for item in points
                    if isinstance(item, dict) and item.get("id")
                )

            for bucket in ("lines", "objects", "angles", "primitives"):
                for item in source.get(bucket, []) or []:
                    if isinstance(item, dict) and item.get("id"):
                        entity_ids.add(str(item.get("id")))

        return sorted(item for item in entity_ids if item)
