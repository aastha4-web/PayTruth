PayTruth AI

AI-Powered Merchant Financial Intelligence & Controlled Action Platform

PayTruth AI is an AI-powered financial operations platform designed to help merchants understand what is happening across their payment and settlement ecosystem — and safely move from detection to verified resolution.

Instead of simply showing merchants that something went wrong, PayTruth aims to answer:

What happened? Why did it happen? How important is it? What should be done? Can the action be safely executed? And did it actually work?

---

🚨 The Problem

Modern merchants deal with payment failures, settlement mismatches, refunds, adjustments, suspicious payment patterns and financial anomalies across different systems.

The problem is not only detecting these events.

Merchants also need to:

- identify financially important issues
- understand the root cause
- prioritize risk
- decide what action should be taken
- obtain appropriate human approval
- execute the action safely
- verify the result
- maintain an audit trail

Traditional dashboards generally stop at visibility.

PayTruth AI focuses on the complete intelligence-to-action workflow.

---

💡 The Solution

PayTruth AI acts as a Human-in-the-Loop Financial Autopilot.

MONITOR
   ↓
DETECT
   ↓
ANALYZE
   ↓
RECOMMEND
   ↓
HUMAN APPROVE
   ↓
ACT
   ↓
VERIFY
   ↓
RESOLVE
   ↓
AUDIT

The system combines merchant financial intelligence, AI investigation, risk analysis and controlled actions into one platform.

---

✨ Key Features

1. Transaction & Settlement Reconciliation

PayTruth compares transaction amounts with settlement amounts and detects discrepancies.

Example:

Transaction Amount : ₹3,200
Settlement Amount  : ₹2,900
Difference         : ₹300
Risk               : MEDIUM

The system creates a mismatch case and tracks its lifecycle.

---

2. AI Investigation & Root-Cause Analysis

PayTruth does not stop at identifying a mismatch.

The investigation engine analyzes:

- transaction records
- settlement records
- financial adjustments
- refunds
- contradictory evidence
- unexplained differences

It produces:

- root cause
- evidence coverage
- confidence
- explanation
- recommendation
- approval requirement

Example

For TXN1004:

Difference          : ₹300
Root Cause          : FINANCIAL_ADJUSTMENT
Adjustment          : ₹300 REFUND
Explained Difference: ₹300
Unexplained         : ₹0
Confidence           : 98%
Status               : HIGH
Decision             : REVIEW_FINANCIAL_ADJUSTMENT

---

3. Payment Failure Intelligence

PayTruth analyzes failed payments and identifies failure reasons such as:

- insufficient funds
- bank decline
- repeated payment attempts
- high-value failures

It can recommend controlled recovery actions such as payment retry or human review.

---

4. Fraud & Anomaly Intelligence

The platform identifies suspicious payment patterns using multiple signals.

Example signals include:

FAILED_PAYMENT
HIGH_VALUE_PAYMENT
PAYMENT_RISK_FAILURE
REPEATED_PAYMENT_ATTEMPTS

PayTruth assigns:

- fraud/anomaly score
- risk level
- recommended action
- investigation status

Safety Principle

A suspicious payment is not automatically declared fraudulent.

PayTruth keeps the decision under human control.

---

5. Refund & Adjustment Intelligence

PayTruth analyzes settlement adjustments and refunds to determine whether financial discrepancies are explained.

The system can identify:

- refund-related differences
- adjustment amounts
- explained differences
- unexplained differences
- verification requirements

Real-money movement is not performed automatically.

---

6. Risk Prioritization

Financial cases are prioritized according to:

- risk level
- financial difference
- case status
- priority score

This helps merchants focus on the most important issues first.

---

7. Merchant Financial Intelligence

PayTruth provides a high-level financial view containing:

- transaction value
- settlement value
- payment failures
- failure rate
- financial differences
- refunds
- adjustments
- money at risk
- financial health
- AI-generated insights

---

8. Automated Action Orchestration

PayTruth unifies actionable cases from:

- settlement reconciliation
- payment failures
- fraud intelligence

into a central action queue.

This creates a single place where merchants can review and act on important financial issues.

---

🛡️ Human-in-the-Loop Safety

Financial automation must not blindly move money.

PayTruth therefore follows:

AI Recommendation
       ↓
Human Approval
       ↓
Controlled/Sandbox Execution
       ↓
Independent Verification
       ↓
Case Resolution

Safety guarantees

- Human approval is required for important financial actions.
- Real-money movement is disabled.
- Actions execute only in sandbox/controlled mode.
- Verification happens independently after execution.
- A case cannot be safely resolved when verification fails.
- Fraud investigations are not treated as confirmed fraud merely because an AI score is high.
- Actions and decisions are recorded in the audit trail.

---

🔔 Notifications & Alerts

PayTruth can generate alerts for important financial events including:

- critical fraud/anomaly cases
- high-risk payment failures
- unresolved settlement mismatches
- other high-priority financial risks

---

🧾 Audit Trail

Important actions are recorded for traceability.

The audit trail captures events such as:

ACTION_REQUESTED
ACTION_APPROVED
ACTION_EXECUTED
ACTION_VERIFIED
CASE_RESOLVED
FRAUD_CASE_RESOLVED
PAYMENT_FAILURE_CASE_RESOLVED
WEBHOOK_PROCESSED

This creates an end-to-end history of financial decisions and actions.

---

🔐 Secure Webhook Intelligence

PayTruth includes secure payment webhook processing.

The webhook layer supports:

- HMAC SHA-256 signature verification
- rejection of unsigned events
- rejection of invalid signatures
- allowed event-type validation
- duplicate event protection
- idempotent processing
- webhook audit logging

Tested behavior:

Unsigned webhook  → 401
Wrong signature   → 401
Valid signature   → processed
Duplicate event   → ignored safely

---

🧠 AI Decision Safety

PayTruth is designed with confidence-aware decision making.

When evidence is insufficient or contradictory, the system can abstain.

Example:

Contradictory Evidence
        ↓
Confidence = 0
        ↓
ABSTAIN
        ↓
Human Investigation

This prevents the system from confidently taking action when the evidence does not support a reliable decision.

---

🏗️ Architecture

                    ┌──────────────────────┐
                    │     Merchant UI      │
                    │    React + Vite      │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    Express Backend   │
                    │      Node.js         │
                    └──────────┬───────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
 ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
 │ Reconciliation │   │ AI Investigation│   │ Risk/Fraud     │
 │ & Settlements  │   │ & Root Cause    │   │ Intelligence   │
 └────────────────┘   └────────────────┘   └────────────────┘
          │                    │                    │
          └────────────────────┼────────────────────┘
                               ▼
                    ┌──────────────────────┐
                    │ Action Orchestration │
                    │ Human Approval       │
                    │ Sandbox Execution    │
                    │ Independent Verify   │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │     PostgreSQL       │
                    │   Financial Records  │
                    │   Cases & Audit      │
                    └──────────────────────┘

---

🛠️ Technology Stack

Frontend

- React
- Vite
- JavaScript
- CSS

Backend

- Node.js
- Express.js

Database

- PostgreSQL

Security

- HMAC SHA-256 webhook verification
- duplicate/idempotency protection
- input validation
- controlled action execution

---

📊 Database

Core data areas include:

transactions
settlements
settlement_adjustments
payments
mismatch_cases
payment_failure_cases
fraud_cases
approval_actions
notifications
webhook_events
audit_logs

---

🧪 Validation & Testing

PayTruth was tested through multiple end-to-end scenarios.

Scenario 1 — Normal Payment

Transaction : ₹10,000
Settlement  : ₹10,000
Result      : NO_ACTION

Scenario 2 — Settlement Mismatch

Transaction : ₹3,200
Settlement  : ₹2,900
Difference  : ₹300

AI Investigation
        ↓
Refund adjustment identified
        ↓
98% confidence
        ↓
Human approval
        ↓
Sandbox execution
        ↓
Independent verification
        ↓
Resolution

Scenario 3 — Failed Payment Recovery

Failure reason : INSUFFICIENT_FUNDS
Recommendation : PAYMENT_RETRY

Human Approval
      ↓
Sandbox Execution
      ↓
Verification
      ↓
Resolution

Scenario 4 — Contradictory Evidence

Conflicting financial evidence
        ↓
Confidence = 0
        ↓
ABSTAIN
        ↓
Human investigation

Scenario 5 — Webhook Security

Unsigned webhook → 401
Invalid signature → 401
Valid webhook     → processed
Duplicate webhook → safely ignored

These scenarios validate the major intelligence, safety and action-control workflows of the prototype.

---

🎯 Product Positioning

PayTruth AI is an:

«AI-powered merchant financial intelligence and controlled action platform.»

It can also be viewed as a:

«Human-in-the-Loop Financial Autopilot for merchant payment operations.»

The core idea is to move beyond:

"Here is what happened."

towards:

"Here is what happened,
why it happened,
how important it is,
what should be done,
whether it is safe to act,
and whether the action actually worked."

---

🚀 Future Scope

Potential future extensions include:

- direct integration with payment provider APIs
- production-grade merchant onboarding
- richer AI models trained on merchant-specific historical patterns
- advanced anomaly detection
- automated recovery optimization
- merchant-specific risk policies
- multi-provider payment intelligence
- production-grade observability and monitoring

For the prototype, all financial actions remain controlled and sandbox-only.

---

🏆 Buildathon Track

PayTruth AI is primarily positioned for the Open Track, while also addressing problems related to:

- AI Finance Controller
- AI Risk Manager
- AI Revenue Recovery

The Open Track positioning reflects the broader goal of creating an intelligence-to-action layer for merchant financial operations.

---

👩‍💻 Project Status

Prototype / Buildathon Submission

The system demonstrates an end-to-end merchant financial intelligence workflow covering:

Detection → Investigation → Recommendation → Human Approval → Controlled Execution → Verification → Resolution → Audit

---

🔒 Safety Disclaimer

PayTruth AI is a prototype built for demonstration and testing.

It does not perform real-money movement. Financial actions are simulated or executed in controlled/sandbox mode and require appropriate human authorization.
