import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";

/**
 * API 및 타입 정의
 * 별도의 파일 의존성 문제를 해결하기 위해 필요한 통신 로직을 내부에 통합했습니다.
 */
const api = axios.create({ baseURL: "http://127.0.0.1:8000" });

export type Project = {
  id: number;
  name: string;
  project_type: "VOC" | "REGULAR";
  expected_end_date: string | null;
  status: "ONGOING" | "CLOSED";
  created_at: string;
};

export type ResultSchema = {
  id: number;
  project_id: number;
  key: string;
  label: string;
  value_type: "quantitative" | "qualitative" | "categorical";
  unit?: string | null;
  description?: string | null;
  options?: string[] | null;
  order: number; // 백엔드 정렬 순서 필드
  created_at: string;
};

export type OutputConfig = {
  id: number;
  project_id: number;
  included_keys: string[];
  created_at: string;
};

// API 함수들
const getProject = async (id: number) =>
  (await api.get<Project>(`/api/projects/${id}`)).data;
const listResultSchemas = async (projectId: number) => {
  const r = await api.get<ResultSchema[]>(
    `/api/projects/${projectId}/result-schemas`
  );
  return r.data.sort((a, b) => a.order - b.order); // 정렬 순서에 따른 정렬
};
const createResultSchema = async (payload: any) =>
  (await api.post<ResultSchema>("/api/result-schemas", payload)).data;
const updateResultSchema = async (id: number, payload: any) =>
  (await api.patch<ResultSchema>(`/api/result-schemas/${id}`, payload)).data;
const deleteResultSchema = async (id: number) =>
  (await api.delete(`/api/result-schemas/${id}`)).data;
const getOutputConfig = async (projectId: number) =>
  (
    await api.get<OutputConfig | null>(
      `/api/projects/${projectId}/output-config`
    )
  ).data;
const upsertOutputConfig = async (payload: any) =>
  (await api.put<OutputConfig>("/api/output-config", payload)).data;

/**
 * ProjectDetailPage: 특정 프로젝트의 상세 정보를 조회하고,
 * 실험에서 기록할 데이터 항목(스키마) 및 출력 설정을 관리하는 페이지입니다.
 */
export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = Number(params.projectId);

  // 상태 관리: 프로젝트 정보 및 설정된 항목 리스트
  const [projectName, setProjectName] = useState("");
  const [schemas, setSchemas] = useState<ResultSchema[]>([]);
  const [included, setIncluded] = useState<string[]>([]);

  // 신규 항목 입력을 위한 상태 (한글화 반영)
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<
    "quantitative" | "qualitative" | "categorical"
  >("quantitative");
  const [unit, setUnit] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState("");
  const [order, setOrder] = useState(0); // 정렬 순서 필드

  /**
   * 서버로부터 프로젝트 정보, 결과 항목 리스트, 출력 설정 데이터를 가져오는 함수
   */
  async function refresh() {
    try {
      if (!projectId) return;
      const p = await getProject(projectId);
      setProjectName(p.name);

      const s = await listResultSchemas(projectId);
      setSchemas(s);

      // 편의성: 다음 추가될 항목의 순서를 기존 최대값 + 1로 자동 설정
      if (s.length > 0) {
        const maxOrder = Math.max(...s.map((item) => item.order));
        setOrder(maxOrder + 1);
      } else {
        setOrder(0);
      }

      const oc = await getOutputConfig(projectId);
      setIncluded(oc?.included_keys ?? []);
    } catch (err) {
      console.error("로드 실패:", err);
    }
  }

  // 컴포넌트 마운트 시 데이터 호출
  useEffect(() => {
    refresh();
  }, [projectId]);

  /**
   * 새로운 결과 측정 항목(Schema) 생성 처리
   */
  async function onAddSchema() {
    if (!key.trim() || !label.trim()) {
      alert("시스템 키와 항목 명칭은 필수 입력 사항입니다.");
      return;
    }

    try {
      await createResultSchema({
        project_id: projectId,
        key: key.trim(),
        label: label.trim(),
        value_type: type,
        unit: unit || null,
        description: description || null,
        options: options
          ? options
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean)
          : null,
        order: order,
      });

      // 입력 폼 초기화
      setKey("");
      setLabel("");
      setType("quantitative");
      setUnit("");
      setDescription("");
      setOptions("");
      setOrder(0);

      await refresh();
    } catch (err: any) {
      alert(
        `생성 실패: ${
          err.response?.data?.detail || "서버 오류가 발생했습니다."
        }`
      );
    }
  }

  /**
   * 항목 정의 삭제 처리
   */
  async function onDeleteSchema(id: number) {
    if (
      !window.confirm(
        "항목을 삭제하시겠습니까? 관련 실험 데이터 조회에 영향을 줄 수 있습니다."
      )
    )
      return;
    try {
      await deleteResultSchema(id);
      await refresh();
    } catch (err) {
      alert("삭제 중 오류가 발생했습니다.");
    }
  }

  /**
   * 분석 페이지에 포함할 항목 토글 로직
   */
  function toggleIncluded(k: string) {
    setIncluded((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]
    );
  }

  /**
   * 항목 내용(라벨, 타입 등) 수정 처리
   */
  async function onUpdateSchema(s: ResultSchema, patch: Partial<ResultSchema>) {
    const updatedPayload = { ...patch };

    // 선택형(categorical) 타입 필수 조건 체크
    if (
      patch.value_type === "categorical" &&
      (!s.options || s.options.length === 0) &&
      !patch.options
    ) {
      updatedPayload.options = ["기본 선택지"];
    }

    try {
      await updateResultSchema(s.id, updatedPayload);
      await refresh();
    } catch (err: any) {
      if (err.response?.status === 422) {
        alert(
          "데이터 검증 오류: 선택형 항목은 반드시 선택지(options)가 필요합니다."
        );
      } else {
        alert("수정 중 오류가 발생했습니다.");
      }
    }
  }

  /**
   * 체크된 항목 리스트를 분석 설정으로 저장
   */
  async function saveIncluded() {
    try {
      await upsertOutputConfig({
        project_id: projectId,
        included_keys: included,
      });
      alert("출력 항목 설정이 성공적으로 저장되었습니다.");
      await refresh();
    } catch (err) {
      alert("저장 중 오류가 발생했습니다.");
    }
  }

  return (
    <div className="row" style={{ alignItems: "flex-start", gap: "20px" }}>
      {/* 왼쪽 카드: 프로젝트 개요 */}
      <div className="card" style={{ flex: "1 1 300px" }}>
        <div
          style={{
            fontSize: "12px",
            color: "var(--primary-color)",
            fontWeight: "bold",
          }}
        >
          PROJECT #{projectId}
        </div>
        <h2 style={{ marginTop: "8px", marginBottom: "20px" }}>
          {projectName}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <Link
            className="btn"
            to={`/projects/${projectId}/experiments/new`}
            style={{ textAlign: "center" }}
          >
            🧪 신규 실험 기록
          </Link>
          <Link
            className="btn btn-secondary"
            to={`/projects/${projectId}/output`}
            style={{ textAlign: "center" }}
          >
            📊 분석 결과 보기
          </Link>
        </div>
      </div>

      {/* 오른쪽 카드: 항목(Schema) 관리 섹션 */}
      <div className="card" style={{ flex: "3 1 700px" }}>
        <h3 style={{ marginBottom: "8px" }}>실험 결과 항목(Schema) 설정</h3>
        <p className="small" style={{ marginBottom: "20px" }}>
          실험에서 기록할 데이터(점도, 농도 등)의 규격과 순서를 정의합니다.
        </p>

        {/* 신규 항목 등록 폼 */}
        <div
          className="row"
          style={{
            backgroundColor: "#f9fafb",
            padding: "15px",
            borderRadius: "8px",
            gap: "10px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              width: "100%",
            }}
          >
            <input
              className="input"
              style={{ flex: "1 1 180px" }}
              placeholder="시스템 키 (영문/숫자)"
              value={key}
              onChange={(e) =>
                setKey(e.target.value.replace(/[^a-zA-Z0-9_\-]/g, ""))
              }
            />
            <input
              className="input"
              style={{ flex: "1 1 180px" }}
              placeholder="표시 명칭 (예: 접착력)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <select
              className="input"
              style={{ flex: "1 1 150px" }}
              value={type}
              onChange={(e) => setType(e.target.value as any)}
            >
              <option value="quantitative">수치형 (Quantitative)</option>
              <option value="qualitative">서술형 (Qualitative)</option>
              <option value="categorical">선택형 (Categorical)</option>
            </select>
            <input
              className="input"
              style={{ width: "70px" }}
              type="number"
              placeholder="순서"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
            />
            <input
              className="input"
              style={{ width: "100px" }}
              placeholder="단위(unit)"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </div>
          <div style={{ width: "100%", display: "flex", gap: "10px" }}>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="항목 상세 설명"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {type === "categorical" && (
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="선택지 (콤마로 구분)"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
              />
            )}
            <button
              className="btn"
              onClick={onAddSchema}
              style={{ whiteSpace: "nowrap" }}
            >
              + 추가
            </button>
          </div>
        </div>

        {/* 측정 항목 테이블 */}
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: "50px", textAlign: "center" }}>출력</th>
              <th style={{ width: "60px", textAlign: "center" }}>순서</th>
              <th>키 / 표시 명칭</th>
              <th style={{ width: "120px" }}>데이터 유형</th>
              <th>상세 내용 (단위/설명/옵션)</th>
              <th style={{ width: "60px", textAlign: "center" }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {schemas.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    textAlign: "center",
                    padding: "40px",
                    color: "#999",
                  }}
                >
                  정의된 항목이 없습니다. 상단에서 항목을 추가해 주세요.
                </td>
              </tr>
            ) : (
              schemas.map((s) => (
                <tr key={s.id}>
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={included.includes(s.key)}
                      onChange={() => toggleIncluded(s.key)}
                    />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <input
                      className="input"
                      type="number"
                      style={{
                        width: "45px",
                        padding: "4px",
                        textAlign: "center",
                      }}
                      value={s.order}
                      onChange={(e) =>
                        onUpdateSchema(s, { order: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td>
                    <div style={{ fontSize: "11px", color: "#888" }}>
                      {s.key}
                    </div>
                    <input
                      className="input"
                      style={{
                        width: "100%",
                        border: "none",
                        background: "transparent",
                        padding: "2px 0",
                        fontWeight: "bold",
                      }}
                      value={s.label}
                      onChange={(e) =>
                        onUpdateSchema(s, { label: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <select
                      className="input"
                      style={{
                        width: "100%",
                        fontSize: "12px",
                        padding: "4px",
                      }}
                      value={s.value_type}
                      onChange={(e) =>
                        onUpdateSchema(s, { value_type: e.target.value as any })
                      }
                    >
                      <option value="quantitative">수치형</option>
                      <option value="qualitative">서술형</option>
                      <option value="categorical">선택형</option>
                    </select>
                  </td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      <input
                        className="input"
                        style={{
                          width: "100%",
                          fontSize: "12px",
                          padding: "4px",
                        }}
                        placeholder="단위"
                        value={s.unit ?? ""}
                        onChange={(e) =>
                          onUpdateSchema(s, { unit: e.target.value || null })
                        }
                      />
                      {s.value_type === "categorical" && (
                        <input
                          className="input"
                          style={{
                            width: "100%",
                            fontSize: "11px",
                            padding: "4px",
                          }}
                          placeholder="선택지 (콤마 구분)"
                          value={s.options?.join(",") ?? ""}
                          onChange={(e) =>
                            onUpdateSchema(s, {
                              options: e.target.value
                                ? e.target.value
                                    .split(",")
                                    .map((v) => v.trim())
                                    .filter(Boolean)
                                : null,
                            })
                          }
                        />
                      )}
                      <input
                        className="input"
                        style={{
                          width: "100%",
                          fontSize: "11px",
                          padding: "4px",
                        }}
                        placeholder="설명"
                        value={s.description ?? ""}
                        onChange={(e) =>
                          onUpdateSchema(s, {
                            description: e.target.value || null,
                          })
                        }
                      />
                    </div>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      className="btn-small"
                      style={{
                        color: "var(--danger-color)",
                        background: "none",
                        border: "none",
                      }}
                      onClick={() => onDeleteSchema(s.id)}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* 출력 설정 저장 */}
        <div
          style={{
            marginTop: "25px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid #eee",
            paddingTop: "15px",
          }}
        >
          <span className="small">
            * '출력' 체크된 항목이 분석 페이지의 테이블과 차트에 표시됩니다.
          </span>
          <button className="btn" onClick={saveIncluded}>
            분석 출력 설정 저장
          </button>
        </div>
      </div>
    </div>
  );
}
