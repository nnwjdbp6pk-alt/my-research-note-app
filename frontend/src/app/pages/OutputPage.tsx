import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import axios from "axios";

// 차트 시각화 라이브러리 (Recharts)
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
} from "recharts";

/**
 * API 및 타입 정의
 */
const api = axios.create({ baseURL: "http://127.0.0.1:8000" });

export type ResultSchema = {
  id: number;
  project_id: number;
  key: string;
  label: string;
  value_type: "quantitative" | "qualitative" | "categorical";
  unit?: string | null;
  options?: string[] | null;
  order: number;
};

export type Experiment = {
  id: number;
  project_id: number;
  name: string;
  author: string;
  purpose: string;
  materials: {
    name: string;
    amount: number[];
    unit: "g" | "kg";
    ratio: number;
  }[];
  result_values: Record<string, any>;
  created_at: string;
};

export type OutputConfig = {
  id: number;
  project_id: number;
  included_keys: string[];
};

const listResultSchemas = async (projectId: number) =>
  (await api.get<ResultSchema[]>(`/api/projects/${projectId}/result-schemas`))
    .data;
const listExperiments = async (projectId: number) =>
  (await api.get<Experiment[]>(`/api/projects/${projectId}/experiments`)).data;
const getOutputConfig = async (projectId: number) =>
  (
    await api.get<OutputConfig | null>(
      `/api/projects/${projectId}/output-config`
    )
  ).data;
const deleteExperiment = async (id: number) =>
  (await api.delete(`/api/experiments/${id}`)).data;

/**
 * OutputPage: 실험 필터링 및 실험별 비교 Box Plot이 포함된 분석 페이지
 */
export default function OutputPage() {
  const params = useParams();
  const projectId = Number(params.projectId);
  const navigate = useNavigate();

  const [schemas, setSchemas] = useState<ResultSchema[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [included, setIncluded] = useState<string[]>([]);

  // 그래프에 표시할 실험 ID 목록 상태
  const [selectedExpIds, setSelectedExpIds] = useState<number[]>([]);

  // 개별 차트 항목 선택 상태
  const [barKey, setBarKey] = useState<string>("");
  const [lineKey, setLineKey] = useState<string>("");
  const [boxKey, setBoxKey] = useState<string>("");
  const [scatterXKey, setScatterXKey] = useState<string>("");
  const [scatterYKey, setScatterYKey] = useState<string>("");

  const includedSchemas = useMemo(
    () =>
      schemas
        .filter((s) => included.includes(s.key))
        .sort((a, b) => a.order - b.order),
    [schemas, included]
  );
  const quantitativeSchemas = useMemo(
    () => includedSchemas.filter((s) => s.value_type === "quantitative"),
    [includedSchemas]
  );

  async function refresh() {
    try {
      const s = await listResultSchemas(projectId);
      setSchemas(s);
      const e = await listExperiments(projectId);
      setExperiments(e);

      if (selectedExpIds.length === 0 && e.length > 0) {
        setSelectedExpIds(e.map((ex) => ex.id));
      }

      const oc = await getOutputConfig(projectId);
      const inclKeys = oc?.included_keys ?? [];
      setIncluded(inclKeys);

      const qKeys = inclKeys.filter((k) =>
        s.find((x) => x.key === k && x.value_type === "quantitative")
      );
      if (qKeys.length > 0) {
        if (!barKey) setBarKey(qKeys[0]);
        if (!lineKey) setLineKey(qKeys[0]);
        if (!boxKey) setBoxKey(qKeys[0]);
        if (!scatterXKey) setScatterXKey(qKeys[0]);
        if (qKeys.length > 1 && !scatterYKey) setScatterYKey(qKeys[1]);
      }
    } catch (err) {
      console.error("데이터 로드 실패:", err);
    }
  }

  useEffect(() => {
    // 현재 선택된 barKey가 유효한 정량적 스키마 목록에 없으면, 목록의 첫 번째로 재설정
    if (quantitativeSchemas.length > 0) {
      const validKeys = quantitativeSchemas.map((s) => s.key);

      if (!barKey || !validKeys.includes(barKey)) setBarKey(validKeys[0]);
      if (!lineKey || !validKeys.includes(lineKey)) setLineKey(validKeys[0]);
      if (!boxKey || !validKeys.includes(boxKey)) setBoxKey(validKeys[0]);

      // Scatter는 X, Y 두 개가 필요하므로 조금 더 신경 씀
      if (!scatterXKey || !validKeys.includes(scatterXKey))
        setScatterXKey(validKeys[0]);
      if (!scatterYKey || !validKeys.includes(scatterYKey)) {
        // 가능하다면 X와 다른 키를 Y로 기본 설정
        setScatterYKey(validKeys.length > 1 ? validKeys[1] : validKeys[0]);
      }
    }
  }, [quantitativeSchemas]); // 스키마 목록이 바뀔 때마다 실행

  const toggleExpSelection = (id: number) => {
    setSelectedExpIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAllExps = () => setSelectedExpIds(experiments.map((e) => e.id));
  const deselectAllExps = () => setSelectedExpIds([]);

  const visibleExperiments = useMemo(
    () => experiments.filter((ex) => selectedExpIds.includes(ex.id)),
    [experiments, selectedExpIds]
  );

  const toNumericSummary = (value: any) => {
    if (Array.isArray(value)) {
      const nums = value.map((v: any) => Number(v)).filter((v) => !isNaN(v));
      if (nums.length === 0) return NaN;
      const sum = nums.reduce((s, v) => s + v, 0);
      return sum / nums.length;
    }
    return Number(value ?? NaN);
  };

  const getChartData = (key: string) => {
    if (!key) return [];
    return visibleExperiments
      .map((ex) => ({
        name: ex.name,
        value: toNumericSummary(ex.result_values?.[key]),
      }))
      .filter((d) => !isNaN(d.value))
      .reverse();
  };

  const barData = useMemo(
    () => getChartData(barKey),
    [visibleExperiments, barKey]
  );
  const lineData = useMemo(
    () => getChartData(lineKey),
    [visibleExperiments, lineKey]
  );

  // 실험별 Box Plot 데이터 생성 로직
  const getBoxStats = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const median = (arr: number[]) => {
      const mid = Math.floor(arr.length / 2);
      return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
    };
    const mid = Math.floor(sorted.length / 2);
    const lower = sorted.slice(0, mid);
    const upper =
      sorted.length % 2 === 0 ? sorted.slice(mid) : sorted.slice(mid + 1);

    return {
      min: sorted[0],
      q1: lower.length ? median(lower) : sorted[0],
      median: median(sorted),
      q3: upper.length ? median(upper) : sorted[sorted.length - 1],
      max: sorted[sorted.length - 1],
    };
  };

  const boxPlotSeries = useMemo(() => {
    if (!boxKey || visibleExperiments.length === 0) return [];

    const extractValues = (val: any): number[] => {
      if (Array.isArray(val))
        return val.map((v: any) => Number(v)).filter((v) => !isNaN(v));
      const num = Number(val ?? NaN);
      return isNaN(num) ? [] : [num];
    };

    const flattened = visibleExperiments.flatMap((ex) =>
      extractValues(ex.result_values?.[boxKey])
    );
    if (flattened.length === 0) return [];

    const globalMax = Math.max(...flattened);
    const globalMin = Math.min(...flattened);
    const range = globalMax - globalMin || 1;
    const padding = range * 0.1;
    const yMin = globalMin - padding;
    const yMax = globalMax + padding;
    const yRange = yMax - yMin;

    const getPos = (v: number) => 180 - ((v - yMin) / yRange) * 160;

    return visibleExperiments
      .map((ex) => {
        const vals = extractValues(ex.result_values?.[boxKey]);
        if (vals.length === 0) return null;

        const stats = getBoxStats(vals);
        return {
          name: ex.name,
          rawLabel: vals.length === 1 ? vals[0].toString() : `n=${vals.length}`,
          stats,
          pos: {
            min: getPos(stats.min),
            q1: getPos(stats.q1),
            median: getPos(stats.median),
            q3: getPos(stats.q3),
            max: getPos(stats.max),
          },
        };
      })
      .filter((d) => d !== null);
  }, [visibleExperiments, boxKey]);

  const scatterData = useMemo(() => {
    if (!scatterXKey || !scatterYKey) return [];
    return visibleExperiments
      .map((ex) => ({
        name: ex.name,
        x: toNumericSummary(ex.result_values?.[scatterXKey]),
        y: toNumericSummary(ex.result_values?.[scatterYKey]),
      }))
      .filter((d) => !isNaN(d.x) && !isNaN(d.y));
  }, [visibleExperiments, scatterXKey, scatterYKey]);

  async function onDeleteExperiment(id: number, name: string) {
    if (!window.confirm(`[${name}] 기록을 삭제하시겠습니까?`)) return;
    try {
      await deleteExperiment(id);
      await refresh();
    } catch (err) {
      alert("삭제 실패");
    }
  }

  return (
    <div className="card">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          marginBottom: "20px",
          alignItems: "center",
        }}
      >
        <h2 style={{ margin: 0 }}>📊 분석 리포트 (프로젝트 #{projectId})</h2>
        <div className="row">
          <Link className="btn btn-secondary" to={`/projects/${projectId}`}>
            프로젝트 설정
          </Link>
          <Link className="btn" to={`/projects/${projectId}/experiments/new`}>
            + 실험 추가
          </Link>
        </div>
      </div>

      <div
        className="card"
        style={{ backgroundColor: "#f8fafc", marginBottom: "30px" }}
      >
        <div className="row" style={{ gap: "30px", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 300px" }}>
            <div
              className="row"
              style={{ justifyContent: "space-between", marginBottom: "10px" }}
            >
              <strong className="small">
                분석 대상 실험 선택 ({selectedExpIds.length}/
                {experiments.length})
              </strong>
              <div style={{ display: "flex", gap: "5px" }}>
                <button
                  className="btn-small"
                  onClick={selectAllExps}
                  style={{ fontSize: "10px" }}
                >
                  전체
                </button>
                <button
                  className="btn-small"
                  onClick={deselectAllExps}
                  style={{ fontSize: "10px" }}
                >
                  해제
                </button>
              </div>
            </div>
            <div
              style={{
                maxHeight: "120px",
                overflowY: "auto",
                backgroundColor: "white",
                border: "1px solid #ddd",
                borderRadius: "6px",
                padding: "8px",
              }}
            >
              {experiments.length === 0 ? (
                <div
                  className="small"
                  style={{ textAlign: "center", padding: "10px" }}
                >
                  실험 데이터가 없습니다.
                </div>
              ) : (
                experiments.map((ex) => (
                  <label
                    key={ex.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "2px 0",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedExpIds.includes(ex.id)}
                      onChange={() => toggleExpSelection(ex.id)}
                    />
                    <span
                      className="small"
                      style={{
                        fontWeight: selectedExpIds.includes(ex.id)
                          ? "bold"
                          : "normal",
                      }}
                    >
                      {ex.name}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div style={{ flex: "2 1 400px" }}>
            <strong
              className="small"
              style={{ display: "block", marginBottom: "10px" }}
            >
              차트별 분석 항목 설정
            </strong>
            <div className="row" style={{ gap: "10px", flexWrap: "wrap" }}>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                <label className="small">Bar 항목</label>
                <select
                  className="input"
                  style={{ fontSize: "12px", padding: "4px 8px" }}
                  value={barKey}
                  onChange={(e) => setBarKey(e.target.value)}
                >
                  <option value="">선택</option>
                  {quantitativeSchemas.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                <label className="small">Line 항목</label>
                <select
                  className="input"
                  style={{ fontSize: "12px", padding: "4px 8px" }}
                  value={lineKey}
                  onChange={(e) => setLineKey(e.target.value)}
                >
                  <option value="">선택</option>
                  {quantitativeSchemas.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                <label className="small">Box Plot 항목</label>
                <select
                  className="input"
                  style={{ fontSize: "12px", padding: "4px 8px" }}
                  value={boxKey}
                  onChange={(e) => setBoxKey(e.target.value)}
                >
                  <option value="">선택</option>
                  {quantitativeSchemas.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                <label className="small">Scatter X</label>
                <select
                  className="input"
                  style={{ fontSize: "12px", padding: "4px 8px" }}
                  value={scatterXKey}
                  onChange={(e) => setScatterXKey(e.target.value)}
                >
                  <option value="">선택</option>
                  {quantitativeSchemas.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                <label className="small">Scatter Y</label>
                <select
                  className="input"
                  style={{ fontSize: "12px", padding: "4px 8px" }}
                  value={scatterYKey}
                  onChange={(e) => setScatterYKey(e.target.value)}
                >
                  <option value="">선택</option>
                  {quantitativeSchemas.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: "20px", marginBottom: "30px" }}>
        <div
          className="card"
          style={{
            flex: "1 1 48%",
            minWidth: "400px",
            boxSizing: "border-box",
          }}
        >
          <strong className="small">실험별 비교 (Bar) : {barKey}</strong>
          <div style={{ width: "100%", height: 250, marginTop: "10px" }}>
            <ResponsiveContainer>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <ReTooltip />
                <Bar
                  dataKey="value"
                  fill="var(--primary-color)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          className="card"
          style={{
            flex: "1 1 48%",
            minWidth: "400px",
            boxSizing: "border-box",
          }}
        >
          <strong className="small">경향성 분석 (Line) : {lineKey}</strong>
          <div style={{ width: "100%", height: 250, marginTop: "10px" }}>
            <ResponsiveContainer>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <ReTooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#22c55e"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div
          className="card"
          style={{
            flex: "1 1 48%",
            minWidth: "400px",
            boxSizing: "border-box",
          }}
        >
          <strong className="small">상관관계 (Scatter)</strong>
          <div style={{ width: "100%", height: 250, marginTop: "10px" }}>
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name={scatterXKey}
                  fontSize={10}
                  unit={schemas.find((s) => s.key === scatterXKey)?.unit || ""}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={scatterYKey}
                  fontSize={10}
                  unit={schemas.find((s) => s.key === scatterYKey)?.unit || ""}
                />
                <ReTooltip cursor={{ strokeDasharray: "3 3" }} />
                <Scatter name="실험" data={scatterData} fill="#f97316" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 개별 실험별 Box Plot 차트 영역 */}
        <div
          className="card"
          style={{
            flex: "1 1 48%",
            minWidth: "400px",
            boxSizing: "border-box",
          }}
        >
          <strong className="small">
            실험별 데이터 분포 (Box Plot) : {boxKey}
          </strong>
          <div
            style={{
              width: "100%",
              height: 250,
              marginTop: "10px",
              overflowX: "auto",
            }}
          >
            {boxPlotSeries.length > 0 ? (
              <svg
                width={Math.max(400, boxPlotSeries.length * 80)}
                height="240"
                style={{ display: "block", margin: "0 auto" }}
              >
                {boxPlotSeries.map((item, idx) => {
                  const x = 60 + idx * 80;
                  return (
                    <g key={idx}>
                      {/* 수직 Whisker 선 */}
                      <line
                        x1={x}
                        y1={item.pos.min}
                        x2={x}
                        y2={item.pos.max}
                        stroke="#ccc"
                        strokeWidth="2"
                        strokeDasharray="3"
                      />

                      {/* 수염 끝부분 (Min/Max) */}
                      <line
                        x1={x - 15}
                        y1={item.pos.min}
                        x2={x + 15}
                        y2={item.pos.min}
                        stroke="#666"
                        strokeWidth="1.5"
                      />
                      <line
                        x1={x - 15}
                        y1={item.pos.max}
                        x2={x + 15}
                        y2={item.pos.max}
                        stroke="#666"
                        strokeWidth="1.5"
                      />

                      {/* Box (Q1 ~ Q3) */}
                      <rect
                        x={x - 20}
                        y={item.pos.q3}
                        width="40"
                        height={Math.max(2, item.pos.q1 - item.pos.q3)}
                        fill="var(--primary-color)"
                        fillOpacity="0.2"
                        stroke="var(--primary-color)"
                        strokeWidth="1"
                      />

                      {/* 중앙값 (Median) */}
                      <line
                        x1={x - 25}
                        y1={item.pos.median}
                        x2={x + 25}
                        y2={item.pos.median}
                        stroke="var(--primary-color)"
                        strokeWidth="3"
                      />

                      {/* 실험명 라벨 */}
                      <text
                        x={x}
                        y="210"
                        fontSize="10"
                        fill="#666"
                        textAnchor="middle"
                        fontWeight="bold"
                      >
                        {item.name.length > 8
                          ? item.name.substring(0, 8) + ".."
                          : item.name}
                      </text>

                      {/* 데이터 라벨: 단일값은 값, 배열은 개수 표시 */}
                      <text
                        x={x}
                        y={item.pos.median - 10}
                        fontSize="10"
                        fill="var(--primary-color)"
                        textAnchor="middle"
                        fontWeight="bold"
                      >
                        {item.rawLabel}
                      </text>
                    </g>
                  );
                })}
                {/* Y축 가이드선 (임시) */}
                <line x1="30" y1="20" x2="30" y2="180" stroke="#eee" />
              </svg>
            ) : (
              <div
                className="small"
                style={{
                  color: "#999",
                  textAlign: "center",
                  marginTop: "100px",
                }}
              >
                분석할 데이터가 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0, marginBottom: "15px" }}>실험 상세 기록</h3>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr style={{ backgroundColor: "#f9fafb" }}>
                <th>실험명</th>
                {includedSchemas.map((s) => (
                  <th key={s.key}>{s.label}</th>
                ))}
                <th style={{ textAlign: "center" }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {experiments.map((ex) => (
                <tr key={ex.id}>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          backgroundColor: selectedExpIds.includes(ex.id)
                            ? "var(--primary-color)"
                            : "#ddd",
                        }}
                        title={
                          selectedExpIds.includes(ex.id)
                            ? "차트 포함 중"
                            : "차트 제외됨"
                        }
                      />
                      <strong>{ex.name}</strong>
                    </div>
                  </td>
                  {includedSchemas.map((s) => (
                    <td key={s.key}>{ex.result_values[s.key] ?? "-"}</td>
                  ))}
                  <td style={{ textAlign: "center" }}>
                    <div
                      style={{
                        display: "flex",
                        gap: "5px",
                        justifyContent: "center",
                      }}
                    >
                      <button
                        className="btn-small"
                        onClick={() =>
                          navigate(
                            `/projects/${projectId}/experiments/${ex.id}/edit`
                          )
                        }
                      >
                        수정
                      </button>
                      <button
                        className="btn-small"
                        style={{ color: "var(--danger-color)" }}
                        onClick={() => onDeleteExperiment(ex.id, ex.name)}
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
