import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";

if (!resendApiKey) {
    console.warn("⚠️ WARNING: RESEND_API_KEY is missing");
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;

/**
 * Send reset password email
 */
export async function sendResetPasswordEmail(
    to: string,
    resetLink: string
) {
    console.log("[EMAIL] sendResetPasswordEmail CALLED");
    console.log("[EMAIL] TO:", to);
    console.log("[EMAIL] FROM:", fromEmail);
    console.log(
        "[EMAIL] KEY:",
        process.env.RESEND_API_KEY ? "LOADED" : "MISSING"
    );

    if (!resend) {
        throw new Error("RESEND_API_KEY not configured");
    }

    try {
        const response = await resend.emails.send({
            from: fromEmail, // must be a verified sender
            to,
            subject: "Reset your password",
            html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #2563eb; margin: 0;">BOQ Management System</h1>
            <p style="color: #64748b; font-size: 16px;">Secure Password Reset</p>
          </div>
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px;">
            <p style="font-size: 16px; color: #1e293b;">Hello,</p>
            <p style="font-size: 14px; color: #475569; line-height: 1.5;">
              We received a request to reset your password for the BOQ Management System. 
              Click the button below to set a new password:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="font-size: 12px; color: #94a3b8; line-height: 1.4;">
              If you did not request this, please ignore this email. This link will expire in 1 hour.
            </p>
          </div>
          <div style="margin-top: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
            © ${new Date().getFullYear()} BOQ Management System. All rights reserved.
          </div>
        </div>
      `,
        });

        console.log("[RESEND SUCCESS]", response);
        return response;
    } catch (error) {
        console.error("[RESEND ERROR]", error);
        throw error;
    }
}

/**
 * Send sketch plan report email with PDF attachment
 */
export async function sendSketchPlanEmail(
  to: string,
  planName: string,
  pdfBase64: string,
  planData?: {
    projectName?: string;
    location?: string;
    planDate?: string;
    items?: any[];
  }
) {
  if (!resend) {
    throw new Error("RESEND_API_KEY not configured");
  }

  try {
    let emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #334155; line-height: 1.6;">
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 20px; text-align: center;">
          <h1 style="color: #1e40af; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">Concept Trunk Interiors</h1>
          <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px; font-weight: bold;">SITE SKETCH PLAN REPORT</p>
        </div>

        <div style="background-color: #f8fafc; border-radius: 8px; padding: 15px; margin-bottom: 25px; border: 1px solid #e2e8f0;">
          <table style="width: 100%; font-size: 13px;">
            <tr>
              <td style="padding: 4px 0;"><strong>Plan Name:</strong> ${planName}</td>
              <td style="padding: 4px 0; text-align: right;"><strong>Date:</strong> ${planData?.planDate || new Date().toLocaleDateString()}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0;"><strong>Project:</strong> ${planData?.projectName || 'N/A'}</td>
              <td style="padding: 4px 0; text-align: right;"><strong>Location:</strong> ${planData?.location || 'N/A'}</td>
            </tr>
          </table>
        </div>
    `;

    if (planData?.items && planData.items.length > 0) {
      emailHtml += `
        <h2 style="font-size: 16px; color: #1e40af; border-left: 4px solid #2563eb; padding-left: 10px; margin-bottom: 15px;">Site Requirements & Dimensions</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 25px;">
          <thead>
            <tr style="background-color: #f1f5f9; text-align: left;">
              <th style="border: 1px solid #e2e8f0; padding: 10px;">#</th>
              <th style="border: 1px solid #e2e8f0; padding: 10px;">Item / Product</th>
              <th style="border: 1px solid #e2e8f0; padding: 10px;">Dimensions (L x W x H)</th>
              <th style="border: 1px solid #e2e8f0; padding: 10px; text-align: center;">Qty</th>
              <th style="border: 1px solid #e2e8f0; padding: 10px;">Unit</th>
            </tr>
          </thead>
          <tbody>
      `;

      planData.items.forEach((item, idx) => {
        emailHtml += `
          <tr>
            <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center;">${idx + 1}</td>
            <td style="border: 1px solid #e2e8f0; padding: 8px;">
              <div style="font-weight: bold; color: #0f172a;">${item.item_name || 'N/A'}</div>
              ${item.description ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;"><i>${item.description}</i></div>` : ''}
            </td>
            <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center;">
              ${item.length || '0'} x ${item.width || '0'} x ${item.height || '0'} ${item.dimension_unit === 'feet' ? 'ft' : 'mm'}
            </td>
            <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: center; font-weight: bold; color: #2563eb;">${item.qty || '0'}</td>
            <td style="border: 1px solid #e2e8f0; padding: 8px;">${item.unit || 'Nos'}</td>
          </tr>
        `;
      });

      emailHtml += `
          </tbody>
        </table>
      `;
    }

    emailHtml += `
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center;">
          <p>This is an automated report generated from the BOQ Management System.</p>
          <p>&copy; ${new Date().getFullYear()} Concept Trunk Interiors. All rights reserved.</p>
        </div>
      </div>
    `;

    const response = await resend.emails.send({
      from: fromEmail,
      to,
      subject: `Sketch Plan Report: ${planName}`,
      html: emailHtml,
      attachments: [
        {
          filename: `${planName.replace(/\s+/g, '_')}_Report.pdf`,
          content: pdfBase64,
        },
      ],
    });

    return response;
  } catch (error) {
    console.error("[EMAIL ERROR] sendSketchPlanEmail:", error);
    throw error;
  }
}

/**
 * Send professional Site Report email
 */
export async function sendSiteReportEmail(
  to: string | string[],
  report: any,
  tasks: any[],
  isClientGroup: boolean = false
) {
  if (!resend) {
    throw new Error("RESEND_API_KEY not configured");
  }

  try {
    const reportDate = report.report_date || report.reportDate;
    const projectName = report.project_name || report.projectName || 'General Project';
    const reportStatus = report.status || 'SUBMITTED';
    const reportSummary = report.summary || '';

    let emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 850px; margin: 0 auto; padding: 20px; color: #334155; line-height: 1.6;">
        <div style="border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 25px; text-align: center;">
          <h1 style="color: #1e40af; margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 2px;">Daily Site Report</h1>
          <p style="color: #64748b; margin: 5px 0 0 0; font-size: 16px;">${projectName}</p>
        </div>

        <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 30px; border: 1px solid #e2e8f0; display: table; width: 100%;">
          <div style="display: table-row;">
            <div style="display: table-cell; padding: 5px 10px;"><strong>Report Date:</strong> ${reportDate ? new Date(reportDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A'}</div>
            <div style="display: table-cell; padding: 5px 10px; text-align: right;"><strong>Status:</strong> <span style="color: #2563eb; font-weight: bold;">${reportStatus.toUpperCase()}</span></div>
          </div>
          ${reportSummary ? `
          <div style="display: table-row;">
            <div style="display: table-cell; padding: 15px 10px 5px 10px;" colspan="2"><strong>General Summary:</strong><br/>${reportSummary}</div>
          </div>` : ''}
        </div>

        <h2 style="font-size: 18px; color: #1e40af; border-left: 5px solid #2563eb; padding-left: 12px; margin-bottom: 20px;">Work Progress Details</h2>
    `;

    tasks.forEach((task, idx) => {
      const taskItemName = task.item_name || task.itemName || `Task ${idx + 1}`;
      const taskCompletion = task.completion_percentage !== undefined ? task.completion_percentage : (task.completionPercentage || 0);
      const taskDesc = task.task_description || task.taskDescription || '';

      emailHtml += `
        <div style="margin-bottom: 35px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #f1f5f9; padding: 12px 15px; border-bottom: 1px solid #e2e8f0;">
            <table style="width: 100%;">
              <tr>
                <td><span style="font-weight: bold; font-size: 15px; color: #0f172a;">Task ${idx + 1}: ${taskItemName}</span></td>
                <td style="text-align: right;"><span style="background-color: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold;">${taskCompletion}% Complete</span></td>
              </tr>
            </table>
          </div>
          <div style="padding: 15px;">
            ${taskDesc ? `<p style="margin: 0 0 15px 0; font-size: 14px; color: #475569;">${taskDesc}</p>` : ''}
            
            ${task.labour && task.labour.length > 0 ? `
              <div style="margin-bottom: 15px;">
                <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Labour</h4>
                ${isClientGroup ? `
                  <div style="font-size: 13px; color: #475569;">
                    <div style="background-color: #eff6ff; padding: 10px 14px; border-radius: 6px; border: 1px solid #bfdbfe; display: inline-block;">
                      <strong style="color: #1e40af;">Labour Count:</strong> <span style="font-size: 15px; font-weight: bold; color: #1e40af;">${task.labour.reduce((sum: number, l: any) => sum + (Number(l.count) || 0), 0)}</span>
                    </div>
                  </div>
                ` : `
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <tr style="background-color: #f8fafc;">
                    <th style="text-align: left; padding: 6px; border: 1px solid #e2e8f0;">Labour/Skill</th>
                    <th style="text-align: center; padding: 6px; border: 1px solid #e2e8f0;">Count</th>
                    <th style="text-align: center; padding: 6px; border: 1px solid #e2e8f0;">Timing</th>
                  </tr>
                  ${task.labour.map((l: any) => {
                    const lName = l.labour_name || l.labourName || 'N/A';
                    const lIn = l.in_time || l.inTime || '-';
                    const lOut = l.out_time || l.outTime || '-';
                    return `
                    <tr>
                      <td style="padding: 6px; border: 1px solid #e2e8f0;">${lName}</td>
                      <td style="text-align: center; padding: 6px; border: 1px solid #e2e8f0;">${l.count}</td>
                      <td style="text-align: center; padding: 6px; border: 1px solid #e2e8f0;">${lIn} to ${lOut}</td>
                    </tr>
                  `}).join('')}
                </table>
                `}
              </div>
            ` : ''}

            ${task.materials && task.materials.length > 0 && !isClientGroup ? `
              <div style="margin-bottom: 15px;">
                <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Materials Used</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <tr style="background-color: #f8fafc;">
                    <th style="text-align: left; padding: 6px; border: 1px solid #e2e8f0;">Material Name</th>
                    <th style="text-align: center; padding: 6px; border: 1px solid #e2e8f0;">Qty</th>
                    <th style="text-align: center; padding: 6px; border: 1px solid #e2e8f0;">Unit</th>
                  </tr>
                  ${task.materials.map((m: any) => `
                    <tr>
                      <td style="padding: 6px; border: 1px solid #e2e8f0;">${m.material_name || m.materialName || 'N/A'}</td>
                      <td style="text-align: center; padding: 6px; border: 1px solid #e2e8f0;">${m.quantity || m.qty || 0}</td>
                      <td style="text-align: center; padding: 6px; border: 1px solid #e2e8f0;">${m.unit || '-'}</td>
                    </tr>
                  `).join('')}
                </table>
              </div>
            ` : ''}

            ${task.issues && task.issues.length > 0 ? `
              <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 12px; margin-top: 10px;">
                <h4 style="margin: 0 0 5px 0; font-size: 13px; color: #be123c;">Flagged Issues / Obstructions</h4>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #9f1239;">
                  ${task.issues.map((issue: any) => `<li>${issue.description}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            ${task.media && task.media.length > 0 ? `
              <div style="margin-top: 15px;">
                <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">Media Documentation</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                  ${task.media.map((m: any) => `
                    <div style="font-size: 12px; color: #2563eb;">
                      <a href="${m.fileUrl || m.file_url}" target="_blank" style="text-decoration: none; color: #2563eb; background: #eff6ff; padding: 5px 10px; border-radius: 4px; border: 1px solid #dbeafe;">
                        View ${m.fileType === 'video' || m.file_type === 'video' ? 'Video' : 'Photo'}
                      </a>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });

    emailHtml += `
        <div style="margin-top: 40px; padding-top: 25px; border-top: 2px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
          <p style="margin: 0;">This is a professional site report generated for <strong>${projectName}</strong>.</p>
          <p style="margin: 5px 0 0 0;">&copy; ${new Date().getFullYear()} BOQ Management System. All rights reserved.</p>
        </div>
      </div>
    `;

    const response = await resend.emails.send({
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject: `Daily Site Report - ${projectName} - ${reportDate ? new Date(reportDate).toLocaleDateString() : ''}`,
      html: emailHtml,
    });

    return response;
  } catch (error) {
    console.error("[EMAIL ERROR] sendSiteReportEmail:", error);
    throw error;
  }
}

/**
 * Send Activity Monitoring (Spy) summary email
 */
export async function sendAuditSummaryEmail(
  to: string | string[],
  logs: any[]
) {
  if (!resend) {
    throw new Error("RESEND_API_KEY not configured");
  }

  try {
    let emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; color: #334155; line-height: 1.6;">
        <div style="border-bottom: 3px solid #ef4444; padding-bottom: 15px; margin-bottom: 25px; text-align: center;">
          <h1 style="color: #b91c1c; margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 2px;">Activity Monitoring Summary</h1>
          <p style="color: #64748b; margin: 5px 0 0 0; font-size: 16px;">Secret Agent "Spy" Report</p>
        </div>

        <div style="background-color: #fef2f2; border-radius: 12px; padding: 20px; margin-bottom: 30px; border: 1px solid #fecaca; text-align: center;">
          <p style="margin: 0; color: #991b1b; font-weight: bold;">This report contains sensitive activity logs from the last 50 actions.</p>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #b91c1c;">Generated on: ${new Date().toLocaleString('en-IN')}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 30px; border: 1px solid #e2e8f0;">
          <thead>
            <tr style="background-color: #f1f5f9; text-align: left;">
              <th style="padding: 12px; border: 1px solid #e2e8f0;">User</th>
              <th style="padding: 12px; border: 1px solid #e2e8f0;">Action</th>
              <th style="padding: 12px; border: 1px solid #e2e8f0;">Module</th>
              <th style="padding: 12px; border: 1px solid #e2e8f0;">Details</th>
              <th style="padding: 12px; border: 1px solid #e2e8f0;">Timestamp</th>
            </tr>
          </thead>
          <tbody>
    `;

    logs.forEach((log) => {
      const actionColor = 
        log.action === 'DELETE' ? '#ef4444' : 
        log.action === 'CREATE' ? '#10b981' : 
        log.action === 'UPDATE' ? '#3b82f6' : '#64748b';

      emailHtml += `
        <tr>
          <td style="padding: 10px; border: 1px solid #e2e8f0;">
            <div style="font-weight: bold;">${log.username || 'Unknown'}</div>
            <div style="font-size: 11px; color: #64748b;">${log.role || '-'}</div>
          </td>
          <td style="padding: 10px; border: 1px solid #e2e8f0;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background-color: ${actionColor}20; color: ${actionColor}; font-weight: bold; font-size: 11px;">
              ${log.action}
            </span>
          </td>
          <td style="padding: 10px; border: 1px solid #e2e8f0;">${log.module || '-'}</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0;">${log.details || '-'}</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">
            ${new Date(log.created_at).toLocaleString()}
          </td>
        </tr>
      `;
    });

    emailHtml += `
          </tbody>
        </table>

        <div style="margin-top: 40px; padding-top: 25px; border-top: 2px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
          <p style="margin: 0;">This is a restricted security report from the BOQ Management System.</p>
          <p style="margin: 5px 0 0 0;">&copy; ${new Date().getFullYear()} BOQ Management System. All rights reserved.</p>
        </div>
      </div>
    `;

    const response = await resend.emails.send({
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject: `🚨 Spy Alert: Activity Summary - ${new Date().toLocaleDateString()}`,
      html: emailHtml,
    });

    return response;
  } catch (error) {
    console.error("[EMAIL ERROR] sendAuditSummaryEmail:", error);
    throw error;
  }
}

/**
 * Send Material Rate Change Notification to Admins
 */
export async function sendMaterialRateChangeEmail(
  adminEmails: string[],
  changeInfo: {
    materialName: string;
    materialCode?: string;
    category?: string;
    oldRate: number | string;
    newRate: number | string;
    changedBy: string;
    changedByRole?: string;
    shopName?: string;
    materialId: string;
  }
) {
  if (!resend) {
    console.warn("[EMAIL] Resend not configured — skipping material rate change notification");
    return;
  }

  if (!adminEmails || adminEmails.length === 0) {
    console.warn("[EMAIL] No admin emails provided for rate change notification");
    return;
  }

  const {
    materialName,
    materialCode,
    category,
    oldRate,
    newRate,
    changedBy,
    changedByRole,
    shopName,
    materialId,
  } = changeInfo;

  const oldRateNum = parseFloat(String(oldRate)) || 0;
  const newRateNum = parseFloat(String(newRate)) || 0;
  const diff = newRateNum - oldRateNum;
  const isIncrease = diff > 0;
  const percentChange = oldRateNum > 0 ? ((Math.abs(diff) / oldRateNum) * 100).toFixed(1) : "N/A";
  const changeColor = isIncrease ? "#ef4444" : "#10b981";
  const changeLabel = isIncrease ? "📈 INCREASED" : "📉 DECREASED";
  const changeArrow = isIncrease ? "▲" : "▼";

  const emailHtml = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; padding: 0; background-color: #f8fafc;">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%); padding: 28px 30px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">
          🔔 Material Rate Change Alert
        </h1>
        <p style="color: #bfdbfe; margin: 6px 0 0 0; font-size: 14px;">BOQ Management System — Admin Notification</p>
      </div>

      <!-- Alert Banner -->
      <div style="background-color: ${isIncrease ? '#fef2f2' : '#ecfdf5'}; border-left: 5px solid ${changeColor}; padding: 14px 20px; margin: 0;">
        <p style="margin: 0; color: ${changeColor}; font-weight: 700; font-size: 16px;">
          ${changeArrow} Rate ${changeLabel} by ₹${Math.abs(diff).toFixed(2)} (${percentChange}%)
        </p>
      </div>

      <!-- Material Details Card -->
      <div style="background-color: #ffffff; padding: 28px 30px; margin: 0; border: 1px solid #e2e8f0;">
        
        <h2 style="font-size: 16px; color: #1e40af; border-left: 4px solid #2563eb; padding-left: 12px; margin: 0 0 20px 0;">
          Material Details
        </h2>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 8px; color: #64748b; font-weight: 600; width: 40%;">Material Name</td>
            <td style="padding: 10px 8px; color: #0f172a; font-weight: 700;">${materialName || "N/A"}</td>
          </tr>
          ${materialCode ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 8px; color: #64748b; font-weight: 600;">Material Code</td>
            <td style="padding: 10px 8px; color: #0f172a;">${materialCode}</td>
          </tr>` : ""}
          ${category ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 8px; color: #64748b; font-weight: 600;">Category</td>
            <td style="padding: 10px 8px; color: #0f172a;">${category}</td>
          </tr>` : ""}
          ${shopName ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 8px; color: #64748b; font-weight: 600;">Vendor / Shop</td>
            <td style="padding: 10px 8px; color: #0f172a;">${shopName}</td>
          </tr>` : ""}
        </table>

        <!-- Rate Change Highlight Box -->
        <div style="background-color: #f8fafc; border-radius: 10px; padding: 20px; border: 1px solid #e2e8f0; text-align: center; margin-bottom: 24px;">
          <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Rate Change Summary</p>
          <div style="display: inline-table; width: 100%;">
            <div style="display: table-cell; width: 33%; vertical-align: middle; padding: 10px;">
              <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: 600; margin-bottom: 6px;">PREVIOUS RATE</p>
              <p style="margin: 0; color: #475569; font-size: 24px; font-weight: 700;">₹${oldRateNum.toFixed(2)}</p>
            </div>
            <div style="display: table-cell; width: 33%; vertical-align: middle; padding: 10px; text-align: center;">
              <p style="margin: 0; color: ${changeColor}; font-size: 28px; font-weight: 900;">${changeArrow}</p>
              <p style="margin: 4px 0 0 0; color: ${changeColor}; font-size: 12px; font-weight: 700;">${percentChange !== "N/A" ? percentChange + "%" : ""}</p>
            </div>
            <div style="display: table-cell; width: 33%; vertical-align: middle; padding: 10px;">
              <p style="margin: 0; color: #64748b; font-size: 12px; font-weight: 600; margin-bottom: 6px;">NEW RATE</p>
              <p style="margin: 0; color: ${changeColor}; font-size: 24px; font-weight: 700;">₹${newRateNum.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <!-- Changed By Info -->
        <h2 style="font-size: 16px; color: #1e40af; border-left: 4px solid #2563eb; padding-left: 12px; margin: 0 0 16px 0;">
          Change Details
        </h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 8px; color: #64748b; font-weight: 600; width: 40%;">Changed By</td>
            <td style="padding: 10px 8px; color: #0f172a; font-weight: 600;">${changedBy}</td>
          </tr>
          ${changedByRole ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 8px; color: #64748b; font-weight: 600;">Role</td>
            <td style="padding: 10px 8px; color: #0f172a;">${changedByRole}</td>
          </tr>` : ""}
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 8px; color: #64748b; font-weight: 600;">Timestamp</td>
            <td style="padding: 10px 8px; color: #0f172a;">${new Date().toLocaleString("en-IN", { dateStyle: "full", timeStyle: "medium" })}</td>
          </tr>
          <tr>
            <td style="padding: 10px 8px; color: #64748b; font-weight: 600;">Material ID</td>
            <td style="padding: 10px 8px; color: #94a3b8; font-size: 12px; font-family: monospace;">${materialId}</td>
          </tr>
        </table>
      </div>

      <!-- Footer -->
      <div style="background-color: #f1f5f9; padding: 20px 30px; border-radius: 0 0 8px 8px; text-align: center; border: 1px solid #e2e8f0; border-top: none;">
        <p style="margin: 0; font-size: 13px; color: #64748b;">
          ⚠️ This is an automated alert from the <strong>BOQ Management System</strong>.
        </p>
        <p style="margin: 6px 0 0 0; font-size: 12px; color: #94a3b8;">
          Please review this change and take action if required. &copy; ${new Date().getFullYear()} Concept Trunk Interiors.
        </p>
      </div>
    </div>
  `;

  try {
    const response = await resend.emails.send({
      from: fromEmail,
      to: adminEmails,
      subject: `🔔 Rate Alert: ${materialName} — ₹${oldRateNum.toFixed(2)} → ₹${newRateNum.toFixed(2)} (${isIncrease ? "+" : "-"}${Math.abs(diff).toFixed(2)})`,
      html: emailHtml,
    });
    console.log("[EMAIL] Material rate change notification sent to admins:", adminEmails);
    return response;
  } catch (error) {
    console.error("[EMAIL ERROR] sendMaterialRateChangeEmail:", error);
    // Don't throw — email failure should not block the rate update
  }
}

/**
 * Send Proposal Status Email (Approved/Rejected)
 */
export async function sendProposalStatusEmail(
  to: string,
  vendorName: string,
  projectName: string,
  versionNumber: number,
  status: "approved" | "rejected",
  reason?: string
) {
  if (!resend) {
    console.log("Mocking email to", to, "about proposal status:", status);
    return;
  }

  try {
    const isApproved = status === "approved";
    const statusColor = isApproved ? "#10b981" : "#ef4444";
    const statusText = isApproved ? "APPROVED" : "REJECTED";
    
    let emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid ${statusColor}; padding-bottom: 15px;">
          <h1 style="color: ${statusColor}; margin: 0;">Proposal ${statusText}</h1>
          <p style="color: #64748b; font-size: 16px;">BOQ Management System</p>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px;">
          <p style="font-size: 16px; color: #1e293b;">Dear ${vendorName},</p>
          <p style="font-size: 14px; color: #475569; line-height: 1.5;">
            Your proposal <strong>v${versionNumber}</strong> for the project <strong>"${projectName}"</strong> has been <strong style="color: ${statusColor};">${statusText}</strong>.
          </p>
          ${!isApproved && reason ? `<p style="font-size: 14px; color: #991b1b; background-color: #fef2f2; padding: 10px; border-radius: 5px; border: 1px solid #fecaca;"><strong>Reason:</strong> ${reason}</p>` : ''}
          ${isApproved ? `<p style="font-size: 14px; color: #065f46; background-color: #ecfdf5; padding: 10px; border-radius: 5px; border: 1px solid #a7f3d0;">The administrator will now be able to include your proposal items in the final BOM.</p>` : ''}
        </div>
        <div style="margin-top: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
          © ${new Date().getFullYear()} BOQ Management System. All rights reserved.
        </div>
      </div>
    `;

    const response = await resend.emails.send({
      from: fromEmail,
      to,
      subject: `Proposal ${statusText}: ${projectName}`,
      html: emailHtml,
    });

    return response;
  } catch (error) {
    console.error("[EMAIL ERROR] sendProposalStatusEmail:", error);
    throw error;
  }
}

/**
 * Send BOM Comment Mention Notification Email
 * Triggered when a user is tagged (@mentioned) in a BOM comment
 */
export async function sendCommentMentionEmail(
  toEmails: string[],
  info: {
    mentionedNames: string[];
    senderName: string;
    commentText: string;
    threadName: string;
    projectName?: string;
    versionNumber?: number | string;
  }
) {
  if (!resend) {
    console.warn("[EMAIL] Resend not configured — skipping comment mention notification");
    return;
  }
  if (!toEmails || toEmails.length === 0) {
    console.warn("[EMAIL] No recipient emails for comment mention");
    return;
  }

  const { mentionedNames, senderName, commentText, threadName, projectName, versionNumber } = info;

  const emailHtml = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f8fafc;">
      <div style="background: linear-gradient(135deg, #075e54 0%, #128c7e 100%); padding: 24px 28px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">💬 You were mentioned in a BOQ comment</h1>
        <p style="color: #d1fae5; margin: 6px 0 0 0; font-size: 13px;">BOQ Management System — Discussion Notification</p>
      </div>
      <div style="background-color: #ffffff; padding: 28px 28px 20px 28px; border: 1px solid #e2e8f0;">
        <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b;">Hi <strong>${mentionedNames.join(", ")}</strong>,</p>
        <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;"><strong>${senderName}</strong> mentioned you in a BOQ discussion.</p>
        <div style="background-color: #f1f5f9; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; border: 1px solid #e2e8f0;">
          <table style="width: 100%; font-size: 13px;">
            ${projectName ? `<tr><td style="padding: 3px 0; color: #64748b; font-weight: 600; width: 40%;">Project</td><td style="color: #0f172a;">${projectName}</td></tr>` : ""}
            ${versionNumber ? `<tr><td style="padding: 3px 0; color: #64748b; font-weight: 600;">Version</td><td style="color: #0f172a;">v${versionNumber}</td></tr>` : ""}
            <tr><td style="padding: 3px 0; color: #64748b; font-weight: 600;">Thread</td><td style="color: #0f172a;">${threadName}</td></tr>
          </table>
        </div>
        <div style="margin-bottom: 24px;">
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 600;">Message</p>
          <div style="background-color: #dcf8c6; border-radius: 0 12px 12px 12px; padding: 14px 16px; border: 1px solid #b7eb8f;">
            <p style="margin: 0 0 6px 0; font-size: 12px; color: #128c7e; font-weight: 700;">${senderName}</p>
            <p style="margin: 0; font-size: 14px; color: #1e293b; line-height: 1.6;">${commentText}</p>
            <p style="margin: 6px 0 0 0; font-size: 11px; color: #94a3b8; text-align: right;">${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
          </div>
        </div>
        <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">Please log in to the BOQ Management System to view the full conversation and reply.</p>
      </div>
      <div style="background-color: #f1f5f9; padding: 16px 28px; border-radius: 0 0 8px 8px; text-align: center; border: 1px solid #e2e8f0; border-top: none;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">Automated notification from <strong>BOQ Management System</strong>. &copy; ${new Date().getFullYear()} Concept Trunk Interiors.</p>
      </div>
    </div>
  `;

  try {
    const response = await resend.emails.send({
      from: fromEmail,
      to: toEmails,
      subject: `💬 ${senderName} mentioned you in a BOQ comment — ${threadName}`,
      html: emailHtml,
    });
    console.log("[EMAIL] Comment mention notification sent to:", toEmails);
    return response;
  } catch (error) {
    console.error("[EMAIL ERROR] sendCommentMentionEmail:", error);
    // Don't throw — email failure should not block the comment
  }
}

/**
 * Send password updated notification email
 */
export async function sendPasswordUpdatedEmail(
  to: string,
  username?: string
) {
  if (!resend) {
    console.warn("[EMAIL] Resend not configured — skipping password updated notification");
    return;
  }

  try {
    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #2563eb; margin: 0;">BOQ Management System</h1>
          <p style="color: #64748b; font-size: 16px;">Security Alert: Password Changed</p>
        </div>
        <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px;">
          <p style="font-size: 16px; color: #1e293b;">Hello${username ? ' ' + username : ''},</p>
          <p style="font-size: 14px; color: #475569; line-height: 1.5;">
            This email is to confirm that the password for your BOQ Management System account has been recently updated.
          </p>
          <p style="font-size: 14px; color: #475569; line-height: 1.5;">
            If you made this change, no further action is required.
          </p>
          <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 12px; margin-top: 20px;">
            <p style="margin: 0; font-size: 14px; color: #9f1239;">
              <strong>Didn't make this change?</strong> Please contact the system administrator immediately to secure your account.
            </p>
          </div>
        </div>
        <div style="margin-top: 20px; text-align: center; font-size: 12px; color: #94a3b8;">
          © ${new Date().getFullYear()} BOQ Management System. All rights reserved.
        </div>
      </div>
    `;

    const response = await resend.emails.send({
      from: fromEmail,
      to,
      subject: "Security Alert: Your Password Was Changed",
      html: emailHtml,
    });

    console.log("[EMAIL] Password update notification sent to:", to);
    return response;
  } catch (error) {
    console.error("[EMAIL ERROR] sendPasswordUpdatedEmail:", error);
    // Don't throw to prevent breaking the password update flow
  }
}
