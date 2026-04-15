"""
Problem pattern classifier for geometry teaching pipeline.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List


class ProblemPatternClassifier:
    """Classify problem pattern before IR planning."""

    _SOLID_PATTERN = re.compile(r"立体|截面|三棱柱|四棱锥|圆锥|sphere|prism|section", re.IGNORECASE)
    _FOLD_PATTERN = re.compile(r"折叠|翻折|对折|镜像|fold|reflect", re.IGNORECASE)
    _DYNAMIC_PATTERN = re.compile(r"动点|轨迹|随.*变化|locus|moving point", re.IGNORECASE)
    _CIRCLE_PATTERN = re.compile(r"圆|弧|切线|半径|圆心|tangent|chord|circle", re.IGNORECASE)
    _SIMILARITY_PATTERN = re.compile(r"全等|相似|congruent|similar", re.IGNORECASE)
    _METRIC_PATTERN = re.compile(r"求.*长度|求.*面积|求.*周长|距离|面积|长度|perimeter|area|distance", re.IGNORECASE)
    _ROTATION_PATTERN = re.compile(r"旋转|rotation", re.IGNORECASE)
    _TRANSLATION_PATTERN = re.compile(r"平移|translation", re.IGNORECASE)

    def classify(self, *, problem_text: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
        text = str(problem_text or "")
        templates = self._collect_templates(metadata)

        pattern = "static_proof"
        sub_pattern = "direct_relation_proof"
        presentation_mode = "relation_first"
        reasoning_mode = "deduction_first"
        confidence = 0.62

        if self._SOLID_PATTERN.search(text):
            pattern = "solid_geometry_section"
            sub_pattern = "section_relation"
            presentation_mode = "structure_first"
            reasoning_mode = "projection_then_relation"
            confidence = 0.83
        elif self._FOLD_PATTERN.search(text) or "fold" in templates:
            pattern = "fold_transform"
            sub_pattern = self._fold_sub_pattern(text)
            presentation_mode = "transformation_first"
            reasoning_mode = "invariant_then_auxiliary"
            confidence = 0.9
        elif self._DYNAMIC_PATTERN.search(text):
            pattern = "dynamic_point"
            sub_pattern = "locus_tracking"
            presentation_mode = "motion_first"
            reasoning_mode = "constraint_then_locus"
            confidence = 0.84
        elif self._CIRCLE_PATTERN.search(text) or "circle" in templates:
            pattern = "circle_geometry"
            sub_pattern = "radius_chord_tangent"
            presentation_mode = "key_relation_first"
            reasoning_mode = "radius_tangent_then_similarity"
            confidence = 0.82
        elif self._SIMILARITY_PATTERN.search(text):
            pattern = "similarity_congruence"
            sub_pattern = "triangle_similarity"
            presentation_mode = "mapping_first"
            reasoning_mode = "construct_then_prove"
            confidence = 0.8
        elif self._METRIC_PATTERN.search(text):
            pattern = "metric_computation"
            sub_pattern = "length_area_computation"
            presentation_mode = "goal_first"
            reasoning_mode = "relation_then_compute"
            confidence = 0.72

        if self._ROTATION_PATTERN.search(text):
            sub_pattern = "rotation_transform"
        elif self._TRANSLATION_PATTERN.search(text):
            sub_pattern = "translation_transform"

        return {
            "pattern_version": "v1",
            "problem_pattern": pattern,
            "sub_pattern": sub_pattern,
            "presentation_mode": presentation_mode,
            "reasoning_mode": reasoning_mode,
            "confidence": round(confidence, 2),
        }

    def _collect_templates(self, metadata: Dict[str, Any]) -> List[str]:
        geometry_spec = metadata.get("geometry_spec") if isinstance(metadata.get("geometry_spec"), dict) else {}
        geometry_facts = metadata.get("geometry_facts") if isinstance(metadata.get("geometry_facts"), dict) else {}
        templates = []
        for token in (geometry_spec.get("templates") or geometry_facts.get("templates") or []):
            text = str(token).strip().lower()
            if text:
                templates.append(text)
        return templates

    def _fold_sub_pattern(self, text: str) -> str:
        lowered = text.lower()
        if "距离" in text or "distance" in lowered:
            return "fold_point_to_point_distance"
        if "垂线" in text or "perpendicular" in lowered:
            return "fold_with_perpendicular_construction"
        if "相似" in text or "similar" in lowered or "全等" in text or "congruent" in lowered:
            return "fold_then_similarity"
        if "面积" in text or "area" in lowered:
            return "fold_then_area"
        return "fold_transform_generic"
