"""
Vision agent: single-pass OCR + geometry-spec extraction.
"""

import base64
import copy
import json
import math
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .base_agent import BaseAgent
from .coordinate_scene import CoordinateSceneCompiler, CoordinateSceneError
from .geometry_fact_compiler import GeometryFactCompiler
from .graph_builder import GeometryGraph
from .scene_graph import SceneGraph
try:
    from output_paths import DEFAULT_OUTPUT_DIR
except ModuleNotFoundError:
    from anotherme2_engine.output_paths import DEFAULT_OUTPUT_DIR


class VisionAgent(BaseAgent):
    """Extract problem text and structural geometry information from an image."""

    SYSTEM_PROMPT = (
        "You are an expert math-geometry vision model. "
        "Do OCR accurately, then extract geometry entities, relations, and measurements. "
        "Never invent coordinates unless explicitly asked."
    )

    def __init__(self, config: Dict[str, Any], llm: Optional[Any] = None):
        super().__init__(config, llm)
        self.system_prompt = config.get("system_prompt", self.SYSTEM_PROMPT)
        self.output_dir = config.get("output_dir", str(DEFAULT_OUTPUT_DIR))
        self.export_ggb = bool(config.get("export_ggb", True))
        self.geometry_fact_compiler = GeometryFactCompiler()
        self.coordinate_scene_compiler = CoordinateSceneCompiler()

    def process(self, state: Dict[str, Any]) -> Dict[str, Any]:
        project = state["project"]
        image_path = project.problem_image

        if not image_path or not Path(image_path).exists():
            project.status = "failed"
            project.error_message = "Problem image does not exist."
            state["project"] = project
            state["current_step"] = "vision_failed"
            state["messages"].append({"role": "assistant", "content": project.error_message})
            return state

        metadata = state.setdefault("metadata", {})
        geometry_file = project.geometry_file or metadata.get("geometry_file")
        export_ggb = bool(
            metadata.get(
                "export_ggb",
                project.export_ggb if project.export_ggb is not None else self.export_ggb,
            )
        )

        bundle = self._analyze_problem_bundle(image_path)
        if self._bundle_is_effectively_empty(bundle):
            bundle = self._recover_problem_bundle(image_path, bundle)
        bundle = self._stabilize_problem_bundle(bundle, image_path=image_path)
        problem_text = project.problem_text or str(bundle.get("problem_text", "")).strip()
        raw_geometry_facts = bundle.get("geometry_facts")
        legacy_geometry_spec = bundle.get("geometry_spec")
        geometry_facts = (
            raw_geometry_facts
            if isinstance(raw_geometry_facts, dict)
            else legacy_geometry_spec
            if isinstance(legacy_geometry_spec, dict)
            else {}
        )
        geometry_spec = self._compile_geometry_spec(
            geometry_facts,
            problem_text=problem_text,
        )
        if not problem_text and not self._geometry_facts_have_content(geometry_facts):
            project.status = "failed"
            project.error_message = (
                "Vision extraction returned empty OCR text and empty geometry facts. "
                "Please verify the input image or provide --problem text."
            )
            metadata["problem_bundle"] = bundle
            metadata["geometry_facts"] = geometry_facts
            metadata["geometry_spec"] = geometry_spec
            state["project"] = project
            state["current_step"] = "vision_failed"
            state["messages"].append({"role": "assistant", "content": project.error_message})
            return state
        project.problem_text = problem_text
        metadata["problem_bundle"] = bundle
        metadata["geometry_facts"] = geometry_facts
        metadata["geometry_spec"] = geometry_spec

        normalized_spec: Optional[Dict[str, Any]] = None
        geometry_spec_validation: Dict[str, Any] = {
            "is_valid": True,
            "failed_checks": [],
            "missing_entities": [],
            "unsupported_relations": [],
            "solver_trace": [],
        }
        coordinate_scene: Optional[Dict[str, Any]] = None
        coordinate_scene_validation: Optional[Dict[str, Any]] = None

        try:
            if geometry_file:
                coordinate_scene = self.coordinate_scene_compiler.load_from_file(geometry_file)
                coordinate_scene_validation = self.coordinate_scene_compiler.validate_coordinate_scene(
                    coordinate_scene
                )
                metadata["auto_geometry_status"] = "success"
            else:
                normalized_spec = self.coordinate_scene_compiler.normalize_geometry_spec(
                    geometry_spec
                )
                geometry_spec_validation = {
                    "is_valid": bool(normalized_spec.get("points"))
                    and bool(normalized_spec.get("primitives")),
                    "failed_checks": [],
                    "missing_entities": [],
                    "unsupported_relations": [],
                    "solver_trace": [],
                }
                coordinate_scene = self.coordinate_scene_compiler.solve_coordinate_scene(
                    normalized_spec
                )
                coordinate_scene_validation = self.coordinate_scene_compiler.validate_coordinate_scene(
                    coordinate_scene,
                    normalized_spec,
                )
                metadata["auto_geometry_status"] = (
                    "success" if coordinate_scene_validation["is_valid"] else "invalid"
                )
                if not coordinate_scene_validation["is_valid"]:
                    raise CoordinateSceneError(
                        self.coordinate_scene_compiler._validation_error_message(
                            coordinate_scene_validation
                        )
                    )
        except CoordinateSceneError as exc:
            if not geometry_file:
                try:
                    normalized_spec = normalized_spec or self.coordinate_scene_compiler.normalize_geometry_spec(
                        geometry_spec
                    )
                except Exception:
                    normalized_spec = None

            metadata["normalized_geometry_spec"] = normalized_spec
            metadata["geometry_spec_validation"] = geometry_spec_validation
            metadata["coordinate_scene_validation"] = coordinate_scene_validation or {
                "is_valid": False,
                "failed_checks": [{"type": "compile", "message": str(exc)}],
                "missing_entities": [],
                "unsupported_relations": [],
                "solver_trace": [],
            }
            metadata["auto_geometry_status"] = metadata.get("auto_geometry_status", "unsupported")
            metadata["debug_exports"] = self.coordinate_scene_compiler.write_debug_exports(
                coordinate_scene=None,
                output_dir=self.output_dir,
                export_ggb=export_ggb,
                extra_payloads={
                    "problem_bundle": bundle,
                    "geometry_facts": geometry_facts,
                    "geometry_spec": geometry_spec,
                    "normalized_geometry_spec": normalized_spec,
                    "geometry_spec_validation": geometry_spec_validation,
                    "coordinate_scene_validation": metadata["coordinate_scene_validation"],
                },
            )

            if geometry_file:
                project.status = "failed"
                project.error_message = (
                    "Geometry file validation failed; stopping the workflow. "
                    f"geometry_file={geometry_file}. Details: {exc}"
                )
                state["project"] = project
                state["current_step"] = "vision_failed"
                state["messages"].append({"role": "assistant", "content": project.error_message})
                return state

            semantic_graph = self._build_semantic_graph(
                normalized_spec or geometry_spec
            )
            drawable_scene = self._build_schematic_drawable_scene(
                normalized_spec or geometry_spec
            )
            fallback_geometry_graph = self._build_geometry_graph_payload(
                drawable_scene
            )

            metadata["coordinate_scene"] = None
            metadata["coordinate_scene_validation"] = metadata["coordinate_scene_validation"]
            metadata["semantic_graph"] = semantic_graph
            metadata["semantic_graph_json"] = json.dumps(
                semantic_graph, ensure_ascii=False
            )
            metadata["drawable_scene"] = drawable_scene
            metadata["drawable_scene_json"] = json.dumps(
                drawable_scene, ensure_ascii=False
            )
            metadata["scene_graph"] = semantic_graph
            metadata["scene_graph_json"] = metadata["semantic_graph_json"]
            metadata["geometry_graph"] = fallback_geometry_graph
            metadata["geometry_graph_json"] = json.dumps(
                fallback_geometry_graph, ensure_ascii=False
            )
            metadata["semantic_graph_source"] = "normalized_geometry_spec_fallback"
            metadata["drawable_scene_source"] = "schematic_from_normalized_geometry_spec"
            metadata["scene_graph_source"] = metadata["semantic_graph_source"]

            state["project"] = project
            state["current_step"] = "vision_completed"
            state["messages"].append(
                {
                    "role": "assistant",
                    "content": (
                        "Automatic coordinate-scene compilation failed, "
                        f"but the workflow will continue with structured geometry fallback: {exc}"
                    ),
                }
            )
            return state

        semantic_graph = self.coordinate_scene_compiler.derive_semantic_graph(coordinate_scene)
        drawable_scene = self.coordinate_scene_compiler.derive_drawable_scene(coordinate_scene)
        geometry_graph_payload = self._build_geometry_graph_payload(drawable_scene)
        ggb_commands = self.coordinate_scene_compiler.export_ggb_commands(coordinate_scene)
        debug_exports = self.coordinate_scene_compiler.write_debug_exports(
            coordinate_scene=coordinate_scene,
            output_dir=self.output_dir,
            export_ggb=export_ggb,
                extra_payloads={
                    "problem_bundle": bundle,
                    "geometry_facts": geometry_facts,
                    "geometry_spec": geometry_spec,
                    "normalized_geometry_spec": normalized_spec,
                    "geometry_spec_validation": geometry_spec_validation,
                "coordinate_scene_validation": coordinate_scene_validation,
            },
        )

        metadata["normalized_geometry_spec"] = normalized_spec
        metadata["geometry_spec_validation"] = geometry_spec_validation
        metadata["coordinate_scene"] = coordinate_scene
        metadata["coordinate_scene_json"] = json.dumps(coordinate_scene, ensure_ascii=False)
        metadata["coordinate_scene_validation"] = coordinate_scene_validation
        metadata["ggb_commands"] = ggb_commands
        metadata["semantic_graph"] = semantic_graph
        metadata["semantic_graph_json"] = json.dumps(semantic_graph, ensure_ascii=False)
        metadata["drawable_scene"] = drawable_scene
        metadata["drawable_scene_json"] = json.dumps(drawable_scene, ensure_ascii=False)
        metadata["scene_graph"] = semantic_graph
        metadata["scene_graph_json"] = metadata["semantic_graph_json"]
        metadata["geometry_graph"] = geometry_graph_payload
        metadata["geometry_graph_json"] = json.dumps(
            geometry_graph_payload, ensure_ascii=False
        )
        metadata["semantic_graph_source"] = "derived_from_coordinate_scene"
        metadata["drawable_scene_source"] = "derived_from_coordinate_scene"
        metadata["scene_graph_source"] = metadata["semantic_graph_source"]
        metadata["debug_exports"] = debug_exports

        state["project"] = project
        state["current_step"] = "vision_completed"
        state["messages"].append(
            {
                "role": "assistant",
                "content": f"Problem recognition completed: {problem_text[:50]}...",
            }
        )
        return state

    def _analyze_problem_bundle(self, image_path: str) -> Dict[str, Any]:
        with open(image_path, "rb") as file:
            image_data = base64.b64encode(file.read()).decode()

        prompt = """
Analyze this plane-geometry problem image and return JSON only.

Requirements:
1. `problem_text` must contain the full OCR text.
2. `geometry_facts` must contain only entities, relations, and known measurements. Do not invent coordinates.
3. Be conservative. If something is uncertain, leave it out instead of guessing.
4. Segment or line names such as `AB`, `AC`, `BE` are not point ids. Only labeled points like `A`, `B`, `C`, `O`, `D`, `E`, `M`, `P`, `C1` belong in `points`.
5. Prefer simple fact buckets instead of final compiler-ready schema:
   - `points`
   - `segments`
   - `polygons`
   - `circles`
   - `arcs`
   - `angles`
   - `right_angles`
   - `relations`
   - `measurements`
6. Each relation item must use one of:
   `point_on_segment`, `point_on_circle`, `collinear`, `perpendicular`, `parallel`, `midpoint`, `equal_length`, `intersect`.
7. Each measurement item must use one of:
   `length`, `angle`, `ratio`.
8. For a circle, include `center`, and if possible include `radius_point` or `points_on_circle`.
9. For an arc, include `center` and only the two arc endpoints.
10. If you cannot fit something into the simple fact buckets, omit it instead of inventing a new schema.

Return exactly:
{
  "problem_text": "full OCR text",
  "geometry_facts": {
    "confidence": 0.0,
    "ambiguities": [],
    "roles": {},
    "points": [],
    "segments": [],
    "polygons": [],
    "circles": [],
    "arcs": [],
    "angles": [],
    "right_angles": [],
    "relations": [],
    "measurements": []
  }
}
"""

        messages = [
            {"role": "system", "content": self.system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_data}"},
                    },
                ],
            },
        ]

        result = self._invoke_llm(messages).strip()
        try:
            Path(self.output_dir).mkdir(parents=True, exist_ok=True)
            debug_dir = Path(self.output_dir) / "debug"
            debug_dir.mkdir(parents=True, exist_ok=True)
            (debug_dir / "vision_bundle_raw_response.txt").write_text(result, encoding="utf-8")
        except Exception:
            pass
        return self._parse_json_like_output(
            result,
            {
                "problem_text": "",
                "geometry_facts": {
                    "confidence": 0.0,
                    "ambiguities": [],
                    "roles": {},
                    "points": [],
                    "segments": [],
                    "polygons": [],
                    "circles": [],
                    "arcs": [],
                    "angles": [],
                    "right_angles": [],
                    "relations": [],
                    "measurements": [],
                },
                "geometry_spec": {
                    "templates": [],
                    "confidence": 0.0,
                    "ambiguities": [],
                    "roles": {},
                    "points": [],
                    "primitives": [],
                    "constraints": [],
                    "measurements": [],
                },
            },
        )

    def _bundle_is_effectively_empty(self, bundle: Optional[Dict[str, Any]]) -> bool:
        if not isinstance(bundle, dict):
            return True
        problem_text = str(bundle.get("problem_text", "")).strip()
        geometry_facts = bundle.get("geometry_facts") or bundle.get("geometry_spec") or {}
        return (not problem_text) and (not self._geometry_facts_have_content(geometry_facts))

    def _geometry_facts_have_content(self, geometry_facts: Optional[Dict[str, Any]]) -> bool:
        if not isinstance(geometry_facts, dict):
            return False
        buckets = [
            "points",
            "segments",
            "polygons",
            "circles",
            "arcs",
            "angles",
            "right_angles",
            "relations",
            "measurements",
            "primitives",
            "constraints",
        ]
        for bucket in buckets:
            items = geometry_facts.get(bucket)
            if isinstance(items, list) and items:
                return True
            if isinstance(items, dict) and items:
                return True
        return False

    def _recover_problem_bundle(
        self,
        image_path: str,
        original_bundle: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        recovered = copy.deepcopy(original_bundle or {})
        recovered.setdefault("problem_text", "")
        recovered.setdefault(
            "geometry_facts",
            {
                "confidence": 0.0,
                "ambiguities": [],
                "roles": {},
                "points": [],
                "segments": [],
                "polygons": [],
                "circles": [],
                "arcs": [],
                "angles": [],
                "right_angles": [],
                "relations": [],
                "measurements": [],
            },
        )

        if not str(recovered.get("problem_text", "")).strip():
            recovered["problem_text"] = self._extract_problem_text_fallback(image_path)

        if not self._geometry_facts_have_content(recovered.get("geometry_facts")):
            recovered["geometry_facts"] = self._extract_geometry_facts_fallback(
                image_path=image_path,
                problem_text=str(recovered.get("problem_text", "")).strip(),
            )

        return recovered

    def _stabilize_problem_bundle(
        self,
        bundle: Optional[Dict[str, Any]],
        *,
        image_path: str,
    ) -> Dict[str, Any]:
        stabilized = copy.deepcopy(bundle or {})
        problem_text = str(stabilized.get("problem_text", "")).strip()
        geometry_facts = stabilized.get("geometry_facts")
        if not isinstance(geometry_facts, dict):
            geometry_facts = {}

        if not problem_text:
            problem_text = self._extract_problem_text_fallback(image_path)
        geometry_facts = self._sanitize_geometry_facts(geometry_facts, problem_text=problem_text)

        if not self._geometry_facts_have_content(geometry_facts):
            fallback = self._extract_geometry_facts_fallback(
                image_path=image_path,
                problem_text=problem_text,
            )
            geometry_facts = self._sanitize_geometry_facts(fallback, problem_text=problem_text)

        stabilized["problem_text"] = problem_text
        stabilized["geometry_facts"] = geometry_facts
        return stabilized

    def _sanitize_geometry_facts(
        self,
        geometry_facts: Optional[Dict[str, Any]],
        *,
        problem_text: str,
    ) -> Dict[str, Any]:
        facts = copy.deepcopy(geometry_facts or {})
        sanitized: Dict[str, Any] = {
            "confidence": self._safe_float(facts.get("confidence"), default=0.0),
            "ambiguities": [
                str(item).strip()
                for item in (facts.get("ambiguities") or [])
                if str(item).strip()
            ],
            "roles": facts.get("roles") if isinstance(facts.get("roles"), dict) else {},
            "points": [],
            "segments": [],
            "polygons": [],
            "circles": [],
            "arcs": [],
            "angles": [],
            "right_angles": [],
            "relations": [],
            "measurements": [],
        }

        points = self._ordered_unique_tokens(
            list(self._iter_point_tokens(facts.get("points")))
            + list(self._iter_problem_text_points(problem_text))
        )
        point_set = set(points)
        sanitized["points"] = points

        segments = self._ordered_unique_tokens(
            list(self._iter_segment_tokens(facts.get("segments")))
            + self._infer_problem_text_segments(problem_text, point_set)
        )
        segment_set = set(segments)
        sanitized["segments"] = segments

        polygons = self._ordered_unique_tokens(
            list(self._iter_polygon_tokens(facts.get("polygons")))
            + self._infer_problem_text_polygons(problem_text, point_set)
        )
        sanitized["polygons"] = polygons

        circles = self._sanitize_circle_bucket(
            facts.get("circles"),
            point_set=point_set,
        )
        sanitized["circles"] = circles

        circle_ref_map: Dict[str, str] = {}
        for item in circles:
            circle_id = str(item.get("id", "")).strip()
            center = str(item.get("center", "")).strip()
            if circle_id:
                circle_ref_map[circle_id] = circle_id
            if center:
                circle_ref_map[center] = circle_id or center

        arcs = self._sanitize_arc_bucket(
            facts.get("arcs"),
            point_set=point_set,
            circle_ref_map=circle_ref_map,
        )
        sanitized["arcs"] = arcs

        # Ensure circle/arc referenced points are retained with deterministic ordering.
        sanitized["points"] = self._merge_ordered_points(sanitized["points"], point_set)

        sanitized["angles"] = self._sanitize_angle_bucket(
            facts.get("angles"),
            point_set=point_set,
        )
        sanitized["right_angles"] = self._sanitize_angle_bucket(
            facts.get("right_angles"),
            point_set=point_set,
            force_right=True,
        )
        sanitized["relations"] = self._sanitize_relation_bucket(
            facts.get("relations"),
            point_set=point_set,
            segment_set=segment_set,
            circle_ref_map=circle_ref_map,
        )
        sanitized["measurements"] = self._sanitize_measurement_bucket(
            facts.get("measurements"),
            point_set=point_set,
            segment_set=segment_set,
        )

        self._augment_facts_from_problem_text(
            sanitized,
            problem_text=problem_text,
            point_set=point_set,
            segment_set=segment_set,
        )
        sanitized["points"] = self._merge_ordered_points(sanitized["points"], point_set)
        return sanitized

    def _iter_point_tokens(self, raw: Any):
        if isinstance(raw, (list, tuple)):
            for item in raw:
                token = self._normalize_point_token(item if not isinstance(item, dict) else item.get("id") or item.get("label") or item.get("name"))
                if token:
                    yield token

    def _iter_problem_text_points(self, text: str):
        normalized = self._normalize_prime_markers(text)
        for token in re.findall(r"[A-Z]\d*'*", normalized):
            point = self._normalize_point_token(token)
            if point:
                yield point

    def _iter_segment_tokens(self, raw: Any):
        if isinstance(raw, (list, tuple)):
            for item in raw:
                token = self._normalize_segment_token(item if not isinstance(item, dict) else item.get("id") or item.get("segment") or item.get("label"))
                if token:
                    yield token

    def _iter_polygon_tokens(self, raw: Any):
        if isinstance(raw, (list, tuple)):
            for item in raw:
                token = self._normalize_polygon_token(item if not isinstance(item, dict) else item.get("id") or item.get("polygon") or item.get("label"))
                if token:
                    yield token

    def _sanitize_angle_bucket(
        self,
        raw_bucket: Any,
        *,
        point_set: set,
        force_right: bool = False,
    ) -> List[Dict[str, Any]]:
        result: List[Dict[str, Any]] = []
        seen: set = set()
        for raw in (raw_bucket or []):
            if not isinstance(raw, dict):
                continue
            vertex = self._normalize_point_token(raw.get("vertex"))
            refs: List[str] = []
            sides = raw.get("sides")
            if vertex and isinstance(sides, (list, tuple)) and len(sides) == 2:
                for side in sides:
                    endpoints = self._segment_endpoints_from_token(side)
                    if len(endpoints) == 2 and vertex in endpoints:
                        refs.append(endpoints[0] if endpoints[1] == vertex else endpoints[1])

            if len(refs) != 2:
                angle_points = self._extract_angle_points_from_text(
                    raw.get("angle")
                    or raw.get("name")
                    or raw.get("label")
                    or raw.get("description")
                    or ""
                )
                if len(angle_points) == 3:
                    refs = [angle_points[0], angle_points[2]]
                    vertex = vertex or angle_points[1]

            if len(refs) == 2 and vertex:
                point_set.add(vertex)
                point_set.add(refs[0])
                point_set.add(refs[1])

            if len(refs) == 2 and vertex and vertex in point_set and refs[0] in point_set and refs[1] in point_set:
                payload = {"vertex": vertex, "sides": [self._normalize_segment_token(vertex + refs[0]), self._normalize_segment_token(vertex + refs[1])]}
                for key in ("name", "label", "description"):
                    if str(raw.get(key, "")).strip():
                        payload[key] = str(raw.get(key)).strip()
                        break
                signature = (vertex, tuple(sorted(refs)), force_right)
                if signature not in seen:
                    seen.add(signature)
                    result.append(payload)
        return result

    def _sanitize_circle_bucket(
        self,
        raw_bucket: Any,
        *,
        point_set: set,
    ) -> List[Dict[str, Any]]:
        result: List[Dict[str, Any]] = []
        seen: set = set()
        for raw in (raw_bucket or []):
            circle_id = ""
            center = ""
            radius_point = ""
            points_on_circle: List[str] = []

            if isinstance(raw, str):
                center = self._normalize_circle_center_token(raw)
            elif isinstance(raw, dict):
                circle_id = self._normalize_circle_id(raw.get("id") or raw.get("circle") or raw.get("circle_id"))
                center = self._normalize_point_token(raw.get("center") or raw.get("origin") or raw.get("o"))
                if not center:
                    center = self._normalize_circle_center_token(raw.get("label") or raw.get("name") or raw.get("id"))
                radius_point = self._normalize_point_token(raw.get("radius_point") or raw.get("point"))
                points_on_circle = [
                    self._normalize_point_token(item)
                    for item in self._extract_points_from_any(
                        raw.get("points_on_circle")
                        or raw.get("points")
                        or raw.get("on_points")
                        or raw.get("entities")
                    )
                ]
                points_on_circle = [item for item in points_on_circle if item and item != center]

            if not center:
                continue
            if not circle_id:
                circle_id = f"circle_{center}"

            if center:
                point_set.add(center)
            if radius_point:
                point_set.add(radius_point)
            for point_id in points_on_circle:
                point_set.add(point_id)

            payload: Dict[str, Any] = {"id": circle_id, "center": center}
            if radius_point and radius_point != center:
                payload["radius_point"] = radius_point
            unique_circle_points = self._ordered_unique_tokens(points_on_circle)
            if unique_circle_points:
                payload["points_on_circle"] = unique_circle_points

            signature = json.dumps(payload, ensure_ascii=False, sort_keys=True)
            if signature in seen:
                continue
            seen.add(signature)
            result.append(payload)
        return result

    def _sanitize_arc_bucket(
        self,
        raw_bucket: Any,
        *,
        point_set: set,
        circle_ref_map: Dict[str, str],
    ) -> List[Dict[str, Any]]:
        result: List[Dict[str, Any]] = []
        seen: set = set()
        for raw in (raw_bucket or []):
            arc_id = ""
            center = ""
            circle_ref = ""
            endpoints: List[str] = []

            if isinstance(raw, str):
                refs = [self._normalize_point_token(item) for item in self._extract_points_from_any(raw)]
                endpoints = [item for item in refs if item][:2]
            elif isinstance(raw, dict):
                arc_id = str(raw.get("id") or "").strip().replace(" ", "_")
                center = self._normalize_point_token(raw.get("center") or raw.get("origin"))
                circle_ref = self._resolve_circle_ref(
                    raw.get("circle") or raw.get("circle_id"),
                    circle_ref_map,
                )
                refs = [
                    self._normalize_point_token(item)
                    for item in self._extract_points_from_any(
                        raw.get("points")
                        or raw.get("endpoints")
                        or [raw.get("start"), raw.get("end")]
                        or raw.get("entities")
                    )
                ]
                endpoints = [item for item in refs if item][:2]

            if len(endpoints) != 2:
                continue

            for point_id in endpoints:
                point_set.add(point_id)
            if center:
                point_set.add(center)

            if not arc_id:
                arc_id = f"arc_{endpoints[0]}{endpoints[1]}"

            payload: Dict[str, Any] = {
                "id": arc_id,
                "points": endpoints,
            }
            if center:
                payload["center"] = center
            if circle_ref:
                payload["circle"] = circle_ref

            signature = json.dumps(payload, ensure_ascii=False, sort_keys=True)
            if signature in seen:
                continue
            seen.add(signature)
            result.append(payload)
        return result

    def _sanitize_relation_bucket(
        self,
        raw_bucket: Any,
        *,
        point_set: set,
        segment_set: set,
        circle_ref_map: Dict[str, str],
    ) -> List[Dict[str, Any]]:
        allowed = {
            "point_on_segment",
            "point_on_circle",
            "collinear",
            "perpendicular",
            "parallel",
            "midpoint",
            "equal_length",
            "intersect",
        }
        result: List[Dict[str, Any]] = []
        seen: set = set()
        for raw in (raw_bucket or []):
            if not isinstance(raw, dict):
                continue
            relation_type = str(raw.get("type", "")).strip().lower()
            if relation_type not in allowed:
                continue
            item = None
            entity_refs = [str(item).strip() for item in (raw.get("entities") or []) if str(item).strip()]
            if relation_type == "point_on_segment":
                point_id = self._normalize_point_token(raw.get("point") or (entity_refs[0] if entity_refs else ""))
                segment_raw = raw.get("segment") or raw.get("line") or (entity_refs[1] if len(entity_refs) >= 2 else "")
                segment_id = self._normalize_segment_token(segment_raw)
                if point_id and point_id in point_set and segment_id:
                    item = {"type": relation_type, "point": point_id, "segment": segment_id}
            elif relation_type == "collinear":
                raw_points = raw.get("points") or entity_refs
                pts = [self._normalize_point_token(item) for item in raw_points]
                pts = [item for item in pts if item and item in point_set]
                if len(dict.fromkeys(pts)) == 3:
                    item = {"type": relation_type, "points": list(dict.fromkeys(pts))}
            elif relation_type in {"parallel", "perpendicular", "equal_length"}:
                raw_segments = raw.get("segments") or raw.get("lines") or entity_refs
                segs = [self._normalize_segment_token(item) for item in raw_segments]
                segs = [item for item in segs if item]
                if relation_type == "equal_length" and len(segs) >= 2:
                    item = {"type": relation_type, "segments": list(dict.fromkeys(segs))}
                elif len(dict.fromkeys(segs)) == 2:
                    item = {"type": relation_type, "segments": list(dict.fromkeys(segs))}
            elif relation_type == "midpoint":
                point_id = self._normalize_point_token(raw.get("point") or raw.get("midpoint") or (entity_refs[0] if entity_refs else ""))
                segment_raw = raw.get("segment") or raw.get("line") or (entity_refs[1] if len(entity_refs) >= 2 else "")
                segment_id = self._normalize_segment_token(segment_raw)
                if point_id and point_id in point_set and segment_id:
                    item = {"type": relation_type, "point": point_id, "segment": segment_id}
            elif relation_type == "intersect":
                point_id = self._normalize_point_token(raw.get("point") or raw.get("intersection") or (entity_refs[0] if entity_refs else ""))
                raw_segments = raw.get("segments") or raw.get("lines") or entity_refs[1:]
                segs = [self._normalize_segment_token(item) for item in raw_segments]
                segs = [item for item in segs if item]
                if point_id and point_id in point_set and len(dict.fromkeys(segs)) == 2:
                    item = {"type": relation_type, "point": point_id, "segments": list(dict.fromkeys(segs))}
            elif relation_type == "point_on_circle":
                point_id = self._normalize_point_token(raw.get("point") or (entity_refs[0] if entity_refs else ""))
                circle_raw = raw.get("circle") or raw.get("circle_id") or (entity_refs[1] if len(entity_refs) >= 2 else "")
                circle_id = self._resolve_circle_ref(circle_raw, circle_ref_map)
                if point_id and point_id in point_set and circle_id:
                    item = {"type": relation_type, "point": point_id, "circle": circle_id}

            if not item:
                continue
            signature = json.dumps(item, ensure_ascii=False, sort_keys=True)
            if signature in seen:
                continue
            seen.add(signature)
            result.append(item)
        return result

    def _sanitize_measurement_bucket(
        self,
        raw_bucket: Any,
        *,
        point_set: set,
        segment_set: set,
    ) -> List[Dict[str, Any]]:
        result: List[Dict[str, Any]] = []
        seen: set = set()
        for raw in (raw_bucket or []):
            if not isinstance(raw, dict):
                continue
            measurement_type = str(raw.get("type", "")).strip().lower()
            item = None
            if measurement_type == "length":
                segment_id = self._normalize_segment_token(raw.get("segment") or raw.get("line"))
                if not segment_id:
                    entities = [str(item).strip() for item in (raw.get("entities") or []) if str(item).strip()]
                    if len(entities) == 2:
                        segment_id = self._normalize_segment_token("".join(entities))
                value = self._extract_numeric_or_symbolic_value(raw.get("value"))
                if segment_id and value is not None:
                    item = {"type": "length", "segment": segment_id, "value": value}
            elif measurement_type == "angle":
                value = self._extract_angle_value(raw.get("value"))
                angle_name = self._normalize_angle_name(raw.get("angle") or raw.get("name") or raw.get("label"))
                vertex = self._normalize_point_token(raw.get("vertex"))
                if angle_name and value is not None:
                    item = {"type": "angle", "angle": angle_name, "value": value}
                elif vertex and value is not None:
                    payload = {"type": "angle", "vertex": vertex, "value": value}
                    if str(raw.get("description", "")).strip():
                        payload["description"] = str(raw.get("description")).strip()
                    item = payload
                else:
                    entities = [
                        self._normalize_point_token(entity)
                        for entity in (raw.get("entities") or [])
                    ]
                    entities = [entity for entity in entities if entity]
                    if len(entities) == 3 and value is not None:
                        item = {"type": "angle", "entities": entities, "value": value}
            elif measurement_type == "ratio":
                value = self._extract_numeric_or_symbolic_value(raw.get("value"))
                raw_segments = raw.get("segments") or raw.get("lines") or raw.get("entities") or []
                segs = [self._normalize_segment_token(item) for item in raw_segments]
                segs = [item for item in segs if item]
                if len(segs) >= 2 and value is not None:
                    item = {"type": "ratio", "segments": segs[:2], "value": value}
            if not item:
                continue
            signature = json.dumps(item, ensure_ascii=False, sort_keys=True)
            if signature in seen:
                continue
            seen.add(signature)
            result.append(item)
        return result

    def _augment_facts_from_problem_text(
        self,
        facts: Dict[str, Any],
        *,
        problem_text: str,
        point_set: set,
        segment_set: set,
    ) -> None:
        normalized = self._normalize_prime_markers(problem_text)

        for match in re.finditer(r"[⊙○]\s*([A-Z]\d*'*)", normalized):
            center = self._normalize_point_token(match.group(1))
            if not center:
                continue
            point_set.add(center)
            if center not in facts["points"]:
                facts["points"].append(center)
            circle_payload = {"id": f"circle_{center}", "center": center}
            if circle_payload not in facts["circles"]:
                facts["circles"].append(circle_payload)

        for match in re.finditer(r"([A-Z]\d*'*)\s*(?:在|属于)?\s*[⊙○]\s*([A-Z]\d*'*)\s*(?:上|内)?", normalized):
            point_id = self._normalize_point_token(match.group(1))
            center = self._normalize_point_token(match.group(2))
            if not point_id or not center:
                continue
            point_set.add(point_id)
            point_set.add(center)
            if point_id not in facts["points"]:
                facts["points"].append(point_id)
            if center not in facts["points"]:
                facts["points"].append(center)
            circle_id = f"circle_{center}"
            circle_payload = {"id": circle_id, "center": center}
            if circle_payload not in facts["circles"]:
                facts["circles"].append(circle_payload)
            relation_payload = {"type": "point_on_circle", "point": point_id, "circle": circle_id}
            if relation_payload not in facts["relations"]:
                facts["relations"].append(relation_payload)

        if "菱形" in normalized:
            for match in re.finditer(r"菱形\s*([A-Z]\d*'*)([A-Z]\d*'*)([A-Z]\d*'*)([A-Z]\d*'*)", normalized):
                refs = [self._normalize_point_token(token) for token in match.groups()]
                refs = [item for item in refs if item]
                if len(refs) != 4:
                    continue
                polygon = "".join(refs)
                if polygon not in facts["polygons"]:
                    facts["polygons"].append(polygon)
                for first, second in zip(refs, refs[1:] + refs[:1]):
                    seg = self._normalize_segment_token(first + second)
                    if seg and seg not in facts["segments"]:
                        facts["segments"].append(seg)
                parallels = [
                    {"type": "parallel", "segments": [self._normalize_segment_token(refs[0] + refs[1]), self._normalize_segment_token(refs[2] + refs[3])]},
                    {"type": "parallel", "segments": [self._normalize_segment_token(refs[1] + refs[2]), self._normalize_segment_token(refs[3] + refs[0])]},
                    {"type": "equal_length", "segments": [self._normalize_segment_token(refs[0] + refs[1]), self._normalize_segment_token(refs[1] + refs[2])]},
                    {"type": "equal_length", "segments": [self._normalize_segment_token(refs[1] + refs[2]), self._normalize_segment_token(refs[2] + refs[3])]},
                    {"type": "equal_length", "segments": [self._normalize_segment_token(refs[2] + refs[3]), self._normalize_segment_token(refs[3] + refs[0])]},
                ]
                for relation in parallels:
                    if relation not in facts["relations"]:
                        facts["relations"].append(relation)

        for match in re.finditer(r"沿\s*([A-Z]\d*'*[A-Z]\d*'*)\s*(?:折叠|翻折)", normalized):
            seg = self._normalize_segment_token(match.group(1))
            if seg and seg not in facts["segments"]:
                facts["segments"].append(seg)

        for match in re.finditer(r"([A-Z]\d*'*)\s*=\s*([-+]?\d+(?:\.\d+)?)", normalized):
            token = self._normalize_segment_token(match.group(1))
            if token:
                payload = {"type": "length", "segment": token, "value": self._safe_float(match.group(2), default=None)}
                if payload["value"] is not None and payload not in facts["measurements"]:
                    facts["measurements"].append(payload)

        for match in re.finditer(r"tan\s*([A-Z]\d*'*)\s*=\s*([-+]?\d+(?:\.\d+)?)", normalized, flags=re.IGNORECASE):
            angle_name = self._normalize_angle_name("∠" + match.group(1))
            if angle_name:
                payload = {"type": "angle", "angle": angle_name, "value": f"arctan({match.group(2)})"}
                if payload not in facts["measurements"]:
                    facts["measurements"].append(payload)

        for match in re.finditer(r"∠\s*([A-Z]\d*'*(?:[A-Z]\d*'*){2})\s*=\s*([-+]?\d+(?:\.\d+)?)", normalized):
            angle_name = self._normalize_angle_name("∠" + match.group(1))
            value = self._safe_float(match.group(2), default=None)
            if angle_name and value is not None:
                payload = {"type": "angle", "angle": angle_name, "value": value}
                if payload not in facts["measurements"]:
                    facts["measurements"].append(payload)

    def _infer_problem_text_segments(self, text: str, point_set: set) -> List[str]:
        normalized = self._normalize_prime_markers(text)
        result: List[str] = []
        for first, second in re.findall(r"([A-Z]\d*'*)([A-Z]\d*'*)", normalized):
            segment = self._normalize_segment_token(first + second)
            if segment:
                result.append(segment)
        return result

    def _infer_problem_text_polygons(self, text: str, point_set: set) -> List[str]:
        normalized = self._normalize_prime_markers(text)
        result: List[str] = []
        for match in re.finditer(r"(?:菱形|平行四边形|四边形|△|三角形)?\s*([A-Z]\d*'*(?:[A-Z]\d*'*){2,3})", normalized):
            token = self._normalize_polygon_token(match.group(1))
            if token:
                result.append(token)
        return result

    def _normalize_point_token(self, raw: Any) -> str:
        text = self._normalize_prime_markers(raw).strip().replace(" ", "")
        if not text:
            return ""
        if re.fullmatch(r"[A-Za-z]\d*'*", text):
            return text[0].upper() + text[1:]
        return ""

    def _normalize_segment_token(self, raw: Any) -> str:
        text = self._normalize_prime_markers(raw).strip().replace(" ", "")
        if text.startswith("seg_"):
            text = text[4:]
        refs = re.findall(r"[A-Za-z]\d*'*", text)
        if len(refs) == 2 and "".join(refs) == text:
            return refs[0][0].upper() + refs[0][1:] + refs[1][0].upper() + refs[1][1:]
        return ""

    def _normalize_polygon_token(self, raw: Any) -> str:
        text = self._normalize_prime_markers(raw).strip().replace(" ", "")
        refs = re.findall(r"[A-Za-z]\d*'*", text)
        if len(refs) >= 3 and "".join(refs) == text:
            return "".join(ref[0].upper() + ref[1:] for ref in refs)
        return ""

    def _normalize_circle_center_token(self, raw: Any) -> str:
        text = self._normalize_prime_markers(raw).strip().replace(" ", "")
        if not text:
            return ""
        marker_match = re.search(r"[⊙○]([A-Za-z]\d*'*)", text)
        if marker_match:
            return self._normalize_point_token(marker_match.group(1))
        if text.lower().startswith("circle_"):
            return self._normalize_point_token(text.split("_", 1)[1])
        refs = re.findall(r"[A-Za-z]\d*'*", text)
        if len(refs) == 1:
            return self._normalize_point_token(refs[0])
        return ""

    def _normalize_circle_id(self, raw: Any) -> str:
        text = str(raw or "").strip().replace(" ", "_")
        if not text:
            return ""
        return self._normalize_prime_markers(text)

    def _resolve_circle_ref(self, raw: Any, circle_ref_map: Dict[str, str]) -> str:
        direct = self._normalize_circle_id(raw)
        if direct and direct in circle_ref_map:
            return circle_ref_map[direct]
        center = self._normalize_circle_center_token(raw)
        if center and center in circle_ref_map:
            return circle_ref_map[center]
        return direct or center

    def _extract_points_from_any(self, raw: Any) -> List[str]:
        if raw is None:
            return []
        if isinstance(raw, str):
            normalized = self._normalize_prime_markers(raw)
            return re.findall(r"[A-Za-z]\d*'*", normalized)
        if isinstance(raw, dict):
            for key in ("points", "endpoints", "entities", "vertices"):
                if raw.get(key) is not None:
                    return self._extract_points_from_any(raw.get(key))
            for key in ("id", "label", "name"):
                if raw.get(key) is not None:
                    return self._extract_points_from_any(raw.get(key))
            return []
        if isinstance(raw, (list, tuple)):
            result: List[str] = []
            for item in raw:
                result.extend(self._extract_points_from_any(item))
            return result
        return []

    def _segment_endpoints_from_token(self, raw: Any) -> List[str]:
        text = self._normalize_prime_markers(raw).strip().replace(" ", "")
        if text.startswith("seg_"):
            text = text[4:]
        refs = re.findall(r"[A-Za-z]\d*'*", text)
        if len(refs) == 2 and "".join(refs) == text:
            return [refs[0][0].upper() + refs[0][1:], refs[1][0].upper() + refs[1][1:]]
        return []

    def _normalize_angle_name(self, raw: Any) -> str:
        text = self._normalize_prime_markers(raw).strip().replace(" ", "")
        if not text:
            return ""
        if not text.startswith("∠"):
            text = "∠" + text
        refs = re.findall(r"[A-Za-z]\d*'*", text)
        if len(refs) in {1, 3}:
            return "∠" + "".join(ref[0].upper() + ref[1:] for ref in refs)
        return ""

    def _extract_angle_points_from_text(self, raw: Any) -> List[str]:
        text = self._normalize_prime_markers(raw).strip()
        if not text:
            return []
        match = re.search(r"(?:∠|angle)?\s*([A-Za-z]\d*'*(?:[A-Za-z]\d*'*){2})", text, flags=re.IGNORECASE)
        if not match:
            return []
        refs = [self._normalize_point_token(item) for item in re.findall(r"[A-Za-z]\d*'*", match.group(1))]
        refs = [item for item in refs if item]
        if len(refs) == 3:
            return refs
        return []

    def _extract_angle_value(self, raw: Any) -> Any:
        text = str(raw or "").strip()
        if not text:
            return None
        arctan_match = re.search(r"arctan\(\s*[-+]?\d+(?:\.\d+)?\s*\)", text, flags=re.IGNORECASE)
        if arctan_match:
            return arctan_match.group(0)
        numeric = self._safe_float(text, default=None)
        if numeric is not None:
            return numeric
        match = re.search(r"[-+]?\d+(?:\.\d+)?", text)
        if match and ("tan" in text.lower() or "arctan" in text.lower()):
            return f"arctan({match.group(0)})"
        return None

    def _extract_numeric_or_symbolic_value(self, raw: Any) -> Any:
        numeric = self._safe_float(raw, default=None)
        if numeric is not None:
            return numeric
        text = str(raw or "").strip()
        return text if text else None

    def _ordered_unique_tokens(self, values: List[str]) -> List[str]:
        seen = set()
        ordered: List[str] = []
        for value in values:
            if not value or value in seen:
                continue
            seen.add(value)
            ordered.append(value)
        return ordered

    def _merge_ordered_points(self, existing_points: List[str], point_set: set) -> List[str]:
        ordered = self._ordered_unique_tokens(list(existing_points or []))
        seen = set(ordered)
        extras = sorted(item for item in point_set if item and item not in seen)
        ordered.extend(extras)
        return ordered

    def _safe_float(self, raw: Any, default: Optional[float]) -> Optional[float]:
        try:
            return float(raw)
        except (TypeError, ValueError):
            return default

    def _normalize_prime_markers(self, raw: Any) -> str:
        return str(raw or "").replace("′", "'").replace("’", "'").replace("`", "'")

    def _extract_problem_text_fallback(self, image_path: str) -> str:
        prompt = (
            "Read the image carefully and return only the full OCR text of the math problem. "
            "Preserve line breaks when useful. Do not explain anything."
        )
        result = self.analyze_image(image_path, prompt)
        self._write_debug_text("vision_problem_text_fallback.txt", result)
        return str(result or "").strip()

    def _extract_geometry_facts_fallback(
        self,
        *,
        image_path: str,
        problem_text: str,
    ) -> Dict[str, Any]:
        prompt = f"""
Analyze the plane-geometry image and return JSON only.

Problem text (may be partial OCR):
{problem_text}

Return exactly:
{{
  "confidence": 0.0,
  "ambiguities": [],
  "roles": {{}},
  "points": [],
  "segments": [],
  "polygons": [],
  "circles": [],
  "arcs": [],
  "angles": [],
  "right_angles": [],
  "relations": [],
  "measurements": []
}}

Be conservative. If uncertain, omit instead of guessing.
"""
        result = self.analyze_image(image_path, prompt)
        self._write_debug_text("vision_geometry_facts_fallback.txt", result)
        parsed = self._parse_json_like_output(
            result,
            {
                "confidence": 0.0,
                "ambiguities": [],
                "roles": {},
                "points": [],
                "segments": [],
                "polygons": [],
                "circles": [],
                "arcs": [],
                "angles": [],
                "right_angles": [],
                "relations": [],
                "measurements": [],
            },
        )
        return parsed if isinstance(parsed, dict) else {
            "confidence": 0.0,
            "ambiguities": [],
            "roles": {},
            "points": [],
            "segments": [],
            "polygons": [],
            "circles": [],
            "arcs": [],
            "angles": [],
            "right_angles": [],
            "relations": [],
            "measurements": [],
        }

    def _write_debug_text(self, filename: str, content: str) -> None:
        try:
            debug_dir = Path(self.output_dir) / "debug"
            debug_dir.mkdir(parents=True, exist_ok=True)
            (debug_dir / filename).write_text(str(content or ""), encoding="utf-8")
        except Exception:
            pass

    def _build_geometry_graph_payload(self, scene_graph_data: Dict[str, Any]) -> Dict[str, Any]:
        try:
            scene = SceneGraph(scene_graph_data)
            geometry_graph = GeometryGraph(scene)
            return geometry_graph.to_payload()
        except Exception:
            return {"nodes": [], "edges": [], "stats": {"node_count": 0, "edge_count": 0}}

    def _build_semantic_graph(self, geometry_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        geometry_data = geometry_data or {}
        semantic_graph = {
            "points": {},
            "lines": [],
            "objects": [],
            "incidence": [],
            "angles": [],
            "relations": [],
            "primitives": copy.deepcopy(geometry_data.get("primitives", [])),
        }

        for point in geometry_data.get("points", []):
            if isinstance(point, dict):
                point_id = str(point.get("id", "")).strip()
            else:
                point_id = str(point).strip()
            if point_id:
                semantic_graph["points"][point_id] = {}

        for primitive in geometry_data.get("primitives", []):
            primitive_type = str(primitive.get("type", "")).strip().lower()
            primitive_id = str(primitive.get("id", "")).strip()
            refs = [str(item) for item in (primitive.get("points") or [])]
            if primitive_type == "segment" and len(refs) == 2:
                semantic_graph["lines"].append(
                    {"id": primitive_id, "type": "segment", "points": refs}
                )
            elif primitive_type == "polygon" and len(refs) >= 3:
                semantic_graph["objects"].append(
                    {"id": primitive_id, "type": "polygon", "points": refs}
                )
            elif primitive_type == "circle":
                semantic_graph["objects"].append(
                    {
                        "id": primitive_id,
                        "type": "circle",
                        "center": primitive.get("center"),
                        "radius_point": primitive.get("radius_point"),
                    }
                )
            elif primitive_type == "arc":
                semantic_graph["objects"].append(
                    {
                        "id": primitive_id,
                        "type": "arc",
                        "points": refs,
                        "center": primitive.get("center"),
                    }
                )
            elif primitive_type in {"angle", "right_angle"} and len(refs) == 3:
                semantic_graph["angles"].append(
                    {"id": primitive_id, "points": refs, "value": primitive.get("value")}
                )

        for constraint in geometry_data.get("constraints", []):
            relation_type = str(constraint.get("type", "")).strip().lower()
            entities = [str(item) for item in (constraint.get("entities") or [])]
            if relation_type == "point_on_segment" and len(entities) == 2:
                semantic_graph["incidence"].append(
                    {"type": "point_on_line", "entities": entities}
                )
            elif relation_type == "point_on_circle" and len(entities) == 2:
                semantic_graph["incidence"].append(
                    {"type": "point_on_object", "entities": entities}
                )
            else:
                semantic_graph["relations"].append(
                    {"type": relation_type, "entities": entities}
                )

        return semantic_graph

    def _build_schematic_drawable_scene(self, geometry_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if isinstance(geometry_data, dict) and geometry_data.get("points") and geometry_data.get("primitives"):
            try:
                partial_scene = self.coordinate_scene_compiler.solve_coordinate_scene(geometry_data)
                drawable_scene = self.coordinate_scene_compiler.derive_drawable_scene(partial_scene)
                drawable_scene["layout_mode"] = "schematic_solver_fallback"
                return drawable_scene
            except Exception:
                pass
        drawable_scene = self._build_semantic_graph(geometry_data)
        drawable_scene["layout_mode"] = "schematic_fallback"
        self._attach_fallback_positions(drawable_scene, geometry_data or {})
        return drawable_scene

    def _compile_geometry_spec(
        self,
        geometry_facts: Optional[Dict[str, Any]],
        *,
        problem_text: str,
    ) -> Dict[str, Any]:
        try:
            return self.geometry_fact_compiler.compile(
                geometry_facts,
                problem_text=problem_text,
            )
        except Exception:
            return {
                "templates": [],
                "confidence": 0.0,
                "ambiguities": [],
                "roles": {},
                "points": [],
                "primitives": [],
                "constraints": [],
                "measurements": [],
            }

    def _attach_fallback_positions(
        self,
        scene_graph: Dict[str, Any],
        geometry_data: Dict[str, Any],
    ) -> None:
        points = scene_graph.get("points") or {}
        if not isinstance(points, dict) or not points:
            return

        positions: Dict[str, List[float]] = {}
        lines = scene_graph.get("lines") or []
        objects = scene_graph.get("objects") or []
        constraints = geometry_data.get("constraints") or []
        measurements = geometry_data.get("measurements") or []
        segment_map: Dict[str, Tuple[str, str]] = {}

        for line in lines:
            if not isinstance(line, dict):
                continue
            line_id = str(line.get("id", "")).strip()
            refs = [str(item).strip() for item in (line.get("points") or []) if str(item).strip()]
            if line_id and len(refs) == 2:
                segment_map[line_id] = (refs[0], refs[1])

        self._apply_circle_parallel_extension_layout(
            positions=positions,
            objects=objects,
            constraints=constraints,
            measurements=measurements,
            segment_map=segment_map,
        )

        for obj in objects:
            if not isinstance(obj, dict):
                continue
            obj_type = str(obj.get("type", "")).strip().lower()
            refs = [str(item).strip() for item in (obj.get("points") or []) if str(item).strip()]
            if obj_type in {"polygon", "triangle"} and len(refs) >= 3:
                radius = 3.2
                for index, point_id in enumerate(refs):
                    angle = (math.pi / 2) - (2 * math.pi * index / len(refs))
                    positions.setdefault(
                        point_id,
                        [round(radius * math.cos(angle), 6), round(radius * math.sin(angle), 6)],
                    )
                break

        for obj in objects:
            if not isinstance(obj, dict):
                continue
            if str(obj.get("type", "")).strip().lower() != "circle":
                continue
            center = str(obj.get("center", "")).strip()
            if center:
                positions.setdefault(center, [0.0, 0.0])

        for obj in objects:
            if not isinstance(obj, dict):
                continue
            if str(obj.get("type", "")).strip().lower() != "circle":
                continue
            circle_id = str(obj.get("id", "")).strip()
            center = str(obj.get("center", "")).strip()
            radius_point = str(obj.get("radius_point", "")).strip()
            members: List[str] = []
            if radius_point:
                members.append(radius_point)
            for constraint in constraints:
                if str(constraint.get("type", "")).strip().lower() != "point_on_circle":
                    continue
                entities = [str(item).strip() for item in (constraint.get("entities") or [])]
                if len(entities) == 2 and entities[1] == circle_id and entities[0]:
                    members.append(entities[0])
            members = list(dict.fromkeys(members))
            if not center or center not in positions or not members:
                continue
            cx, cy = positions[center]
            radius = 3.0
            for index, point_id in enumerate(members):
                angle = (5 * math.pi / 6) - (2 * math.pi * index / max(len(members), 3))
                positions.setdefault(
                    point_id,
                    [round(cx + radius * math.cos(angle), 6), round(cy + radius * math.sin(angle), 6)],
                )

        for start, end in segment_map.values():
            if start in positions and end in positions:
                continue
            if start not in positions and end not in positions:
                positions[start] = [-3.0, 0.0]
                positions[end] = [3.0, 0.0]
                break

        for _ in range(4):
            changed = False
            for start, end in segment_map.values():
                if start in positions and end not in positions:
                    positions[end] = [positions[start][0] + 2.6, positions[start][1] + 1.2]
                    changed = True
                elif end in positions and start not in positions:
                    positions[start] = [positions[end][0] - 2.6, positions[end][1] - 1.2]
                    changed = True
            if not changed:
                break

        segment_mid_counts: Dict[str, int] = {}
        for constraint in constraints:
            if str(constraint.get("type", "")).strip().lower() != "point_on_segment":
                continue
            entities = [str(item).strip() for item in (constraint.get("entities") or [])]
            if len(entities) != 2:
                continue
            point_id, segment_id = entities
            endpoints = segment_map.get(segment_id)
            if not endpoints or endpoints[0] not in positions or endpoints[1] not in positions:
                continue
            count = segment_mid_counts.get(segment_id, 0)
            segment_mid_counts[segment_id] = count + 1
            ratio = 0.5 if count == 0 else min(0.25 + 0.25 * count, 0.8)
            ax, ay = positions[endpoints[0]]
            bx, by = positions[endpoints[1]]
            positions.setdefault(
                point_id,
                [round(ax + (bx - ax) * ratio, 6), round(ay + (by - ay) * ratio, 6)],
            )

        unresolved = [point_id for point_id in points.keys() if point_id not in positions]
        for index, point_id in enumerate(unresolved):
            col = index % 3
            row = index // 3
            positions[point_id] = [-4.0 + col * 3.0, -2.0 - row * 2.0]

        for point_id, payload in points.items():
            coord = positions.get(point_id)
            if coord is None:
                continue
            if not isinstance(payload, dict):
                payload = {}
                points[point_id] = payload
            payload["pos"] = [float(coord[0]), float(coord[1])]

    def _apply_circle_parallel_extension_layout(
        self,
        *,
        positions: Dict[str, List[float]],
        objects: List[Dict[str, Any]],
        constraints: List[Dict[str, Any]],
        measurements: List[Dict[str, Any]],
        segment_map: Dict[str, Tuple[str, str]],
    ) -> bool:
        circle_objects = [
            obj for obj in objects
            if isinstance(obj, dict) and str(obj.get("type", "")).strip().lower() == "circle"
        ]
        parallel_constraints = [
            item for item in constraints
            if str(item.get("type", "")).strip().lower() == "parallel"
        ]
        if not circle_objects or not parallel_constraints:
            return False

        for circle in circle_objects:
            circle_id = str(circle.get("id", "")).strip()
            center = str(circle.get("center", "")).strip()
            if not circle_id or not center:
                continue
            members = self._circle_members(circle_id, circle, constraints)
            if len(members) < 3:
                continue

            for relation in parallel_constraints:
                entities = [str(item).strip() for item in (relation.get("entities") or []) if str(item).strip()]
                if len(entities) != 2:
                    continue
                seg1 = segment_map.get(entities[0])
                seg2 = segment_map.get(entities[1])
                if not seg1 or not seg2:
                    continue

                layout = self._classify_parallel_layout(
                    seg1=seg1,
                    seg2=seg2,
                    members=members,
                    segment_map=segment_map,
                )
                if layout is None:
                    continue

                chord_a, chord_c, anchor_b, external_point = layout
                remaining = [item for item in members if item not in {chord_a, chord_c, anchor_b}]
                if len(remaining) == 1:
                    angle_map = {
                        chord_a: 210.0,
                        remaining[0]: 285.0,
                        chord_c: 350.0,
                        anchor_b: 75.0,
                    }
                else:
                    angle_map = {
                        chord_a: 210.0,
                        chord_c: 350.0,
                        anchor_b: 75.0,
                    }
                    extra_count = max(len(remaining), 1)
                    for index, point_id in enumerate(remaining):
                        angle_map[point_id] = 285.0 - index * (50.0 / extra_count)

                radius = self._infer_radius_from_measurements(angle_map, measurements)
                positions.setdefault(center, [0.0, 0.0])
                cx, cy = positions[center]
                for point_id, angle_deg in angle_map.items():
                    angle = math.radians(angle_deg)
                    positions[point_id] = [
                        round(cx + radius * math.cos(angle), 6),
                        round(cy + radius * math.sin(angle), 6),
                    ]

                ext_length = self._measurement_length_between(
                    measurements,
                    anchor_b,
                    external_point,
                ) or (radius * 1.9)
                chord_dir = [
                    positions[chord_c][0] - positions[chord_a][0],
                    positions[chord_c][1] - positions[chord_a][1],
                ]
                norm = math.hypot(chord_dir[0], chord_dir[1]) or 1.0
                direction = [chord_dir[0] / norm, chord_dir[1] / norm]
                positions[external_point] = [
                    round(positions[anchor_b][0] + direction[0] * ext_length, 6),
                    round(positions[anchor_b][1] + direction[1] * ext_length, 6),
                ]
                return True

        return False

    def _circle_members(
        self,
        circle_id: str,
        circle: Dict[str, Any],
        constraints: List[Dict[str, Any]],
    ) -> List[str]:
        members: List[str] = []
        radius_point = str(circle.get("radius_point", "")).strip()
        if radius_point:
            members.append(radius_point)
        for constraint in constraints:
            if str(constraint.get("type", "")).strip().lower() != "point_on_circle":
                continue
            entities = [str(item).strip() for item in (constraint.get("entities") or []) if str(item).strip()]
            if len(entities) == 2 and entities[1] == circle_id:
                members.append(entities[0])
        return list(dict.fromkeys(members))

    def _classify_parallel_layout(
        self,
        *,
        seg1: Tuple[str, str],
        seg2: Tuple[str, str],
        members: List[str],
        segment_map: Dict[str, Tuple[str, str]],
    ) -> Optional[Tuple[str, str, str, str]]:
        member_set = set(members)
        for chord_seg, ext_seg in ((seg1, seg2), (seg2, seg1)):
            if not all(point in member_set for point in chord_seg):
                continue
            circle_points = [point for point in ext_seg if point in member_set]
            external_points = [point for point in ext_seg if point not in member_set]
            if len(circle_points) != 1 or len(external_points) != 1:
                continue
            anchor_b = circle_points[0]
            external_point = external_points[0]
            chord_a, chord_c = chord_seg

            linked_candidates = []
            for endpoints in segment_map.values():
                if external_point not in endpoints:
                    continue
                other = endpoints[0] if endpoints[1] == external_point else endpoints[1]
                if other in chord_seg:
                    linked_candidates.append(other)
            if linked_candidates:
                chord_c = linked_candidates[0]
                chord_a = chord_seg[0] if chord_seg[1] == chord_c else chord_seg[1]

            return chord_a, chord_c, anchor_b, external_point
        return None

    def _infer_radius_from_measurements(
        self,
        angle_map: Dict[str, float],
        measurements: List[Dict[str, Any]],
    ) -> float:
        for measurement in measurements:
            if str(measurement.get("type", "")).strip().lower() != "length":
                continue
            entities = [str(item).strip() for item in (measurement.get("entities") or []) if str(item).strip()]
            if len(entities) != 2:
                continue
            first, second = entities
            if first not in angle_map or second not in angle_map:
                continue
            value = self._coerce_float(measurement.get("value"), default=0.0)
            if value <= 0:
                continue
            delta = abs(angle_map[first] - angle_map[second]) % 360.0
            delta = min(delta, 360.0 - delta)
            if delta <= 1e-6:
                continue
            radius = value / (2 * math.sin(math.radians(delta) / 2))
            if radius > 0:
                return radius
        return 3.0

    def _measurement_length_between(
        self,
        measurements: List[Dict[str, Any]],
        first: str,
        second: str,
    ) -> Optional[float]:
        pair = {first, second}
        for measurement in measurements:
            if str(measurement.get("type", "")).strip().lower() != "length":
                continue
            entities = [str(item).strip() for item in (measurement.get("entities") or []) if str(item).strip()]
            if len(entities) == 2 and set(entities) == pair:
                value = self._coerce_float(measurement.get("value"), default=0.0)
                if value > 0:
                    return value
        return None

    def _coerce_float(self, value: Any, *, default: float) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    def analyze_image(self, image_path: str, prompt: str) -> str:
        if not image_path or not Path(image_path).exists():
            return f"Error: image file does not exist: {image_path}"

        with open(image_path, "rb") as file:
            image_data = base64.b64encode(file.read()).decode()

        messages = [
            {"role": "system", "content": self.system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_data}"},
                    },
                ],
            },
        ]
        return self._invoke_llm(messages).strip()

    def parse_geometry_spec(self, image_path: str) -> dict:
        bundle = self._analyze_problem_bundle(image_path)
        geometry_facts = bundle.get("geometry_facts") or bundle.get("geometry_spec") or {}
        return self._compile_geometry_spec(
            geometry_facts,
            problem_text=str(bundle.get("problem_text", "")).strip(),
        )

    def parse_geometry_scene(self, image_path: str) -> dict:
        return self.parse_geometry_spec(image_path)

    def _parse_json_like_output(self, result: str, fallback: Dict[str, Any]) -> Dict[str, Any]:
        candidates = [result]
        match = re.search(r"```json\s*([\s\S]*?)\s*```", result)
        if match:
            candidates.append(match.group(1).strip())
        brace_match = re.search(r"\{[\s\S]*\}", result)
        if brace_match:
            candidates.append(brace_match.group(0))

        for candidate in candidates:
            for variant in (candidate, self._clean_json_like_text(candidate)):
                try:
                    return json.loads(variant)
                except json.JSONDecodeError:
                    continue
        return fallback

    def _clean_json_like_text(self, text: str) -> str:
        cleaned = str(text or "")
        cleaned = re.sub(r"```json\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = cleaned.replace("```", "")
        cleaned = re.sub(r"//.*?$", "", cleaned, flags=re.MULTILINE)
        cleaned = re.sub(r"/\*[\s\S]*?\*/", "", cleaned)
        cleaned = re.sub(r"(\})(\s*\{)", r"\1,\2", cleaned)
        cleaned = re.sub(r"(\])(\s*\{)", r"\1,\2", cleaned)
        cleaned = re.sub(r",\s*([}\]])", r"\1", cleaned)
        return cleaned.strip()
