import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export interface PayrollExportRecord {
  srNo: number;
  empId: string;
  empName: string;
  designation: string;
  gender: string;
  doj?: string;
  pfNo?: string;
  uanNo?: string;
  esicNo?: string;
  siteName: string;
  basicDa: number;
  hra: number;
  washingAllowance?: number;
  otherAllowance: number;
  conveyanceAllowance: number;
  incentive: number;
  grossRate: number;
  daysInMonth: number;
  advances: number;
  pd: number;
  wo: number;
  woe?: number;
  hd?: number;
  hde?: number;
  payableDays: number;
  earnedBasic: number;
  earnedHRA: number;
  earnedWashing?: number;
  earnedOther: number;
  earnedConveyance: number;
  earnedIncentive?: number;
  earnedBonus?: number;
  earnedPartBonus?: number;
  remainingPartBonus?: number;
  earnedGross: number;
  epf: number;
  esic: number;
  pt: number;
  totalDeductions: number;
  netSalary: number;
  totalNetSalary?: number;
  payeeName?: string;
  bankAccountNo?: string;
  bankIfscCode?: string;
  bankName?: string;
  companyName?: string;
}

export interface ExportComplianceOptions {
  month: string;
  year: number;
  siteName: string;
  companyName?: string;
  records: PayrollExportRecord[];
}

export interface SiteComplianceExportGroup {
  siteName: string;
  companyName?: string;
  records: PayrollExportRecord[];
}

export interface ExportAllSitesComplianceOptions {
  month: string;
  year: number;
  siteRecords: SiteComplianceExportGroup[];
}

// TODO: fields not yet in data model
// 1. Work Status (currently default 'Active')
// 2. Compliance Name (currently default 'Ambe Enterprises')
// 3. 2ndshift (currently default 0)
// 4. Last month (currently default 0)
// 5. OT Hours Worked (currently default 0)
// 6. Uniform issue tracking (Shirt, Pant, Shoes, ID Card individual recovery columns)
// 7. Other deduction Amt / Remark (currently default 0 / '')
// 8. In-this / next-month advance split (In This Mth, In Next Mth)
// 9. MLWF (Maharashtra Labour Welfare Fund - Employee & Employer contributions)
// 10. Base Bonus / Base Part Bonus rate fields
// 11. Paid Date (payout settlement timestamp)
// 12. In Account Of / Other Reltn (third-party payment authorization)
// 13. Payee Account Name (when distinct from staff name)
// 14. Employer EPF / ESIC / MLWF breakdown (statutory employer match)
// 15. NET Compliance on head / Burden Head (Total Employer Burden = Gross + Employer Contribs)
// 16. Salary Increment tracking

export function sanitizeSheetName(rawName: string, usedNames: Set<string>): string {
  let clean = (rawName || 'Site')
    .replace(/[\\/?*\[\]:]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) clean = 'Site';
  if (clean.length > 31) clean = clean.substring(0, 31).trim();

  let finalName = clean;
  let counter = 2;
  while (usedNames.has(finalName.toLowerCase())) {
    const suffix = ` (${counter})`;
    const maxBaseLen = 31 - suffix.length;
    finalName = `${clean.substring(0, maxBaseLen).trim()}${suffix}`;
    counter++;
  }
  usedNames.add(finalName.toLowerCase());
  return finalName;
}

export function buildComplianceSheet(
  workbook: ExcelJS.Workbook,
  siteName: string,
  month: string,
  year: number,
  records: PayrollExportRecord[],
  usedSheetNames?: Set<string>,
  companyName?: string
): ExcelJS.Worksheet {
  const totalCols = 67;
  const sheetName = sanitizeSheetName(siteName, usedSheetNames || new Set());

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 10, activeCell: 'D11' }],
  });

  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  const totalDays = records[0]?.daysInMonth || 30;
  const compTitle = (companyName || records[0]?.companyName || 'AMBE SERVICE FACILITIES PRIVATE LIMITED').toUpperCase();

  // 1. Title Block (Row 1) - Bold Maroon/Dark Red text on white, no fill
  const titleRow = worksheet.getRow(1);
  titleRow.height = 32;
  titleRow.getCell(1).value = compTitle;
  worksheet.mergeCells(1, 1, 1, totalCols);
  const titleCell = titleRow.getCell(1);
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFB91C1C' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // 2. Client & Month Metadata (Rows 3 - 6)
  const metadataConfig = [
    { row: 3, label: 'CLIENT NAME :', value: siteName.toUpperCase() },
    { row: 4, label: 'MONTH :', value: `${month.toUpperCase()} ${year}` },
    { row: 5, label: 'DETAIL :', value: 'SALARY COMPLIANCE REGISTER' },
    { row: 6, label: 'No of Days in Month :', value: totalDays },
  ];

  metadataConfig.forEach(({ row, label, value }) => {
    const r = worksheet.getRow(row);
    r.height = 20;
    const labelCell = r.getCell(3); // Col C
    labelCell.value = label;
    labelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF334155' } };
    labelCell.alignment = { vertical: 'middle', horizontal: 'left' };

    const valueCell = r.getCell(5); // Col E
    valueCell.value = value;
    valueCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    valueCell.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  // 3. Header Block (Rows 8 - 10: 3-Tier Merged Structure, 67 Columns)
  // Row 8: Tier 1 Group Headers - Very light gray fill with bold dark text
  const row8 = worksheet.getRow(8);
  row8.height = 26;
  const groupRanges: { start: number; end: number; text: string }[] = [
    { start: 1, end: 9, text: 'EMPLOYEE DETAILS' },
    { start: 10, end: 17, text: 'ATTENDANCE' },
    { start: 18, end: 18, text: 'OT HOURS' },
    { start: 19, end: 29, text: 'RATE & EARNED PAY' },
    { start: 30, end: 40, text: 'ADVANCES & UNIFORM' },
    { start: 41, end: 45, text: 'DEDUCTIONS' },
    { start: 46, end: 51, text: 'BENEFITS' },
    { start: 52, end: 61, text: 'PAYOUT' },
    { start: 62, end: 67, text: 'EMPLOYER COMPLIANCE' },
  ];

  groupRanges.forEach((g) => {
    if (g.start !== g.end) {
      worksheet.mergeCells(8, g.start, 8, g.end);
    }
    const cell = row8.getCell(g.start);
    cell.value = g.text;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = borderStyle;
  });

  // Row 9: Tier 2 Sub-Headers - Very light gray fill with bold dark text
  const row9 = worksheet.getRow(9);
  row9.height = 28;
  const subHeaders: { col: number; text: string }[] = [
    // 1-9: Employee Details (9 cols, NO DOJ)
    { col: 1, text: 'EMP ID' },
    { col: 2, text: 'NAME' },
    { col: 3, text: 'POST' },
    { col: 4, text: 'GENDER' },
    { col: 5, text: 'Work Status' },
    { col: 6, text: 'SAL Committed' },
    { col: 7, text: 'Compliance Name' },
    { col: 8, text: 'PF No' },
    { col: 9, text: 'ESIC No' },

    // 10-17: Attendance (8 cols)
    { col: 10, text: 'PD' },
    { col: 11, text: 'WO' },
    { col: 12, text: 'WOE' },
    { col: 13, text: 'HD' },
    { col: 14, text: 'HDE' },
    { col: 15, text: '2ndshift' },
    { col: 16, text: 'Last month' },
    { col: 17, text: 'TOTAL' },

    // 18: OT Hours Worked
    { col: 18, text: 'OT Hours Worked' },

    // 19-29: Interleaved Rate & Earned Pay (11 cols)
    { col: 19, text: 'Rate Per Day' },
    { col: 20, text: 'BASIC+DA' },
    { col: 21, text: 'Earned Basic+DA' },
    { col: 22, text: 'HRA' },
    { col: 23, text: 'Earned HRA' },
    { col: 24, text: 'Others/Washing Allowances' },
    { col: 25, text: 'Earned Other/Washing Allowances' },
    { col: 26, text: 'Conveyance Allowances' },
    { col: 27, text: 'Earned Conveyance Allowance' },
    { col: 28, text: 'Incentives' },
    { col: 29, text: 'Earned Gross Salary' },

    // 30-40: Advances & Uniform (11 cols)
    { col: 30, text: 'ADV DATE' },
    { col: 31, text: 'ADV AMT' },
    { col: 32, text: 'SHIRT' },
    { col: 33, text: 'PANT' },
    { col: 34, text: 'SHOES' },
    { col: 35, text: 'ID CARD' },
    { col: 36, text: 'OTHER AMT' },
    { col: 37, text: 'REMARK' },
    { col: 38, text: 'TOTAL ADV' },
    { col: 39, text: 'IN THIS MTH' },
    { col: 40, text: 'IN NEXT MTH' },

    // 41-45: Deductions (5 cols)
    { col: 41, text: 'EPF' },
    { col: 42, text: 'ESIC' },
    { col: 43, text: 'PT' },
    { col: 44, text: 'MLWF' },
    { col: 45, text: 'TOTAL DEDUCT' },

    // 46-51: Benefits (6 cols)
    { col: 46, text: 'BONUS BASE' },
    { col: 47, text: 'EARNED BONUS' },
    { col: 48, text: 'PART BASE' },
    { col: 49, text: 'EARNED PART' },
    { col: 50, text: 'REM PART' },
    { col: 51, text: 'INCREMENT' },

    // 52-61: Payout (10 cols)
    { col: 52, text: 'NET SALARY' },
    { col: 53, text: 'TOTAL NET SALARY' },
    { col: 54, text: 'PAID DATE' },
    { col: 55, text: 'IN ACCT OF' },
    { col: 56, text: 'RELATION' },
    { col: 57, text: 'PAYEE NAME' },
    { col: 58, text: 'ACCOUNT NO' },
    { col: 59, text: 'IFSC CODE' },
    { col: 60, text: 'BANK NAME' },
    { col: 61, text: 'EMP TOTAL' },

    // 62-67: Employer Compliance (6 cols)
    { col: 62, text: 'EMP EPF' },
    { col: 63, text: 'EMP ESIC' },
    { col: 64, text: 'EMP MLWF' },
    { col: 65, text: 'TOTAL CONTRIB' },
    { col: 66, text: 'BURDEN HEAD' },
    { col: 67, text: 'REMARK' },
  ];

  subHeaders.forEach((sh) => {
    const cell = row9.getCell(sh.col);
    cell.value = sh.text;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = borderStyle;
  });

  // Row 10: Tier 3 Specific Column / Index Row - White fill with subtle text
  const row10 = worksheet.getRow(10);
  row10.height = 20;
  for (let c = 1; c <= totalCols; c++) {
    const cell = row10.getCell(c);
    cell.value = c;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    cell.font = { name: 'Calibri', size: 8, color: { argb: 'FF64748B' }, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = borderStyle;
  }

  // Column widths definition (67 columns)
  const columnWidths = [
    10, 22, 14, 8, 10, 14, 18, 14, 14,     // 1-9 (Employee Details)
    6, 6, 6, 6, 6, 8, 8, 8,                // 10-17 (Attendance)
    12,                                    // 18 (OT Hours Worked)
    12, 10, 12, 10, 12, 14, 16, 12, 14, 10, 14, // 19-29 (Interleaved Rate & Earned Pay)
    12, 10, 8, 8, 8, 8, 10, 15, 10, 10, 10,// 30-40 (Advances & Uniform)
    10, 10, 8, 8, 14,                      // 41-45 (Deductions)
    12, 14, 12, 14, 14, 12,                // 46-51 (Benefits)
    14, 16, 12, 14, 10, 22, 18, 14, 16, 14,// 52-61 (Payout)
    10, 10, 8, 14, 16, 15                  // 62-67 (Employer Compliance)
  ];

  columnWidths.forEach((w, idx) => {
    worksheet.getColumn(idx + 1).width = w;
  });

  // 4. Data Rows with Alternating Blank Spacer Row
  let currentRowNum = 11;

  records.forEach((rec, idx) => {
    const ratePerDay = rec.daysInMonth > 0 ? Math.round(rec.grossRate / rec.daysInMonth) : 0;
    const totalEarnedGross = rec.earnedGross;
    const earnedBonus = rec.earnedBonus ?? Math.round(rec.earnedBasic * 0.0833);
    const earnedPartBonus = rec.earnedPartBonus ?? 0;
    const remainingPartBonus = rec.remainingPartBonus ?? 0;
    const totalNetSalary = rec.totalNetSalary ?? (rec.netSalary + earnedPartBonus);
    const employerEsic = Math.ceil((rec.earnedBasic + rec.earnedHRA + (rec.earnedIncentive || rec.incentive || 0)) * 0.0325);
    const employerTotal = rec.epf + employerEsic;

    const rowValues = [
      // 1-9: Employee Details (NO DOJ)
      rec.empId || idx + 1,                                       // 1: EMP ID
      rec.empName,                                                // 2: NAME
      rec.designation,                                            // 3: POST
      rec.gender || 'M',                                          // 4: GENDER
      'Active',                                                   // 5: Work Status (TODO)
      rec.grossRate,                                              // 6: SAL Committed
      'Ambe Enterprises',                                         // 7: Compliance Name (TODO)
      rec.pfNo || rec.uanNo || '',                                // 8: PF No
      rec.esicNo || '',                                           // 9: ESIC No

      // 10-17: Attendance
      rec.pd,                                                     // 10: PD
      rec.wo,                                                     // 11: WO
      rec.woe || 0,                                               // 12: WOE
      rec.hd || 0,                                                // 13: HD
      rec.hde || 0,                                               // 14: HDE
      0,                                                          // 15: 2ndshift (TODO)
      0,                                                          // 16: Last month (TODO)
      rec.payableDays,                                            // 17: TOTAL

      // 18: OT Hours Worked
      0,                                                          // 18: OT Hours Worked (TODO)

      // 19-29: Interleaved Rate & Earned Pay (11 cols)
      ratePerDay,                                                 // 19: Rate Per Day
      rec.basicDa,                                                // 20: BASIC+DA
      rec.earnedBasic,                                            // 21: Earned Basic+DA
      rec.hra,                                                    // 22: HRA
      rec.earnedHRA,                                              // 23: Earned HRA
      rec.washingAllowance || 0,                                  // 24: Others/Washing Allowances
      rec.earnedOther || rec.earnedWashing || 0,                   // 25: Earned Other/Washing Allowances
      rec.conveyanceAllowance || 0,                               // 26: Conveyance Allowances
      rec.earnedConveyance || 0,                                  // 27: Earned Conveyance Allowance
      rec.incentive || 0,                                         // 28: Incentives
      rec.earnedGross,                                            // 29: Earned Gross Salary

      // 30-40: Advances & Uniform (11 cols)
      '',                                                         // 30: ADV DATE
      rec.advances || 0,                                          // 31: ADV AMT
      0,                                                          // 32: SHIRT (TODO)
      0,                                                          // 33: PANT (TODO)
      0,                                                          // 34: SHOES (TODO)
      0,                                                          // 35: ID CARD (TODO)
      0,                                                          // 36: OTHER AMT (TODO)
      '',                                                         // 37: REMARK (TODO)
      rec.advances || 0,                                          // 38: TOTAL ADV
      rec.advances || 0,                                          // 39: IN THIS MTH (TODO)
      0,                                                          // 40: IN NEXT MTH (TODO)

      // 41-45: Deductions (5 cols)
      rec.epf,                                                    // 41: EPF
      rec.esic,                                                   // 42: ESIC
      rec.pt,                                                     // 43: PT
      0,                                                          // 44: MLWF (TODO)
      rec.totalDeductions,                                        // 45: TOTAL DEDUCT

      // 46-51: Benefits (6 cols)
      0,                                                          // 46: BONUS BASE (TODO)
      earnedBonus,                                                // 47: EARNED BONUS
      0,                                                          // 48: PART BASE (TODO)
      earnedPartBonus,                                            // 49: EARNED PART
      remainingPartBonus,                                         // 50: REM PART
      0,                                                          // 51: INCREMENT (TODO)

      // 52-61: Payout (10 cols)
      rec.netSalary,                                              // 52: NET SALARY [Green Highlight]
      totalNetSalary,                                             // 53: TOTAL NET SALARY [Green Highlight]
      '',                                                         // 54: PAID DATE (TODO)
      '',                                                         // 55: IN ACCT OF (TODO)
      '',                                                         // 56: RELATION (TODO)
      rec.payeeName || rec.empName,                               // 57: PAYEE NAME
      rec.bankAccountNo || '',                                    // 58: ACCOUNT NO
      rec.bankIfscCode || '',                                     // 59: IFSC CODE
      rec.bankName || '',                                         // 60: BANK NAME
      totalNetSalary,                                             // 61: EMP TOTAL

      // 62-67: Employer Compliance (6 cols)
      rec.epf,                                                    // 62: EMP EPF (TODO)
      employerEsic,                                               // 63: EMP ESIC (TODO)
      0,                                                          // 64: EMP MLWF (TODO)
      employerTotal,                                              // 65: TOTAL CONTRIB (TODO)
      totalEarnedGross + employerTotal,                           // 66: BURDEN HEAD (TODO)
      '',                                                         // 67: REMARK (TODO)
    ];

    const dataRow = worksheet.getRow(currentRowNum);
    dataRow.height = 22;

    rowValues.forEach((val, colIdx) => {
      const colNum = colIdx + 1;
      const cell = dataRow.getCell(colNum);
      cell.value = val;
      cell.border = borderStyle;
      cell.font = { name: 'Calibri', size: 9 };

      // Highlight ONLY NET SALARY (col 52) and TOTAL NET SALARY (col 53)
      if (colNum === 52 || colNum === 53) {
        cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF15803D' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      }

      // Alignments & Number formatting
      if ([1, 4, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 30, 54].includes(colNum)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if ([2, 3, 5, 7, 37, 55, 56, 57, 58, 59, 60, 67].includes(colNum)) {
        cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
      } else {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (typeof val === 'number') {
          cell.numFmt = '₹#,##0';
        }
      }
    });

    currentRowNum++;

    // Blank Spacer Row between records (matching legacy CSV pattern)
    const spacerRow = worksheet.getRow(currentRowNum);
    spacerRow.height = 12;
    for (let c = 1; c <= totalCols; c++) {
      spacerRow.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }
    currentRowNum++;
  });

  return worksheet;
}

export async function exportComplianceExcel({
  month,
  year,
  siteName,
  companyName,
  records,
}: ExportComplianceOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ambe Enterprises ERP';
  workbook.lastModifiedBy = 'Ambe Enterprises ERP';
  workbook.created = new Date();

  buildComplianceSheet(workbook, siteName, month, year, records, undefined, companyName);

  // Write Excel file buffer & Save
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const filename = `Payroll_Compliance_${siteName.replace(/[^a-zA-Z0-9]/g, '_')}_${month}_${year}.xlsx`;
  saveAs(blob, filename);
}

export async function exportAllSitesComplianceExcel({
  month,
  year,
  siteRecords,
}: ExportAllSitesComplianceOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ambe Enterprises ERP';
  workbook.lastModifiedBy = 'Ambe Enterprises ERP';
  workbook.created = new Date();

  const usedNames = new Set<string>();

  siteRecords.forEach((sr) => {
    buildComplianceSheet(workbook, sr.siteName, month, year, sr.records, usedNames, sr.companyName);
  });

  // Write Excel file buffer & Save
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const filename = `Payroll_Compliance_ALL_SITES_${month}_${year}.xlsx`;
  saveAs(blob, filename);
}

export interface AxisExportRecord {
  empId: string;
  name: string;
  payeeName?: string;
  bankAccountNo?: string;
  bankIfscCode?: string;
  netSalary: number;
}

export interface ExportAxisPayoutOptions {
  month: string;
  year: number;
  siteName: string;
  records: AxisExportRecord[];
}

export async function exportAxisPayoutExcel({
  month,
  year,
  siteName,
  records,
}: ExportAxisPayoutOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Axis Payout');

  const headers = [
    'Debit Account Number  \n(Mandatory)',
    'Transaction Amount  \n(Mandatory)',
    'Transaction Currency \n(Non-Mandatory)',
    'Beneficiary Name  \n(Mandatory)',
    'Beneficiary Account Number  \n(Mandatory)',
    'Beneficiary IFSC Code  \n(Mandatory)',
    'Transaction Date  \n(Mandatory)',
    'Payment Mode  \n(Mandatory)',
    'Customer Reference Number  \n(Mandatory)',
    'Beneficiary Nickname/Code  \n(Mandatory)',
    'Bank Account Type \n(Non-Mandatory)',
    'Debit Narration \n(Non-Mandatory)',
    'Credit Narration \n(Non-Mandatory)',
    'Beneficiary Address 1 \n(Non-Mandatory)',
    'Beneficiary Address 2 \n(Non-Mandatory)',
    'Beneficiary Address 3 \n(Non-Mandatory)',
    'Beneficiary City \n(Non-Mandatory)',
    'Beneficiary State \n(Non-Mandatory)',
    'Beneficiary Pin Code \n(Non-Mandatory)',
    'Beneficiary Bank Name \n(Non-Mandatory)',
    'Beneficiary Email address 1 \n(Non-Mandatory)',
    'Beneficiary Email address 2 \n(Non-Mandatory)',
    'Beneficiary Mobile Number \n(Non-Mandatory)',
    'Add Info1 \n(Non-Mandatory)',
    'Add Info2 \n(Non-Mandatory)',
    'Add Info3 \n(Non-Mandatory)',
    'Add Info4 \n(Non-Mandatory)',
    'Add Info5 \n(Non-Mandatory)',
    'Add Info6 \n(Non-Mandatory)'
  ];

  worksheet.addRow(headers);

  // Format Header Row (Row 1)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 40;
  headerRow.eachCell((cell) => {
    cell.alignment = {
      wrapText: true,
      horizontal: 'center',
      vertical: 'middle',
    };
    cell.font = { name: 'Calibri', bold: true, size: 9.5 };
  });

  // Set uniform column widths for all 29 columns
  worksheet.columns.forEach((column) => {
    column.width = 25;
  });

  const txnDate = new Date().toLocaleDateString('en-GB');

  records.forEach((record, index) => {
    const benName = record.payeeName || record.name;
    const cleanName = record.name.replace(/\s+/g, '').toUpperCase().substring(0, 10);
    const monthSub = month.substring(0, 3).toUpperCase();
    const nickname = `${cleanName}${monthSub}SAL`;
    const customerRef = 801 + index;

    const row = [
      '924020001871570',
      record.netSalary,
      '',
      benName,
      record.bankAccountNo || '',
      record.bankIfscCode || '',
      txnDate,
      'N',
      customerRef,
      nickname,
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
    ];

    worksheet.addRow(row);
  });

  // Format Data Rows
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.height = 22;
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 9.5 };
      });
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const filename = `Axis_Payout_${siteName.replace(/\s+/g, '_')}_${month}_${year}.xlsx`;
  saveAs(blob, filename);
}
