import unittest

from agents.scene_graph_updater import SceneGraphUpdater
from agents.state import ScriptStep
from agents.teaching_ir import TeachingIRPlanner


class TeachingIRTests(unittest.TestCase):
    def setUp(self) -> None:
        self.planner = TeachingIRPlanner()

    def _metadata(self):
        return {
            "drawable_scene": {
                "points": [
                    {"id": "A", "coord": [0.0, 0.0]},
                    {"id": "B", "coord": [2.0, 0.0]},
                    {"id": "C", "coord": [2.0, 1.0]},
                    {"id": "D", "coord": [0.0, 1.0]},
                    {"id": "E", "coord": [1.0, 0.0]},
                    {
                        "id": "B1",
                        "coord": [0.0, 0.0],
                        "derived": {"type": "reflect_point", "source": "B", "axis": ["D", "E"]},
                    },
                ],
                "primitives": [
                    {"id": "seg_AB", "type": "segment", "points": ["A", "B"]},
                    {"id": "seg_BC", "type": "segment", "points": ["B", "C"]},
                    {"id": "seg_CD", "type": "segment", "points": ["C", "D"]},
                    {"id": "seg_DA", "type": "segment", "points": ["D", "A"]},
                    {"id": "seg_DE", "type": "segment", "points": ["D", "E"]},
                    {"id": "poly_ABCD", "type": "polygon", "points": ["A", "B", "C", "D"]},
                ],
            },
            "geometry_spec": {"templates": ["fold"]},
            "geometry_facts": {"points": ["A", "B", "C", "D", "E"], "segments": ["DE"]},
        }

    def test_build_geometry_ir_detects_fold_axis_and_images(self) -> None:
        geometry_ir = self.planner.build_geometry_ir(
            metadata=self._metadata(),
            problem_text="在菱形ABCD中，沿 DE 折叠，B 的对应点为 B'",
        )

        self.assertEqual(geometry_ir["problem_type"], "fold_transform")
        self.assertEqual(geometry_ir["transform"]["fold_axis"], "seg_DE")
        self.assertTrue(any(item.get("image") == "B1" for item in geometry_ir["transform"]["image_pairs"]))

    def test_build_teaching_ir_generates_fold_and_auxiliary_actions(self) -> None:
        geometry_ir = self.planner.build_geometry_ir(
            metadata=self._metadata(),
            problem_text="沿DE折叠后，求像点到 BC 的距离",
        )

        steps = [
            ScriptStep(
                id=1,
                title="识别条件",
                duration=2.0,
                narration="先读图并标出折叠轴 DE。",
                visual_cues=["高亮 DE"],
            ),
            ScriptStep(
                id=2,
                title="执行折叠",
                duration=3.0,
                narration="沿 DE 折叠，得到像点，再求点到 BC 的距离。",
                visual_cues=["折叠", "距离"],
            ),
        ]

        teaching_ir = self.planner.build_teaching_ir(
            steps=steps,
            geometry_ir=geometry_ir,
            metadata=self._metadata(),
            problem_text="沿DE折叠后，求像点到 BC 的距离",
        )

        step_two = teaching_ir["steps"][1]
        action_names = [item.get("action") for item in step_two["actions"]]
        self.assertIn("animate_fold", action_names)
        self.assertIn("draw_perpendicular_auxiliary", action_names)

    def test_build_teaching_ir_does_not_emit_fold_actions_without_axis(self) -> None:
        metadata = self._metadata()
        metadata["geometry_spec"] = {"templates": ["fold"]}

        geometry_ir = self.planner.build_geometry_ir(
            metadata=metadata,
            problem_text="在该图中分析关系并计算长度。",
        )
        self.assertEqual(geometry_ir["transform"]["fold_axis"], "")

        steps = [
            ScriptStep(
                id=1,
                title="分析关系",
                duration=2.0,
                narration="先观察图形关系，不做折叠。",
                visual_cues=["高亮 AB"],
            ),
            ScriptStep(
                id=2,
                title="计算长度",
                duration=2.0,
                narration="根据已知关系计算。",
                visual_cues=["距离"],
            ),
        ]

        teaching_ir = self.planner.build_teaching_ir(
            steps=steps,
            geometry_ir=geometry_ir,
            metadata=metadata,
            problem_text="在该图中分析关系并计算长度。",
        )
        action_names = [
            item.get("action")
            for step in teaching_ir["steps"]
            for item in step.get("actions", [])
        ]

        self.assertNotIn("animate_fold", action_names)
        self.assertNotIn("create_image_point", action_names)

    def test_scene_graph_updater_maps_teaching_actions_to_operations(self) -> None:
        updater = SceneGraphUpdater()
        base_scene = self._metadata()["drawable_scene"]
        step = ScriptStep(
            id=2,
            title="执行折叠",
            duration=2.0,
            narration="沿 DE 折叠并高亮关系。",
            visual_cues=["折叠"],
        )
        teaching_step = {
            "step_id": 2,
            "focus_targets": ["seg_DE", "B"],
            "actions": [
                {"action": "highlight_fold_axis", "axis": "seg_DE"},
                {"action": "animate_fold", "axis": "seg_DE", "targets": ["B"]},
            ],
        }

        step_scene = updater.build_step_scene(
            base_scene_graph=base_scene,
            step=step,
            step_index=2,
            teaching_step=teaching_step,
        )

        operations = step_scene["operations"]
        self.assertTrue(any(item.get("type") == "highlight" for item in operations))
        self.assertTrue(
            any(
                item.get("type") == "transform" and item.get("axis") == "seg_DE"
                for item in operations
            )
        )


if __name__ == "__main__":
    unittest.main()
