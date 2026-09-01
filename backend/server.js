const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "paytruth",
    password: "paytruth@123",
    port: 5432,
});


// ==================================================
// HOME
// ==================================================

app.get("/", (req, res) => {
    res.send("PayTruth AI Backend is Running 🚀");
});


// ==================================================
// TEST DATABASE
// ==================================================

app.get("/test-db", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.json({
            message: "PayTruth database connected successfully!",
            time: result.rows[0].now
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Database connection failed"
        });
    }
});


// ==================================================
// RECONCILIATION
// ==================================================

app.get("/reconciliation", async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT
                t.transaction_id,
                t.merchant_id,
                t.transaction_amount,
                s.settlement_amount,

                ABS(
                    t.transaction_amount - s.settlement_amount
                ) AS difference,

                CASE

                    WHEN t.transaction_amount = s.settlement_amount
                        THEN 'MATCHED'

                    WHEN ABS(
                        t.transaction_amount - s.settlement_amount
                    ) <= 100
                        THEN 'LOW'

                    WHEN ABS(
                        t.transaction_amount - s.settlement_amount
                    ) <= 1000
                        THEN 'MEDIUM'

                    ELSE 'HIGH'

                END AS risk_level

            FROM transactions t

            JOIN settlements s
            ON t.transaction_id = s.transaction_id

            ORDER BY difference DESC;
        `);


        for (const item of result.rows) {

            if (item.risk_level !== "MATCHED") {

                await pool.query(
                    `
                    INSERT INTO mismatch_cases
                    (
                        transaction_id,
                        difference,
                        risk_level
                    )

                    VALUES
                    ($1, $2, $3)

                    ON CONFLICT (transaction_id)

                    DO UPDATE SET

                        difference = EXCLUDED.difference,

                        risk_level = EXCLUDED.risk_level
                    `,
                    [
                        item.transaction_id,
                        item.difference,
                        item.risk_level
                    ]
                );
            }
        }


        res.json(result.rows);


    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Reconciliation failed"
        });
    }
});


// ==================================================
// SUMMARY
// ==================================================

const PORT = 5000;

app.get("/summary", async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT

                COUNT(*) AS total_transactions,

                COUNT(*) FILTER (
                    WHERE t.transaction_amount != s.settlement_amount
                ) AS mismatches,

                COALESCE(

                    SUM(
                        ABS(
                            t.transaction_amount -
                            s.settlement_amount
                        )
                    )

                    FILTER (
                        WHERE t.transaction_amount != s.settlement_amount
                    ),

                    0

                ) AS money_at_risk

            FROM transactions t

            JOIN settlements s
            ON t.transaction_id = s.transaction_id
        `);


        res.json(result.rows[0]);


    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Could not fetch summary"
        });
    }
});


// ==================================================
// UPDATE CASE STATUS
// ==================================================

app.patch("/cases/:transaction_id", async (req, res) => {

    try {

        const { transaction_id } = req.params;

        const { status } = req.body;


        const allowedStatuses = [
            "OPEN",
            "INVESTIGATING",
            "RESOLVED"
        ];


        if (!allowedStatuses.includes(status)) {

            return res.status(400).json({
                message: "Invalid status"
            });
        }


        const result = await pool.query(
            `
            UPDATE mismatch_cases

            SET case_status = $1

            WHERE transaction_id = $2

            RETURNING *
            `,
            [
                status,
                transaction_id
            ]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message: "Case not found"
            });
        }


        res.json(result.rows[0]);


    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Could not update case"
        });
    }
});


// ==================================================
// GET CASES
// ==================================================

app.get("/cases", async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT

                id,
                transaction_id,
                difference,
                risk_level,
                case_status,
                created_at

            FROM mismatch_cases

            ORDER BY

                CASE risk_level

                    WHEN 'HIGH' THEN 1
                    WHEN 'MEDIUM' THEN 2
                    WHEN 'LOW' THEN 3
                    ELSE 4

                END,

                created_at DESC
        `);


        res.json(result.rows);


    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Could not fetch cases"
        });
    }
});


// ==================================================
// APPROVE / REJECT ACTION
// ==================================================

app.patch("/approval-actions/:id", async (req, res) => {

    try {

        const { id } = req.params;

        const {
            decision,
            approved_by
        } = req.body;


        if (
            !["APPROVED", "REJECTED"]
            .includes(decision)
        ) {

            return res.status(400).json({
                message: "Invalid decision"
            });
        }


        const result = await pool.query(
            `
            UPDATE approval_actions

            SET

                approval_status = $1,

                approved_by = $2,

                approved_at = CURRENT_TIMESTAMP

            WHERE id = $3

            AND approval_status = 'PENDING'

            RETURNING *
            `,
            [
                decision,
                approved_by || "Merchant",
                id
            ]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Pending approval action not found"
            });
        }


        res.json(result.rows[0]);


    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Could not update approval"
        });
    }
});


// ==================================================
// GET APPROVAL ACTIONS
// ==================================================

app.get("/approval-actions", async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT

                id,
                case_id,
                action_type,
                ai_reason,
                proposed_action,
                approval_status,
                approved_by,
                approved_at,
                execution_status,
                verification_status,
                created_at

            FROM approval_actions

            ORDER BY created_at DESC
        `);


        res.json(result.rows);


    } catch (error) {

        console.error(error);

        res.status(500).json({
            message: "Could not fetch approval actions"
        });
    }
});


// ==================================================
// CREATE APPROVAL ACTION
// ==================================================

app.post("/approval-actions/create", async (req, res) => {

    try {

        const {
            case_id,
            action_type,
            ai_reason,
            proposed_action
        } = req.body;


        if (
            !case_id ||
            !action_type ||
            !ai_reason ||
            !proposed_action
        ) {

            return res.status(400).json({

                message:
                    "case_id, action_type, ai_reason and proposed_action are required"

            });
        }


        // Check mismatch case

        const caseResult = await pool.query(
            `
            SELECT *

            FROM mismatch_cases

            WHERE id = $1
            `,
            [case_id]
        );


        if (caseResult.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Mismatch case not found"
            });
        }


        // Prevent duplicate pending approval

        const existingResult = await pool.query(
            `
            SELECT *

            FROM approval_actions

            WHERE case_id = $1

            AND approval_status = 'PENDING'
            `,
            [case_id]
        );


        if (existingResult.rows.length > 0) {

            return res.status(409).json({

                message:
                    "A pending approval already exists for this case.",

                action:
                    existingResult.rows[0]

            });
        }


        // Create approval request

        const result = await pool.query(
            `
            INSERT INTO approval_actions
            (
                case_id,
                action_type,
                ai_reason,
                proposed_action,
                approval_status,
                execution_status,
                verification_status
            )

            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                'PENDING',
                'NOT_EXECUTED',
                'NOT_VERIFIED'
            )

            RETURNING *
            `,
            [
                case_id,
                action_type,
                ai_reason,
                proposed_action
            ]
        );


        res.status(201).json({

            message:
                "Approval request created successfully.",

            action:
                result.rows[0]

        });


    } catch (error) {

        console.error(
            "Approval creation error:",
            error
        );


        res.status(500).json({

            message:
                "Could not create approval request",

            error:
                error.message

        });
    }
});


// ==================================================
// CONTROLLED EXECUTION
// ==================================================

app.post("/approval-actions/:id/execute", async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;

        // Start a database transaction
        await client.query("BEGIN");

        // 1. Get the approved action
        const actionResult = await client.query(
            `
            SELECT
                id,
                case_id,
                action_type,
                approval_status,
                execution_status
            FROM approval_actions
            WHERE id = $1
            FOR UPDATE
            `,
            [id]
        );

        if (actionResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                message: "Approval action not found"
            });
        }

        const action = actionResult.rows[0];

        // 2. Safety check
        if (
            action.approval_status !== "APPROVED" ||
            action.execution_status !== "NOT_EXECUTED"
        ) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                message:
                    "Action cannot be executed. It must be approved and not already executed."
            });
        }

        // 3. Find the related mismatch case
        const caseResult = await client.query(
            `
            SELECT
                id,
                transaction_id,
                case_status
            FROM mismatch_cases
            WHERE id = $1
            FOR UPDATE
            `,
            [action.case_id]
        );

        if (caseResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                message: "Related mismatch case not found"
            });
        }

        const mismatchCase = caseResult.rows[0];

        // 4. Move the case into investigation
        const updatedCase = await client.query(
            `
            UPDATE mismatch_cases
            SET case_status = 'INVESTIGATING'
            WHERE id = $1
            RETURNING *
            `,
            [mismatchCase.id]
        );

        // 5. Mark the approval action as executed
        const updatedAction = await client.query(
            `
            UPDATE approval_actions
            SET execution_status = 'EXECUTED'
            WHERE id = $1
            RETURNING *
            `,
            [id]
        );

        // 6. Commit both changes together
        await client.query("COMMIT");

        res.json({
            message: "Settlement investigation executed successfully",
            action: updatedAction.rows[0],
            case: updatedCase.rows[0]
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error("Execution error:", error);

        res.status(500).json({
            message: "Could not execute action",
            error: error.message
        });

    } finally {
        client.release();
    }
});

// ==================================================
// INDEPENDENT VERIFICATION
// ==================================================

app.post("/approval-actions/:id/verify", async (req, res) => {

    try {

        const { id } = req.params;


        // 1. Get action

        const actionResult = await pool.query(
            `
            SELECT *

            FROM approval_actions

            WHERE id = $1
            `,
            [id]
        );


        if (actionResult.rows.length === 0) {

            return res.status(404).json({

                message:
                    "Approval action not found."

            });
        }


        const action =
            actionResult.rows[0];


        // 2. Approval check

        if (
            action.approval_status !==
            "APPROVED"
        ) {

            return res.status(400).json({

                message:
                    "Action must be approved before verification."

            });
        }


        // 3. Execution check

        if (
            action.execution_status !==
            "EXECUTED"
        ) {

            return res.status(400).json({

                message:
                    "Action must be executed before verification."

            });
        }


        // 4. Get actual case

        const caseResult = await pool.query(
            `
            SELECT *

            FROM mismatch_cases

            WHERE id = $1
            `,
            [action.case_id]
        );


        if (caseResult.rows.length === 0) {

            return res.status(404).json({

                message:
                    "Related mismatch case not found."

            });
        }


        const mismatchCase =
            caseResult.rows[0];


        // 5. Independently verify
        // actual business result

        if (
            mismatchCase.case_status !==
            "INVESTIGATING"
        ) {

            return res.status(400).json({

                message:
                    "Verification failed. The local case is not in INVESTIGATING status."

            });
        }


        // 6. Mark verified

        const verificationResult =
            await pool.query(
                `
                UPDATE approval_actions

                SET verification_status =
                    'VERIFIED'

                WHERE id = $1

                AND approval_status =
                    'APPROVED'

                AND execution_status =
                    'EXECUTED'

                AND verification_status =
                    'NOT_VERIFIED'

                RETURNING *
                `,
                [id]
            );


        if (
            verificationResult.rows.length === 0
        ) {

            return res.status(400).json({

                message:
                    "Action could not be marked as verified."

            });
        }


        res.json({

            message:
                "Action independently verified successfully.",

            action:
                verificationResult.rows[0],

            verification: {

                case_id:
                    mismatchCase.id,

                transaction_id:
                    mismatchCase.transaction_id,

                case_status:
                    mismatchCase.case_status,

                result:
                    "VERIFIED"

            }

        });


    } catch (error) {

        console.error(
            "Verification error:",
            error
        );


        res.status(500).json({

            message:
                "Could not verify action",

            error:
                error.message

        });
    }
});


// ==================================================
// RESOLVE CASE
// ==================================================

app.patch("/cases/:id/resolve", async (req, res) => {

    try {

        const { id } = req.params;


        const result = await pool.query(
            `
            UPDATE mismatch_cases

            SET case_status =
                'RESOLVED'

            WHERE id = $1

            RETURNING *
            `,
            [id]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({

                message:
                    "Case not found"

            });
        }


        res.json(result.rows[0]);


    } catch (error) {

        console.error(error);


        res.status(500).json({

            message:
                "Could not resolve case"

        });
    }
});


// ==================================================
// INVESTIGATION ENGINE — STEP 39
// ==================================================


// ==========================================
// CASE HISTORY
// ==========================================

app.get("/cases/:id/history", async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT
                mc.id AS case_id,
                mc.transaction_id,
                mc.difference,
                mc.risk_level,
                mc.case_status,
                mc.created_at AS case_created_at,

                aa.id AS action_id,
                aa.action_type,
                aa.ai_reason,
                aa.proposed_action,
                aa.approval_status,
                aa.approved_by,
                aa.approved_at,
                aa.execution_status,
                aa.verification_status,
                aa.created_at AS action_created_at

            FROM mismatch_cases mc

            LEFT JOIN approval_actions aa
                ON mc.id = aa.case_id

            WHERE mc.id = $1

            ORDER BY aa.created_at ASC
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Case not found"
            });
        }

        res.json({
            case: {
                id: result.rows[0].case_id,
                transaction_id: result.rows[0].transaction_id,
                difference: result.rows[0].difference,
                risk_level: result.rows[0].risk_level,
                case_status: result.rows[0].case_status,
                created_at: result.rows[0].case_created_at
            },

            actions: result.rows
                .filter(row => row.action_id !== null)
                .map(row => ({
                    id: row.action_id,
                    action_type: row.action_type,
                    ai_reason: row.ai_reason,
                    proposed_action: row.proposed_action,
                    approval_status: row.approval_status,
                    approved_by: row.approved_by,
                    approved_at: row.approved_at,
                    execution_status: row.execution_status,
                    verification_status: row.verification_status,
                    created_at: row.action_created_at
                }))
        });

    } catch (error) {

        console.error("Case history error:", error);

        res.status(500).json({
            message: "Could not fetch case history"
        });
    }
});
app.get("/payment-health", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                COUNT(*) AS total_transactions,

                COUNT(*) FILTER (
                    WHERE payment_status = 'SUCCESS'
                ) AS successful_payments,

                COUNT(*) FILTER (
                    WHERE payment_status != 'SUCCESS'
                ) AS failed_payments,

                COALESCE(
                    SUM(transaction_amount),
                    0
                ) AS total_transaction_value

            FROM transactions
        `);

        const settlementResult = await pool.query(`
            SELECT
                COALESCE(SUM(settlement_amount), 0)
                AS total_settlement_value
            FROM settlements
        `);

        const mismatchResult = await pool.query(`
    SELECT
        COUNT(*) AS mismatches,

        COUNT(*) FILTER (
            WHERE case_status != 'RESOLVED'
        ) AS unresolved_mismatches,

        COUNT(*) FILTER (
            WHERE case_status = 'RESOLVED'
        ) AS resolved_mismatches,

        COALESCE(
            SUM(difference) FILTER (
                WHERE case_status != 'RESOLVED'
            ),
            0
        ) AS money_at_risk

    FROM mismatch_cases
`);
const resolutionResult = await pool.query(`
    SELECT
        COUNT(*) FILTER (
            WHERE case_status = 'RESOLVED'
        ) AS resolved_cases,

        COUNT(*) AS total_cases

    FROM mismatch_cases
`);

        const health = {
            total_transactions:
                Number(result.rows[0].total_transactions),

            successful_payments:
                Number(result.rows[0].successful_payments),

            failed_payments:
                Number(result.rows[0].failed_payments),

            total_transaction_value:
                Number(result.rows[0].total_transaction_value),

            total_settlement_value:
                Number(
                    settlementResult.rows[0]
                        .total_settlement_value
                ),

            mismatches:
                Number(
                    mismatchResult.rows[0].mismatches
                ),

            money_at_risk:
                Number(
                    mismatchResult.rows[0].money_at_risk
                ),

            resolved_cases:
                Number(
                    resolutionResult.rows[0].resolved_cases
                ),

            total_cases:
                Number(
                    resolutionResult.rows[0].total_cases
                )
        };

        res.json(health);

    } catch (error) {

        console.error(
            "Payment health error:",
            error
        );

        res.status(500).json({
            message: "Could not calculate payment health"
        });
    }
});
// ==========================================
// AI RISK PRIORITIZATION ENGINE
// ==========================================

app.get("/risk-prioritization", async (req, res) => {
    try {

        const result = await pool.query(`
            SELECT
                id,
                transaction_id,
                difference,
                risk_level,
                case_status,
                created_at,

                CASE
                    WHEN case_status = 'RESOLVED'
                        THEN 'COMPLETED'

                    WHEN risk_level = 'HIGH'
                         AND difference >= 1000
                        THEN 'CRITICAL'

                    WHEN risk_level = 'HIGH'
                        THEN 'HIGH'

                    WHEN risk_level = 'MEDIUM'
                        THEN 'MEDIUM'

                    WHEN risk_level = 'LOW'
                        THEN 'LOW'

                    ELSE 'REVIEW'
                END AS priority,

                CASE
                    WHEN case_status = 'RESOLVED'
                        THEN 0

                    WHEN risk_level = 'HIGH'
                         AND difference >= 1000
                        THEN 100

                    WHEN risk_level = 'HIGH'
                        THEN 80

                    WHEN risk_level = 'MEDIUM'
                        THEN 50

                    WHEN risk_level = 'LOW'
                        THEN 25

                    ELSE 10
                END AS priority_score

            FROM mismatch_cases

            ORDER BY priority_score DESC, difference DESC
        `);

        res.json(result.rows);

    } catch (error) {

        console.error(
            "Risk prioritization error:",
            error
        );

        res.status(500).json({
            message: "Could not calculate risk prioritization"
        });
    }
});
app.get("/investigate/:transaction_id", async (req, res) => {
    try {
        const { transaction_id } = req.params;

        // ==========================================
        // 1. GET TRANSACTION
        // ==========================================

        const transactionResult = await pool.query(`
            SELECT
                transaction_id,
                merchant_id,
                transaction_amount,
                transaction_date,
                payment_status
            FROM transactions
            WHERE transaction_id = $1
        `, [transaction_id]);

        if (transactionResult.rows.length === 0) {
            return res.status(404).json({
                message: "Transaction not found"
            });
        }

        const transaction = transactionResult.rows[0];

        const transactionAmount =
            Number(transaction.transaction_amount);


        // ==========================================
        // 2. GET SETTLEMENT
        // ==========================================

        const settlementResult = await pool.query(`
            SELECT
                settlement_id,
                transaction_id,
                settlement_amount,
                settlement_date,
                settlement_status
            FROM settlements
            WHERE transaction_id = $1
            ORDER BY settlement_date DESC
            LIMIT 1
        `, [transaction_id]);

        if (settlementResult.rows.length === 0) {
            return res.json({
                transaction_id,
                investigation_status: "INCOMPLETE",

                root_cause_type:
                    "MISSING_SETTLEMENT",

                root_cause:
                    "No settlement record was found for this transaction.",

                confidence: 100,

                recommended_action:
                    "Investigate the missing settlement record.",

                human_approval_required: true,

                automatic_action: false
            });
        }

        const settlement = settlementResult.rows[0];

        const settlementAmount =
            Number(settlement.settlement_amount);


        // ==========================================
        // 3. CALCULATE DIFFERENCE
        // ==========================================

        const difference =
            Math.abs(
                transactionAmount -
                settlementAmount
            );


        // ==========================================
        // 4. GET FINANCIAL ADJUSTMENTS
        // ==========================================

        const adjustmentResult = await pool.query(`
            SELECT
                id,
                transaction_id,
                adjustment_type,
                amount,
                reason,
                created_at
            FROM settlement_adjustments
            WHERE transaction_id = $1
            ORDER BY created_at
        `, [transaction_id]);

        const adjustments =
            adjustmentResult.rows.map(row => ({
                id: row.id,
                adjustment_type:
                    row.adjustment_type,
                amount:
                    Number(row.amount),
                reason:
                    row.reason,
                created_at:
                    row.created_at
            }));


        // ==========================================
        // 5. TOTAL ADJUSTMENTS
        // ==========================================

        const totalAdjustments =
            adjustments.reduce(
                (sum, adjustment) =>
                    sum + adjustment.amount,
                0
            );


        // ==========================================
        // 6. CONTRADICTION DETECTION
        // ==========================================

        const adjustmentAmounts =
            adjustments.map(
                adjustment =>
                    adjustment.amount
            );

        const uniqueAmounts =
            [...new Set(adjustmentAmounts)];

        const contradictionDetected =
            uniqueAmounts.length > 1 &&
            adjustments.length > 1;


        // ==========================================
        // 7. EXPLAINED / UNEXPLAINED AMOUNT
        // ==========================================

        let explainedDifference = 0;
        let unexplainedDifference = difference;

        if (!contradictionDetected) {

            if (totalAdjustments <= difference) {

                explainedDifference =
                    totalAdjustments;

                unexplainedDifference =
                    difference -
                    totalAdjustments;

            } else {

                explainedDifference =
                    difference;

                unexplainedDifference = 0;
            }
        }


        // ==========================================
        // 8. ROOT CAUSE ENGINE
        // ==========================================

        let rootCauseType;
        let rootCause;
        let confidence;
        let recommendedAction;
        let investigationStatus;


        // ------------------------------------------
        // CASE A: NO MISMATCH
        // ------------------------------------------

        if (difference === 0) {

            investigationStatus =
                "NO_MISMATCH";

            rootCauseType =
                "NO_DISCREPANCY";

            rootCause =
                "Transaction amount and settlement amount match.";

            confidence = 100;

            recommendedAction =
                "No corrective action required.";

        }


        // ------------------------------------------
        // CASE B: CONTRADICTION
        // ------------------------------------------

        else if (contradictionDetected) {

            investigationStatus =
                "CONTRADICTION_DETECTED";

            rootCauseType =
                "ADJUSTMENT_REQUIRES_REVIEW";

            rootCause =
                "Conflicting financial adjustment records were detected. A reliable root cause cannot be determined.";

            confidence = 0;

            recommendedAction =
                "Do not automatically correct the settlement. Human investigation is required.";

        }


        // ------------------------------------------
        // CASE C: FULLY EXPLAINED
        // ------------------------------------------

        else if (
            unexplainedDifference === 0 &&
            adjustments.length > 0
        ) {

            investigationStatus =
                "FULLY_EXPLAINED";

            const adjustmentTypes =
                [
                    ...new Set(
                        adjustments.map(
                            adjustment =>
                                adjustment.adjustment_type
                        )
                    )
                ];

            rootCauseType =
                "FINANCIAL_ADJUSTMENT";

            rootCause =
                `The ₹${difference} settlement difference is fully explained by recorded financial adjustment(s): ${adjustmentTypes.join(", ")}.`;

            confidence = 98;

            recommendedAction =
                "Review the identified financial adjustment and proceed with correction only after human approval.";

        }


        // ------------------------------------------
        // CASE D: PARTIALLY EXPLAINED
        // ------------------------------------------

        else if (
            unexplainedDifference > 0 &&
            adjustments.length > 0
        ) {

            investigationStatus =
                "PARTIALLY_EXPLAINED";

            rootCauseType =
                "INSUFFICIENT_EVIDENCE";

            rootCause =
                `Recorded financial adjustments explain ₹${explainedDifference}, but ₹${unexplainedDifference} remains unexplained.`;

            confidence = 50;

            recommendedAction =
                "Do not determine a final root cause. Additional evidence and human investigation are required.";

        }


        // ------------------------------------------
        // CASE E: NO ADJUSTMENT
        // ------------------------------------------

        else {

            investigationStatus =
                "UNEXPLAINED_MISMATCH";

            rootCauseType =
                "UNKNOWN";

            rootCause =
                `A ₹${difference} settlement mismatch was detected, but no financial adjustment evidence was found to explain it.`;

            confidence = 0;

            recommendedAction =
                "Investigate the transaction, settlement and related financial records before taking corrective action.";

        }


        // ==========================================
        // 9. RETURN INVESTIGATION + ROOT CAUSE
        // ==========================================

        res.json({

            transaction_id,

            merchant_id:
                transaction.merchant_id,

            investigation_status:
                investigationStatus,


            transaction: {

                amount:
                    transactionAmount,

                date:
                    transaction.transaction_date,

                payment_status:
                    transaction.payment_status

            },


            settlement: {

                settlement_id:
                    settlement.settlement_id,

                amount:
                    settlementAmount,

                date:
                    settlement.settlement_date,

                status:
                    settlement.settlement_status

            },


            mismatch: {

                detected:
                    difference !== 0,

                transaction_amount:
                    transactionAmount,

                settlement_amount:
                    settlementAmount,

                difference

            },


            financial_evidence: [

                {

                    check:
                        "Transaction amount",

                    value:
                        transactionAmount,

                    result:
                        "RECORDED"

                },

                {

                    check:
                        "Settlement amount",

                    value:
                        settlementAmount,

                    result:
                        "RECORDED"

                },

                {

                    check:
                        "Amount difference",

                    calculation:
                        `${transactionAmount} - ${settlementAmount}`,

                    difference,

                    result:
                        difference === 0
                            ? "MATCH"
                            : "MISMATCH"

                },

                ...adjustments.map(
                    adjustment => ({

                        check:
                            "Financial adjustment",

                        adjustment_type:
                            adjustment.adjustment_type,

                        amount:
                            adjustment.amount,

                        reason:
                            adjustment.reason,

                        result:
                            "FOUND"

                    })
                ),

                {

                    check:
                        "Adjustment reconciliation",

                    total_adjustments:
                        totalAdjustments,

                    mismatch_amount:
                        difference,

                    unexplained_difference:
                        unexplainedDifference,

                    result:
                        contradictionDetected
                            ? "REQUIRES_REVIEW"
                            : unexplainedDifference === 0
                                ? "FULLY_EXPLAINED"
                                : "PARTIALLY_EXPLAINED"

                }

            ],


            root_cause_type:
                rootCauseType,

            root_cause:
                rootCause,

            confidence,

            explained_difference:
                explainedDifference,

            unexplained_difference:
                unexplainedDifference,

            contradiction_detected:
                contradictionDetected,

            recommended_action:
                recommendedAction,

            human_approval_required:
                difference !== 0,

            automatic_action:
                false

        });

    } catch (error) {

        console.error(
            "Investigation error:",
            error
        );

        res.status(500).json({

            message:
                "Could not investigate transaction"

        });

    }
});


// ==================================================
// START SERVER
// ==================================================

app.listen(PORT, () => {

    console.log(
        `PayTruth AI server running on http://localhost:${PORT}`
    );

});