import { useState } from "react";

import Sidebar from "./components/sidebar";
import Overview from "./components/Overview";
import Reconciliation from "./components/reconciliation";
import PaymentIntelligence from "./components/paymentintelligence";
import FraudIntelligence from "./components/fraudIntelligence";
import ActionCenter from "./components/actioncenter";
import RefundsAdjustments from "./components/refundsAdjustments";
import Investigation from "./components/investigation";
import RiskPrioritization from "./components/riskPrioritization";
import Notifications from "./components/notifications";
import AuditTrail from "./components/auditTrail";

import "./App.css";

function App() {
  const [activeSection, setActiveSection] =
    useState("Overview");

  const handleInvestigation = (transactionId) => {
    console.log(
      "Investigate transaction:",
      transactionId
    );

    setActiveSection("investigation");
  };

  const handleCaseHistory = (caseId) => {
    console.log(
      "View case history:",
      caseId
    );

    setActiveSection("audit");
  };

  const [summary] = useState({
    total_transactions: 4,
    successful_payments: 4,
    total_transaction_value: 25700,
    total_settlement_value: 25400,
    mismatches: 1,
    money_at_risk: 0,
  });

  const [paymentHealth] = useState({
    failed_payments: 1,
  });

  const [riskPrioritization] = useState([
    {
      id: 1,
      transaction_id: "TXN1004",
      difference: 300,
      risk_level: "MEDIUM",
      priority: "COMPLETED",
      case_status: "RESOLVED",
    },
  ]);

  const [paymentFailures] = useState([
    {
      payment_id: "PWF01",
      amount: 2500,
      failure_reason: "INSUFFICIENT_FUNDS",
      risk_level: "MEDIUM",
    },
  ]);

  const renderSection = () => {
    if (
  activeSection === "Overview" ||
  activeSection === "overview"
) {
      return (
        <Overview
          summary={summary}
          paymentHealth={paymentHealth}
          riskPrioritization={riskPrioritization}
          paymentFailures={paymentFailures}
        />
      );
    }

    if (activeSection === "reconciliation") {
      return (
        <Reconciliation
          onInvestigate={handleInvestigation}
          onHistory={handleCaseHistory}
        />
      );
    }

    if (activeSection === "payments") {
      return <PaymentIntelligence />;
    }

    if (activeSection === "fraud") {
      return <FraudIntelligence />;
    }

    if (activeSection === "actions") {
      return <ActionCenter />;
    }
    if (
  activeSection === "refunds" ||
  activeSection === "Refunds & Adjustments"
) {
  return <RefundsAdjustments />;
}
    if (
  activeSection === "risk" ||
  activeSection === "Risk Prioritization"
) {
  return <RiskPrioritization />;
}
  if (
  activeSection === "investigation" ||
  activeSection === "AI Investigation"
) {
  return <Investigation />;
}

    if (activeSection === "notifications") {
      return <Notifications />;
    }

    if (activeSection === "audit") {
      return <AuditTrail />;
    }


    return (
      <div className="coming-soon-card">
        <div className="coming-soon-icon">
          ✦
        </div>

        <div>
          <div className="small-label">
            PAYTRUTH INTELLIGENCE
          </div>

          <h2>{activeSection}</h2>

          <p>
            This workspace will be connected to
            the existing PayTruth intelligence engine
            during the next frontend build step.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="paytruth-app">

      <Sidebar
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      />

      <main className="main-content">

        <header className="topbar">

          <div>
            <div className="breadcrumb">
              PAYTRUTH /{" "}
              {activeSection.toUpperCase()}
            </div>

            <h1>{activeSection}</h1>

            <p>
              Payment intelligence and financial
              control center
            </p>
          </div>

          <div className="topbar-right">

            <div className="environment">
              <span className="status-dot"></span>
              Sandbox environment
            </div>

            <button className="profile-button">
              Merchant
              <span>⌄</span>
            </button>

          </div>

        </header>

        <section className="page-content">
          {renderSection()}
        </section>

      </main>

    </div>
  );
}

export default App;