import React from 'react';
import { InvoiceData } from '../types/invoice';
import { computeInvoiceCalculations, formatCurrency, formatInteger } from '../utils/invoiceCalculator';

interface InvoiceTemplateProps {
  data: InvoiceData;
  colorMode?: 'color' | 'bw';
}

export const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({
  data,
  colorMode = 'color',
}) => {
  const calc = computeInvoiceCalculations(
    data.items,
    data.mgmtPercent,
    data.cgstPercent,
    data.sgstPercent
  );

  const MIN_ROWS = 8;
  const MIN_EMPTY_ROWS = 2;
  const emptyRowsCount = Math.max(MIN_EMPTY_ROWS, MIN_ROWS - data.items.length);
  const fontStyle = { fontFamily: 'Arial, Helvetica, sans-serif' };
  const isBw = colorMode === 'bw';

  return (
    <div
      id="printable-invoice"
      className={`w-full flex flex-col items-center select-none text-black print:w-full print:max-w-none ${
        isBw ? 'bw-mode grayscale' : ''
      }`}
      style={fontStyle}
    >
      {/* Row 1: Document Title Header floating above main box (Arial, 12pt, Normal, No borders) */}
      <div
        className="text-center font-normal text-[12pt] tracking-normal uppercase text-black mb-6 print:mb-4"
        style={fontStyle}
      >
        {data.type === 'Proforma Invoice' || data.meta?.invoiceType === 'Proforma Invoice'
          ? 'PROFORMA INVOICE'
          : 'TAX INVOICE'}
      </div>

      {/* Printable Invoice Container */}
      <div
        className="w-full max-w-4xl bg-white text-black text-[11px] leading-tight shadow-2xl rounded-sm print:shadow-none print:p-0 print:max-w-none print:w-full"
        style={fontStyle}
      >
        {/* Single Outer Box surrounding all invoice sections starting at Row 2 */}
        <div className="border border-black w-full">
          {/* Row 1 (Full Width): Red Company Name (or Black in B&W mode) */}
          <div className="border-b border-black p-2 pb-1">
            <h1
              style={{ color: isBw ? '#000000' : '#FF0000' }}
              className="font-bold text-sm sm:text-base leading-snug tracking-tight"
            >
              {data.company.name}
            </h1>
          </div>

          {/* Row 2 (The 2-Column Split): Address vs Meta */}
          <div className="grid grid-cols-12 items-stretch border-b border-black">
            {/* Left Column (col-span-7 p-2): Company Address, Contact, CIN, GSTIN */}
            <div className="col-span-7 p-2 space-y-0.5">
              <p className="text-[11px] text-zinc-900">{data.company.addressLine1}</p>
              <p className="text-[11px] text-zinc-900">{data.company.addressLine2}</p>
              <p className="text-[11px] text-zinc-900">Contact No: {data.company.contactNo}</p>
              <p className="text-[11px] text-zinc-900">Email : {data.company.emailWebsite}</p>
              {Boolean(data.company.cinNo?.trim()) && (
                <p className="text-[11px] text-zinc-900">CIN NO. : {data.company.cinNo}</p>
              )}
              {Boolean(data.company.gstin?.trim()) && (
                <p className="text-[11px] font-normal text-zinc-900">GSTIN : {data.company.gstin}</p>
              )}
            </div>

            {/* Right Column (col-span-5 border-l border-black p-2): Invoice No, Date, Billing Period */}
            <div className="col-span-5 border-l border-black p-2 flex flex-col h-full text-[11px]">
              <div className="space-y-1">
                <p className="text-zinc-900">
                  Invoice No : <span>{data.meta.invoiceNo}</span>
                </p>
                <p className="text-zinc-900">Date: {data.meta.invoiceDate}</p>
              </div>
              <p className="text-zinc-900 font-normal mt-auto pt-4">
                Billing Period: {data.meta.billingPeriod}
              </p>
            </div>
          </div>

          {/* Second Row: Billed Party Details vs Work Order Info */}
          <div className="grid grid-cols-12 border-b border-black items-stretch">
            {/* Left: Party Details */}
            <div className="col-span-7 border-r border-black p-2 space-y-0.5">
              <p className="font-semibold uppercase text-[10px] text-zinc-800">
                Name &amp; Add of Party:
              </p>
              <p className="font-bold text-xs text-black">{data.party.name}</p>
              {Boolean(data.party.siteName?.trim()) && (
                <p className="font-normal text-zinc-900">
                  SITE NAME: {data.party.siteName}
                </p>
              )}
              <p className="whitespace-pre-line text-zinc-900">{data.party.address}</p>
              {Boolean(data.party.gstin?.trim()) && (
                <p className="font-normal text-zinc-900">GSTIN : {data.party.gstin}</p>
              )}
            </div>

            {/* Right: Work Order Ref No vs Work Order Period with Horizontal Divider */}
            <div className="col-span-5 flex flex-col text-[11px]">
              {/* Work Order Ref No Sub-row */}
              <div className="p-2 border-b border-black flex-1 space-y-0.5">
                <p className="text-zinc-900">Work Order Ref No. :</p>
                <p className="text-zinc-900 font-normal">{data.party.workOrderRefNo || ''}</p>
              </div>
              {/* Work Order Period Sub-row */}
              <div className="p-2 flex-1 space-y-0.5">
                <p className="text-zinc-900">Work Order Period :</p>
                <p className="text-zinc-900 font-normal">{data.party.workOrderPeriod || ''}</p>
              </div>
            </div>
          </div>

          {/* Third Row: Greeting Note */}
          <div className="p-1.5 text-[10px] leading-tight text-zinc-900 border-b border-black">
            We thank you very much for valuable interest shown in our organzaion. We would like to submit our bill for providing our services.
          </div>

          {/* Main Line Items Table */}
          <div className="border-b border-black">
            <table className="w-full border-collapse text-[11px] text-left" style={fontStyle}>
              <thead>
                <tr className="border-b border-black text-black bg-white print:bg-transparent">
                  <th className="border-r border-black py-1 px-1.5 text-center font-normal w-[6%]">Sr No</th>
                  <th className="border-r border-black py-1 px-1.5 text-center font-normal w-[34%]">Description of Services</th>
                  <th className="border-r border-black py-1 px-1.5 text-center font-normal w-[10%]">HSN Code</th>
                  <th className="border-r border-black py-1 px-1.5 text-center font-normal w-[12%]">Rate</th>
                  <th className="border-r border-black py-1 px-1.5 text-center font-normal w-[10%]">Working Days</th>
                  <th className="border-r border-black py-1 px-1.5 text-center font-normal w-[8%]">Persons</th>
                  <th className="py-1 px-1.5 text-center font-normal w-[20%]">Amount (RS)</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => {
                  const isOvertime = item.description.toLowerCase().includes('overtime');
                  const nextIsOvertime = Boolean(
                    data.items[index + 1]?.description.toLowerCase().includes('overtime')
                  );

                  return (
                    <tr key={item.id || index} className="border-b border-black">
                      <td className="border-r border-black py-0.5 px-1 text-center font-normal">{index + 1}</td>
                      <td className="border-r border-black py-0.5 px-1.5 font-normal">{item.description}</td>

                      {/* Condition A: Main Row with Overtime next -> rowSpan={2} */}
                      {!isOvertime && nextIsOvertime ? (
                        <>
                          <td rowSpan={2} className="border-r border-b border-black py-0.5 px-1 text-center font-normal align-middle">
                            {item.hsnCode}
                          </td>
                          <td rowSpan={2} className="border-r border-b border-black py-0.5 px-1.5 text-center font-normal align-middle">
                            {item.rate > 0 ? formatInteger(item.rate) : ''}
                          </td>
                        </>
                      ) : !isOvertime ? (
                        /* Condition C: Normal Row -> standard render */
                        <>
                          <td className="border-r border-black py-0.5 px-1 text-center font-normal">{item.hsnCode}</td>
                          <td className="border-r border-black py-0.5 px-1.5 text-center font-normal">
                            {item.rate > 0 ? formatInteger(item.rate) : ''}
                          </td>
                        </>
                      ) : null /* Condition B: Overtime Row -> do NOT render HSN & Rate td cells */}

                      <td className="border-r border-black py-0.5 px-1 text-center font-normal">
                        {item.workingDays > 0 ? item.workingDays : 0}
                      </td>
                      <td className="border-r border-black py-0.5 px-1 text-center font-normal">
                        {item.persons > 0 ? item.persons : 0}
                      </td>
                      <td className="py-0.5 px-1.5 text-right font-normal">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  );
                })}

                {/* Empty filler rows: ONLY left & right vertical borders (NO horizontal top/bottom borders!) */}
                {Array.from({ length: emptyRowsCount }).map((_, idx) => (
                  <tr key={`blank-${idx}`} className="h-7">
                    <td className="border-r border-black p-0"></td>
                    <td className="border-r border-black p-0"></td>
                    <td className="border-r border-black p-0"></td>
                    <td className="border-r border-black p-0"></td>
                    <td className="border-r border-black p-0"></td>
                    <td className="border-r border-black p-0"></td>
                    <td className="p-0"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Math Summary & Merged Block Bank Details */}
          <div className="grid grid-cols-12 text-[11px]" style={fontStyle}>
            {/* Left Side: Merged Blocks matching Right Side Row Heights */}
            <div className="col-span-7 border-r border-black flex flex-col justify-between">
              {/* Merged Block 1: Bank Details */}
              <div className="p-2 space-y-0.5 flex-1 flex flex-col justify-start">
                <p className="font-semibold text-[10.5px]">Bank Details</p>
                <p>Bank Name : {data.bank.bankName}</p>
                <p>Acc no : {data.bank.accountNo}</p>
                <p className="text-[10px]">
                  IFSC Code: {data.bank.ifscCode} &nbsp;&nbsp; Branch: {data.bank.branch}
                </p>
              </div>

              {/* Merged Block 2: Amount in Words */}
              <div className="p-2 border-t border-black space-y-0.5 flex-1 flex flex-col justify-start">
                <span className="font-normal text-[10.5px] block text-zinc-900">
                  Amount Chargeble in words(INR) :
                </span>
                <p className="font-normal text-xs text-black leading-snug">
                  {calc.amountInWords}
                </p>
              </div>

              {/* Merged Block 3: Terms & condition */}
              <div className="p-2 border-t border-black text-[10px] space-y-0.5">
                <span className="font-semibold">Terms &amp; condition :</span>
                <p className="text-zinc-900">{data.terms}</p>
              </div>
            </div>

            {/* Right Side: Math Breakdown Table & Stamp Signatory */}
            <div className="col-span-5 flex flex-col justify-between">
              <div className="divide-y divide-black font-normal text-[11px]">
                <div className="flex justify-between p-1">
                  <span>Sub Total</span>
                  <span>{formatCurrency(calc.subTotal)}</span>
                </div>

                {calc.mgmtChargesPercent > 0 && (
                  <div className="flex justify-between p-1">
                    <span>Management charges @ {calc.mgmtChargesPercent}%</span>
                    <span>{formatCurrency(calc.mgmtChargesAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between p-1 font-normal">
                  <span>Total</span>
                  <span>{formatCurrency(calc.totalBeforeTax)}</span>
                </div>
                <div className="flex justify-between p-1">
                  <span>Add CGST @ {calc.cgstPercent}%</span>
                  <span>{formatCurrency(calc.cgstAmount)}</span>
                </div>
                <div className="flex justify-between p-1">
                  <span>Add SGST @ {calc.sgstPercent}%</span>
                  <span>{formatCurrency(calc.sgstAmount)}</span>
                </div>
                <div className="flex justify-between p-1 font-normal">
                  <span>Total</span>
                  <span>{formatCurrency(calc.totalWithTax)}</span>
                </div>
                <div className="flex justify-between p-1 text-[10px]">
                  <span>Round off (+-)</span>
                  <span>
                    {calc.roundOff >= 0 ? `${calc.roundOff.toFixed(2)}` : calc.roundOff.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between p-1 font-normal border-t border-black">
                  <span>Total Amount</span>
                  <span>{formatCurrency(calc.grandTotal)}</span>
                </div>
              </div>

              {/* Signatory Block */}
              <div className="p-2 text-right border-t border-black min-h-[90px] flex flex-col justify-between">
                <p className="font-normal text-[10px] text-zinc-900">For {data.company.name}</p>
                <div className="pt-8">
                  <p className="font-normal text-[10px] text-zinc-900">Authorized signatory</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
