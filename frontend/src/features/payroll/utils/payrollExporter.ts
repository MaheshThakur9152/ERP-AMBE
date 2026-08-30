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
}

export interface ExportComplianceOptions {
  month: string;
  year: number;
  siteName: string;
  records: PayrollExportRecord[];
}

export async function exportComplianceExcel({
  month,
  year,
  siteName,
  records,
}: ExportComplianceOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ambe Enterprises ERP';
  workbook.lastModifiedBy = 'Ambe Enterprises ERP';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(`Compliance ${month} ${year}`, {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 5, activeCell: 'D6' }],
  });

  // 1. Column Architecture (60 Explicit Columns Cols A - BH)
  worksheet.columns = [
    // GROUP 1: EMPLOYEE INFO (Cols A - I)
    { header: 'EMP ID', key: 'emp_id', width: 10 },
    { header: 'NAME', key: 'employee_name', width: 22 },
    { header: 'POST', key: 'post_name', width: 14 },
    { header: 'GENDER', key: 'gender', width: 8 },
    { header: 'DOJ', key: 'doj', width: 12 },
    { header: 'STATUS', key: 'work_status', width: 10 },
    { header: 'COMPLIANCE NAME', key: 'compliance_name', width: 22 },
    { header: 'PF NO', key: 'pf_no', width: 14 },
    { header: 'ESIC NO', key: 'esic_no', width: 14 },
    // GROUP 2: ATTENDANCE (Cols J - R)
    { header: 'PD', key: 'pd', width: 6 },
    { header: 'WO', key: 'wo', width: 6 },
    { header: 'WOE', key: 'woe', width: 6 },
    { header: 'HD', key: 'hd', width: 6 },
    { header: 'HDE', key: 'hde', width: 6 },
    { header: '2ND SHIFT', key: 'second_shift', width: 10 },
    { header: 'LAST MTH', key: 'last_month', width: 10 },
    { header: 'TOTAL', key: 'payable_days', width: 8 },
    { header: 'OT HRS', key: 'ot_hours', width: 8 },
    // GROUP 3: BASE RATE CARD (Cols S - X)
    { header: 'GROSS RATE', key: 'gross_salary', width: 12 },
    { header: 'BASIC', key: 'base_basic', width: 10 },
    { header: 'HRA', key: 'base_hra', width: 10 },
    { header: 'WASHING', key: 'base_other', width: 10 },
    { header: 'CONVEYANCE', key: 'base_conveyance', width: 12 },
    { header: 'OTHER', key: 'base_misc', width: 10 },
    // GROUP 4: EARNED PAY (Cols Y - AD)
    { header: 'EARNED GROSS', key: 'earned_gross', width: 14 },
    { header: 'EARNED BASIC', key: 'earned_basic', width: 12 },
    { header: 'EARNED HRA', key: 'earned_hra', width: 12 },
    { header: 'EARNED WASH', key: 'earned_other', width: 12 },
    { header: 'EARNED CONV', key: 'earned_conveyance', width: 12 },
    { header: 'INCENTIVE', key: 'earned_incentive', width: 10 },
    // GROUP 5: ADVANCES & UNIFORM (Cols AE - AO)
    { header: 'ADV DATE', key: 'adv_date', width: 12 },
    { header: 'ADV AMT', key: 'adv_amt', width: 10 },
    { header: 'SHIRT', key: 'uni_shirt', width: 8 },
    { header: 'PANT', key: 'uni_pant', width: 8 },
    { header: 'SHOES', key: 'uni_shoes', width: 8 },
    { header: 'ID CARD', key: 'id_card', width: 8 },
    { header: 'OTHER AMT', key: 'other_ded_amt', width: 10 },
    { header: 'REMARK', key: 'other_ded_remark', width: 15 },
    { header: 'ADV TOTAL', key: 'total_advances', width: 10 },
    { header: 'IN THIS MTH', key: 'adv_this_month', width: 12 },
    { header: 'IN NEXT MTH', key: 'adv_next_month', width: 12 },
    // GROUP 6: DEDUCTIONS (Cols AP - AT)
    { header: 'EPF', key: 'epf', width: 8 },
    { header: 'ESIC', key: 'esic', width: 8 },
    { header: 'PT', key: 'pt', width: 8 },
    { header: 'MLWF', key: 'mlwf', width: 8 },
    { header: 'NET DEDUTION', key: 'net_deduction', width: 14 },
    // GROUP 7: BENEFITS (Cols AU - AX)
    { header: 'BONUS BASE', key: 'base_bonus', width: 12 },
    { header: 'EARNED BONUS', key: 'earned_bonus', width: 14 },
    { header: 'EARNED PART BONUS', key: 'earned_part_bonus', width: 16 },
    { header: 'REM. PART BONUS', key: 'remaining_part_bonus', width: 16 },
    // GROUP 8: PAYOUT (Cols AY - BD)
    { header: 'NET SALARY', key: 'net_salary', width: 14 },
    { header: 'TOTAL NET SALARY', key: 'total_net_salary', width: 16 },
    { header: 'PAID DATE', key: 'paid_date', width: 12 },
    { header: 'IN ACCT OF', key: 'in_account_of', width: 15 },
    { header: 'PAYEE NAME', key: 'payee_name', width: 20 },
    { header: 'EMP TOTAL', key: 'employee_total', width: 12 },
    // GROUP 9: EMPLOYER COMPLIANCE (Cols BE - BH)
    { header: 'EMP EPF', key: 'employer_epf', width: 10 },
    { header: 'EMP ESIC', key: 'employer_esic', width: 10 },
    { header: 'EMP MLWF', key: 'employer_mlwf', width: 10 },
    { header: 'NET COMP HEAD', key: 'net_compliance_head', width: 16 }
  ];

  // Insert Pure Numeric Index Row (Row 2)
  const indexRowValues = Array.from({ length: 60 }, (_, i) => i + 1);
  worksheet.spliceRows(2, 0, indexRowValues);

  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  const highlightCols = new Set(['net_salary', 'total_net_salary', 'employee_total', 'net_compliance_head']);

  // Add Employee Data Rows
  records.forEach((rec) => {
    const ratePerDay = rec.daysInMonth > 0 ? Math.round(rec.grossRate / rec.daysInMonth) : 0;
    const totalEarnedGross = rec.earnedGross;
    const earnedBonus = rec.earnedBonus ?? Math.round(rec.earnedBasic * 0.0833);
    const earnedPartBonus = rec.earnedPartBonus ?? 0;
    const remainingPartBonus = rec.remainingPartBonus ?? 0;
    const totalNetSalary = rec.totalNetSalary ?? (rec.netSalary + earnedPartBonus);
    const employerEsic = Math.ceil((rec.earnedBasic + rec.earnedHRA + (rec.earnedIncentive || rec.incentive || 0)) * 0.0325);
    const employerTotal = rec.epf + employerEsic;

    const rowData = {
      emp_id: rec.empId,
      employee_name: rec.empName,
      post_name: rec.designation,
      gender: rec.gender || 'M',
      doj: rec.doj || '01/01/2026',
      work_status: 'Active',
      compliance_name: 'Ambe Enterprises',
      pf_no: rec.pfNo || '',
      esic_no: rec.esicNo || '',
      pd: rec.pd,
      wo: rec.wo,
      woe: rec.woe || 0,
      hd: rec.hd || 0,
      hde: rec.hde || 0,
      second_shift: 0,
      last_month: 0,
      payable_days: rec.payableDays,
      ot_hours: 0,
      gross_salary: ratePerDay,
      base_basic: rec.basicDa,
      base_hra: rec.hra,
      base_other: rec.washingAllowance || 0,
      base_conveyance: rec.conveyanceAllowance || 0,
      base_misc: rec.otherAllowance || 0,
      earned_gross: rec.earnedGross,
      earned_basic: rec.earnedBasic,
      earned_hra: rec.earnedHRA,
      earned_other: rec.earnedOther || 0,
      earned_conveyance: rec.earnedConveyance || 0,
      earned_incentive: rec.incentive || 0,
      adv_date: '',
      adv_amt: rec.advances || 0,
      uni_shirt: 0,
      uni_pant: 0,
      uni_shoes: 0,
      id_card: 0,
      other_ded_amt: 0,
      other_ded_remark: '',
      total_advances: rec.advances || 0,
      adv_this_month: rec.advances || 0,
      adv_next_month: 0,
      epf: rec.epf,
      esic: rec.esic,
      pt: rec.pt,
      mlwf: 0,
      net_deduction: rec.totalDeductions,
      base_bonus: 0,
      earned_bonus: earnedBonus,
      earned_part_bonus: earnedPartBonus,
      remaining_part_bonus: remainingPartBonus,
      net_salary: rec.netSalary,
      total_net_salary: totalNetSalary,
      paid_date: '',
      in_account_of: '',
      payee_name: rec.empName,
      employee_total: totalNetSalary,
      employer_epf: rec.epf,
      employer_esic: employerEsic,
      employer_mlwf: 0,
      net_compliance_head: totalEarnedGross + employerTotal,
    };

    worksheet.addRow(rowData);
  });

  // Push everything down by inserting 3 blank rows at top (Rows 1, 2, 3)
  worksheet.spliceRows(1, 0, [], [], []);

  // Row 1: Title Block
  const titleRow = worksheet.getRow(1);
  titleRow.height = 30;
  titleRow.getCell('A').value = `AMBE ENTERPRISES - PAYROLL COMPLIANCE SHEET (${month.toUpperCase()} ${year}) - SITE: ${siteName.toUpperCase()}`;
  worksheet.mergeCells('A1:BH1');
  const titleCell = titleRow.getCell('A');
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Row 2: Blank spacer
  worksheet.getRow(2).height = 10;

  // Row 3: Teal Groupings
  const groupRow = worksheet.getRow(3);
  groupRow.height = 26;
  groupRow.getCell('A').value = 'EMPLOYEE DETAILS'; worksheet.mergeCells('A3:I3');
  groupRow.getCell('J').value = 'ATTENDANCE'; worksheet.mergeCells('J3:R3');
  groupRow.getCell('S').value = 'RATE CARD (BASE)'; worksheet.mergeCells('S3:X3');
  groupRow.getCell('Y').value = 'EARNED PAY'; worksheet.mergeCells('Y3:AD3');
  groupRow.getCell('AE').value = 'ADVANCES & UNIFORM'; worksheet.mergeCells('AE3:AO3');
  groupRow.getCell('AP').value = 'DEDUCTIONS'; worksheet.mergeCells('AP3:AT3');
  groupRow.getCell('AU').value = 'BENEFITS'; worksheet.mergeCells('AU3:AX3');
  groupRow.getCell('AY').value = 'PAYOUT'; worksheet.mergeCells('AY3:BD3');
  groupRow.getCell('BE').value = 'EMPLOYER COMPLIANCE'; worksheet.mergeCells('BE3:BH3');

  groupRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF164E63' } };
    cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderStyle;
  });

  // Row 4: Slate Specific Headers
  const subHeaderRow = worksheet.getRow(4);
  subHeaderRow.height = 28;
  subHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = borderStyle;
  });

  // Row 5: Clean Index Row
  const indexRow = worksheet.getRow(5);
  indexRow.height = 20;
  worksheet.columns.forEach((_col, index) => {
    indexRow.getCell(index + 1).value = index + 1; // Pure number
  });
  indexRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF94A3B8' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });

  // Data Rows Formatting (Row 6 and below)
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 5) {
      row.height = 25; // Give data room to breathe
      const isEven = (rowNumber - 5) % 2 === 0;
      const rowColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        // 1. Background & Borders
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColor } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };

        // 2. Strict Contextual Alignment
        if (colNumber <= 9) {
          if (colNumber === 1 || colNumber === 4 || colNumber === 5 || colNumber === 8 || colNumber === 9) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
          }
        } else if (colNumber >= 10 && colNumber <= 18) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (typeof cell.value === 'number') {
            cell.numFmt = '₹#,##0';
          }
        }

        // Highlight Net Payout columns
        const colKey = worksheet.columns[colNumber - 1]?.key;
        if (colKey && highlightCols.has(colKey)) {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF15803D' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        }
      });
    }
  });

  // Write Excel file buffer & Save
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const filename = `Payroll_Compliance_${siteName.replace(/[^a-zA-Z0-9]/g, '_')}_${month}_${year}.xlsx`;
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
