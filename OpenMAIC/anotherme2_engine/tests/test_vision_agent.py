import json
import sys
import types
import unittest


langchain_core_module = types.ModuleType("langchain_core")
langchain_core_messages = types.ModuleType("langchain_core.messages")


class _DummyMessage:
    def __init__(self, content=None):
        self.content = content


langchain_core_messages.HumanMessage = _DummyMessage
langchain_core_messages.SystemMessage = _DummyMessage
langchain_core_module.messages = langchain_core_messages
sys.modules.setdefault("langchain_core", langchain_core_module)
sys.modules.setdefault("langchain_core.messages", langchain_core_messages)

from agents.vision_agent import VisionAgent
from agents.geometry_fact_compiler import GeometryFactCompiler
from agents.coordinate_scene import CoordinateSceneCompiler


class VisionAgentTests(unittest.TestCase):
    def setUp(self) -> None:
        self.agent = VisionAgent(config={"output_dir": "./output_test"})
        self.fact_compiler = GeometryFactCompiler()
        self.scene_compiler = CoordinateSceneCompiler()

    def test_parse_json_like_output_handles_inline_comments(self) -> None:
        raw = """
{
  "problem_text": "demo",
  "geometry_facts": {
    "points": ["A", "B"], // comment
    "segments": ["AB",], 
    "relations": [
      {"type": "point_on_segment", "point": "A", "segment": "AB"}, // trailing
    ]
  }
}
"""
        parsed = self.agent._parse_json_like_output(raw, {"problem_text": "", "geometry_facts": {}})
        self.assertEqual(parsed["problem_text"], "demo")
        self.assertEqual(parsed["geometry_facts"]["segments"], ["AB"])

    def test_sanitize_geometry_facts_drops_unlabeled_and_keeps_fold_core(self) -> None:
        facts = {
            "confidence": 0.95,
            "points": ["A", "B", "C", "D", "E", "B′", "C′"],
            "segments": ["AB", "BC", "CD", "DA", "DE", "BE", "EB′", "B′C′", "C′D", "AE"],
            "polygons": ["ABCD", "AB′C′D", "BEB′"],
            "angles": [{"vertex": "B", "sides": ["AB", "BC"], "name": "∠ABC"}],
            "right_angles": [{"vertex": "E", "sides": ["BE", "EB′"], "description": "∠BEB′ = 90°"}],
            "relations": [
                {"type": "point_on_segment", "point": "E", "segment": "AB"},
                {"type": "perpendicular", "lines": ["BE", "EB′"]},
                {"type": "equal_length", "segments": ["DB", "DB′"]},
                {"type": "intersect", "lines": ["DE", "BB′"], "point": "F"},
            ],
            "measurements": [
                {"type": "length", "segment": "AD", "value": 5},
                {"type": "angle", "vertex": "B", "value": "arctan(2) is not angle B; tan B = 2 means tan(∠ABC) = 2"},
                {"type": "angle", "angle": "∠BEB′", "value": 90},
            ],
        }
        problem_text = "在菱形ABCD中，AD=5，tanB=2，E是AB上一点，将菱形ABCD沿DE折叠，使B、C的对应点分别是B′、C′，当∠BEB′=90°时"
        sanitized = self.agent._sanitize_geometry_facts(facts, problem_text=problem_text)

        self.assertIn("B'", sanitized["points"])
        self.assertIn("C'", sanitized["points"])
        self.assertTrue(any(item.get("segment") == "AD" for item in sanitized["measurements"] if item.get("type") == "length"))
        self.assertTrue(any(item.get("angle") in {"∠B", "∠ABC"} for item in sanitized["measurements"] if item.get("type") == "angle"))
        self.assertFalse(any(item.get("point") == "F" for item in sanitized["relations"]))

    def test_stabilized_fold_bundle_compiles_to_valid_coordinate_scene(self) -> None:
        raw_bundle = {
            "problem_text": "题1 如图，在菱形ABCD中，AD=5，tanB=2，E是AB上一点，将菱形ABCD沿DE折叠，使B、C的对应点分别是B′、C′，当∠BEB′=90°时",
            "geometry_facts": {
                "confidence": 0.95,
                "points": ["A", "B", "C", "D", "E", "B′", "C′"],
                "segments": ["AB", "BC", "CD", "DA", "DE", "BE", "EB′", "B′C′", "C′D", "AE"],
                "polygons": ["ABCD", "AB′C′D"],
                "angles": [{"vertex": "B", "sides": ["AB", "BC"], "label": "∠B"}],
                "right_angles": [{"vertex": "E", "sides": ["BE", "EB′"], "description": "∠BEB′ = 90°"}],
                "relations": [
                    {"type": "point_on_segment", "point": "E", "segment": "AB"},
                    {"type": "collinear", "points": ["A", "E", "B"]},
                ],
                "measurements": [
                    {"type": "length", "segment": "AD", "value": 5},
                    {"type": "angle", "angle": "∠B", "value": "arctan(2)"},
                ],
            },
        }

        stabilized = self.agent._stabilize_problem_bundle(raw_bundle, image_path=__file__)
        geometry_spec = self.fact_compiler.compile(
            stabilized["geometry_facts"],
            problem_text=stabilized["problem_text"],
        )
        normalized = self.scene_compiler.normalize_geometry_spec(geometry_spec)
        scene = self.scene_compiler.compile(normalized)
        report = self.scene_compiler.validate_coordinate_scene(scene)

        self.assertTrue(report["is_valid"], report["failed_checks"])
        point_lookup = {item["id"]: item["coord"] for item in report["resolved_scene"]["points"]}
        self.assertIn("B1", point_lookup)
        self.assertIn("C1", point_lookup)
        self.assertIn("E", point_lookup)

    def test_sanitize_geometry_facts_preserves_circle_and_arc_content(self) -> None:
        facts = {
            "points": ["A", "B", "C"],
            "circles": [
                {"id": "circle_O", "center": "O", "points_on_circle": ["A", "B", "C"]}
            ],
            "arcs": [
                {"id": "arc_AB", "circle": "circle_O", "points": ["A", "B"]}
            ],
            "relations": [
                {"type": "point_on_circle", "entities": ["C", "circle_O"]}
            ],
            "measurements": [
                {"type": "length", "entities": ["A", "B"], "value": 4}
            ],
        }

        sanitized = self.agent._sanitize_geometry_facts(
            facts,
            problem_text="在⊙O中，AB=4，点C在⊙O上，弧AB所对的圆周角为锐角",
        )
        self.assertTrue(any(item.get("center") == "O" for item in sanitized["circles"]))
        self.assertTrue(any(item.get("circle") == "circle_O" for item in sanitized["arcs"]))
        self.assertIn("O", sanitized["points"])

        geometry_spec = self.fact_compiler.compile(
            sanitized,
            problem_text="在⊙O中，AB=4，点C在⊙O上",
        )

        primitive_types = {str(item.get("type", "")).lower() for item in geometry_spec.get("primitives", [])}
        self.assertIn("circle", primitive_types)
        self.assertIn("arc", primitive_types)
        self.assertTrue(
            any(
                str(item.get("type", "")).lower() == "point_on_circle"
                for item in geometry_spec.get("constraints", [])
            )
        )

    def test_sanitize_keeps_angle_entities_and_label_defined_angle(self) -> None:
        facts = {
            "points": ["A", "B", "C"],
            "angles": [{"label": "∠ABC"}],
            "measurements": [{"type": "angle", "entities": ["A", "B", "C"], "value": 60}],
        }

        sanitized = self.agent._sanitize_geometry_facts(
            facts,
            problem_text="在三角形ABC中，∠ABC=60°",
        )
        self.assertTrue(any(item.get("vertex") == "B" for item in sanitized["angles"]))
        self.assertTrue(
            any(
                item.get("type") == "angle" and item.get("entities") == ["A", "B", "C"]
                for item in sanitized["measurements"]
            )
        )

        geometry_spec = self.fact_compiler.compile(sanitized, problem_text="在三角形ABC中，∠ABC=60°")
        self.assertTrue(
            any(
                item.get("type") == "angle" and item.get("entities") == ["A", "B", "C"]
                for item in geometry_spec.get("measurements", [])
            )
        )

    def test_rhombus_equal_length_relations_are_pairwise(self) -> None:
        sanitized = self.agent._sanitize_geometry_facts(
            {"points": ["A", "B", "C", "D"]},
            problem_text="在菱形ABCD中，求证对角线互相垂直",
        )

        equal_relations = [
            item
            for item in sanitized.get("relations", [])
            if str(item.get("type", "")).lower() == "equal_length"
        ]
        self.assertGreaterEqual(len(equal_relations), 3)
        self.assertTrue(all(len(item.get("segments", [])) == 2 for item in equal_relations))


if __name__ == "__main__":
    unittest.main()
