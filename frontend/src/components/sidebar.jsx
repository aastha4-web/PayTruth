function Sidebar({ activeSection, setActiveSection }) {
  const navigation = [
    {
      group: "MAIN",
      items: [
        { id: "overview", icon: "⌂", label: "Overview" },
      ],
    },
    {
      group: "FINANCIAL INTELLIGENCE",
      items: [
        { id: "reconciliation", icon: "◈", label: "Reconciliation" },
        { id: "payments", icon: "▣", label: "Payment Health" },
        { id: "refunds", icon: "↗", label: "Refunds & Adjustments" },
      ],
    },
    {
      group: "AI INTELLIGENCE",
      items: [
        { id: "investigation", icon: "✦", label: "AI Investigation" },
        { id: "fraud", icon: "◉", label: "Fraud & Anomaly" },
        { id: "risk", icon: "◇", label: "Risk Prioritization" },
      ],
    },
    {
      group: "CONTROL CENTER",
      items: [
        { id: "actions", icon: "⚡", label: "Action Center" },
        { id: "notifications", icon: "●", label: "Notifications" },
        { id: "audit", icon: "▤", label: "Audit Trail" },
      ],
    },
  ];

  return (
    <aside className="sidebar">

      <div className="brand">
        <div className="brand-mark">
          P
        </div>

        <div>
          <div className="brand-name">
            PayTruth
          </div>

          <div className="brand-ai">
            AI FINANCIAL CONTROL
          </div>
        </div>
      </div>

      <div className="sidebar-divider" />

      <nav>
        {navigation.map((section) => (
          <div
            className="nav-section"
            key={section.group}
          >
            <div className="nav-group-title">
              {section.group}
            </div>

            {section.items.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${
                  activeSection === item.id
                    ? "nav-item-active"
                    : ""
                }`}
                onClick={() =>
                  setActiveSection(item.id)
                }
              >
                <span className="nav-icon">
                  {item.icon}
                </span>

                <span>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">

        <div className="security-card">

          <div className="security-icon">
            ✓
          </div>

          <div>
            <strong>
              Protected Mode
            </strong>

            <span>
              Human approval enabled
            </span>
          </div>

        </div>

        <div className="sidebar-version">
          PayTruth AI · Demo Environment
        </div>

      </div>

    </aside>
  );
}

export default Sidebar;