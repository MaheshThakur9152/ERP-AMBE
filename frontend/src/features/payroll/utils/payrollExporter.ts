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
  earnedGross: number;
  epf: number;
  esic: number;
  pt: number;
  totalDeductions: number;
  netSalary: number;
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
    views: [{ showGridLines: true }],
  });

  // 1. Column Architecture (57 Explicit Columns Cols A - BE)
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
    // GROUP 7: BENEFITS (Cols AU - AV)
    { header: 'BONUS BASE', key: 'base_bonus', width: 12 },
    { header: 'EARNED BONUS', key: 'earned_bonus', width: 14 },
    // GROUP 8: PAYOUT (Cols AW - BA)
    { header: 'NET SALARY', key: 'net_salary', width: 14 },
    { header: 'PAID DATE', key: 'paid_date', width: 12 },
    { header: 'IN ACCT OF', key: 'in_account_of', width: 15 },
    { header: 'PAYEE NAME', key: 'payee_name', width: 20 },
    { header: 'EMP TOTAL', key: 'employee_total', width: 12 },
    // GROUP 9: EMPLOYER COMPLIANCE (Cols BB - BE)
    { header: 'EMP EPF', key: 'employer_epf', width: 10 },
    { header: 'EMP ESIC', key: 'employer_esic', width: 10 },
    { header: 'EMP MLWF', key: 'employer_mlwf', width: 10 },
    { header: 'NET COMP HEAD', key: 'net_compliance_head', width: 16 }
  ];

  // Insert Index Row ((1), (2), (3)...) directly below headers (Row 2)
  const indexRowValues = Array.from({ length: 57 }, (_, i) => `(${i + 1})`);
  worksheet.spliceRows(2, 0, indexRowValues);

  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  const netHighlightFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFDCFCE7' }, // Soft Green #DCFCE7
  };

  const textCols = new Set(['employee_name', 'post_name', 'compliance_name', 'payee_name', 'in_account_of', 'other_ded_remark']);
  const codeDateCols = new Set(['emp_id', 'gender', 'doj', 'work_status', 'pf_no', 'esic_no', 'adv_date', 'paid_date']);
  const attendanceCols = new Set(['pd', 'wo', 'woe', 'hd', 'hde', 'second_shift', 'last_month', 'payable_days']);
  const highlightCols = new Set(['net_salary', 'employee_total', 'net_compliance_head']);

  // Add Employee Data Rows
  records.forEach((rec) => {
    const ratePerDay = rec.daysInMonth > 0 ? Math.round(rec.grossRate / rec.daysInMonth) : 0;
    const totalEarnedGross = rec.earnedGross;
    const earnedBonus = rec.earnedBonus ?? Math.round(rec.earnedBasic * 0.0833);
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
      net_salary: rec.netSalary,
      paid_date: '',
      in_account_of: '',
      payee_name: rec.empName,
      employee_total: rec.netSalary,
      employer_epf: rec.epf,
      employer_esic: employerEsic,
      employer_mlwf: 0,
      net_compliance_head: totalEarnedGross + employerTotal,
    };

    const dataRow = worksheet.addRow(rowData);
    dataRow.height = 22;

    worksheet.columns.forEach((col, colIdx) => {
      const cell = dataRow.getCell(colIdx + 1);
      const key = col.key;
      cell.border = borderStyle;

      if (key && textCols.has(key)) {
        cell.font = { name: 'Calibri', size: 9.5 };
        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      } else if (key && codeDateCols.has(key)) {
        cell.font = { name: 'Calibri', size: 9.5 };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (key && attendanceCols.has(key)) {
        const isBold = key === 'payable_days' || key === 'pd' || key === 'wo';
        cell.font = { name: 'Calibri', size: 9.5, bold: isBold };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.font = { name: 'Calibri', size: 9.5 };
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        cell.numFmt = '₹#,##0';
      }

      if (key && highlightCols.has(key)) {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF15803D' } };
        cell.fill = netHighlightFill;
      }
    });
  });

  // Push everything down by inserting 3 blank rows at top (Rows 1, 2, 3)
  worksheet.spliceRows(1, 0, [], [], []);

  // Row 1: Title
  const titleRow = worksheet.getRow(1);
  titleRow.height = 30;
  titleRow.getCell('A').value = `AMBE ENTERPRISES - PAYROLL COMPLIANCE SHEET (${month.toUpperCase()} ${year}) - SITE: ${siteName.toUpperCase()}`;
  worksheet.mergeCells('A1:BE1');
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
  groupRow.getCell('AU').value = 'BENEFITS'; worksheet.mergeCells('AU3:AV3');
  groupRow.getCell('AW').value = 'PAYOUT'; worksheet.mergeCells('AW3:BA3');
  groupRow.getCell('BB').value = 'EMPLOYER COMPLIANCE'; worksheet.mergeCells('BB3:BE3');

  groupRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF164E63' } };
    cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderStyle;
  });

  // Row 4: Slate Headers (Specific Column Names)
  const subHeaderRow = worksheet.getRow(4);
  subHeaderRow.height = 28;
  subHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = borderStyle;
  });

  // Row 5: Index Row ((1), (2), (3)...)
  const indexRow = worksheet.getRow(5);
  indexRow.height = 20;
  indexRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF475569' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderStyle;
  });

  // Write Excel file buffer & Save
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const filename = `Payroll_Compliance_${siteName.replace(/[^a-zA-Z0-9]/g, '_')}_${month}_${year}.xlsx`;
  saveAs(blob, filename);
}
