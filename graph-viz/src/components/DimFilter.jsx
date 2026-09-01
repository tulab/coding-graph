// 维度筛选（antd Segmented 三段按钮组）：由图谱声明的维度字典（graph.dims）驱动，替代原硬编码层级筛选。
// 每个维度取值一组"显示/半透明/隐藏"左中右三键切换；隐藏即剔除、半透明即节点自身 alpha 淡化，
// 具体落库在 sigmaEngine.setDimState（重排布局 / 边淡化）。React 仅用于本面板，其余工具栏仍为原生 DOM。
import React from "react";
import { createRoot } from "react-dom/client";
import { ConfigProvider, Segmented } from "antd";

const OPTIONS = [
  { label: "显示", value: "visible" },
  { label: "半透明", value: "semi" },
  { label: "隐藏", value: "hidden" },
];

function buildState(dims) {
  const s = {};
  for (const dim of dims) {
    s[dim.key] = Object.fromEntries((dim.values || []).map((v) => [v.code, "visible"]));
  }
  return s;
}

function DimPanel({ dims, state, onToggle }) {
  return (
    <div className="kg-dimpanel" onClick={(e) => e.stopPropagation()}>
      {dims.length === 0 ? (
        <div className="kg-dim-hint">图谱未声明维度</div>
      ) : (
        dims.map((dim) => (
          <div key={dim.key} className="kg-dim-group">
            <div className="kg-dim-title">{dim.label || dim.key}</div>
            {dim.values.map((v) => (
              <div key={v.code} className="kg-dim-row">
                <span className="kg-dim-name">{v.label || v.code}</span>
                <Segmented
                  size="small"
                  options={OPTIONS}
                  value={state[dim.key]?.[v.code] ?? "visible"}
                  onChange={(val) => onToggle(dim.key, v.code, val)}
                />
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

export function createDimFilter({ dims = [], onChange }) {
  let state = buildState(dims);

  const wrap = document.createElement("div");
  wrap.className = "kg-dimfilter";

  const trigger = document.createElement("button");
  trigger.className = "kg-btn";
  trigger.type = "button";
  trigger.textContent = "维度筛选 ▾";
  wrap.append(trigger);

  const panel = document.createElement("div");
  panel.className = "kg-popover kg-hidden";
  wrap.append(panel);

  const root = createRoot(panel);
  function render() {
    root.render(
      <ConfigProvider theme={{ token: { colorPrimary: "#8a7a5f", colorText: "#4a4238", borderRadius: 8 } }}>
        <DimPanel
          dims={dims}
          state={state}
          onToggle={(dimKey, valueCode, next) => {
            state[dimKey] = { ...state[dimKey], [valueCode]: next };
            render();
            onChange(dimKey, valueCode, next);
          }}
        />
      </ConfigProvider>
    );
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.classList.toggle("kg-hidden");
  });
  document.addEventListener("click", () => panel.classList.add("kg-hidden"));

  render();
  return {
    el: wrap,
    getState: () => state,
    // 图谱切换时重建维度面板（各值重置为"显示"）
    setDims(nextDims) {
      dims = nextDims;
      state = buildState(nextDims);
      render();
    },
  };
}
