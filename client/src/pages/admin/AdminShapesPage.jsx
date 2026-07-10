import { useState } from "react";
import GeneralShapesTab from "./adminShapes/GeneralShapesTab.jsx";
import CustomShapesTab from "./adminShapes/CustomShapesTab.jsx";

/**
 * Port of ui/admin_shapes.py::admin_shape_formula_management_page.
 * Two top-level tabs, each an internal state machine (list/add/view/edit).
 */
export default function AdminShapesPage() {
  const [activeTab, setActiveTab] = useState("general");

  return (
    <div>
      <h1>Shape & Formula Management</h1>
      <p style={{ color: "var(--muted)" }}>Home • Master Data • Shapes & Formulas</p>

      <hr />

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <button
          className={activeTab === "general" ? "btn btn-primary" : "btn btn-secondary"}
          onClick={() => setActiveTab("general")}
        >
          General Shapes & Formulas
        </button>
        <button
          className={activeTab === "custom" ? "btn btn-primary" : "btn btn-secondary"}
          onClick={() => setActiveTab("custom")}
        >
          Custom Shapes & Formulas
        </button>
      </div>

      {activeTab === "general" ? <GeneralShapesTab /> : <CustomShapesTab />}
    </div>
  );
}
